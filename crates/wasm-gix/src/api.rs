use std::path::Path;
use std::sync::Arc;
use anyhow::{anyhow, Context, Result};

use arrow_array::array::ArrayRef;
use arrow_array::{StringArray, TimestampMillisecondArray, UInt64Array};
use arrow_array::RecordBatch;
use arrow_ipc::writer::{StreamWriter};
use arrow_schema::{DataType, Field, Schema, TimeUnit};

pub fn repo_head(repo_path: &Path) -> Result<String> {
    let repo = gix::open(repo_path)
        .with_context(|| format!("failed to open repository at {}", repo_path.display()))?;

    let mut head = repo.head().context("failed to read HEAD")?;

    let sha = head
        .peel_to_commit()
        .map(|commit| commit.id().to_string())
        .unwrap_or_else(|_| String::from("unknown"));

    Ok(sha)
}

pub fn tracked_paths(repo_path: &Path) -> Result<Vec<String>> {
    let repo = gix::open(repo_path)
        .with_context(|| format!("failed to open repository at {}", repo_path.display()))?;

    collect_tracked_paths(&repo)
}

fn collect_tracked_paths(repo: &gix::Repository) -> Result<Vec<String>> {
    let mut head = repo.head().context("failed to read HEAD")?;
    if head.is_unborn() {
        return Ok(Vec::new());
    }

    let commit = head
        .peel_to_commit()
        .context("failed to peel HEAD to commit")?;
    let tree = commit.tree().context("failed to load commit tree")?;
    let entries = tree
        .traverse()
        .breadthfirst
        .files()
        .map_err(|err| anyhow!(err))?;

    let mut paths = Vec::new();
    paths.reserve(entries.len());
    for entry in entries {
        if matches!(entry.mode.kind(), gix::objs::tree::EntryKind::Tree) {
            continue;
        }
        let path = String::from_utf8_lossy(entry.filepath.as_ref()).into_owned();
        paths.push(path);
    }

    Ok(paths)
}

pub fn branches(repo_path: &Path) -> Result<Vec<String>> {
    let repo = gix::open(repo_path)
        .with_context(|| format!("failed to open repository at {}", repo_path.display()))?;

    let references = repo
        .references()
        .context("failed to access references")?;
    let mut refs = references
        .prefixed("refs/heads/")
        .context("failed to iterate local branches")?;

    let mut names = Vec::new();
    while let Some(reference) = refs.next() {
        let reference = match reference {
            Ok(reference) => reference,
            Err(err) => return Err(anyhow!(err.to_string())),
        };
        let full_name = reference.name().as_bstr().to_string();
        let short = full_name
            .strip_prefix("refs/heads/")
            .unwrap_or(&full_name)
            .to_string();
        names.push(short);
    }

    names.sort();
    Ok(names)
}

// runs from head and goes backwards, collecting commit data
pub fn run_git_indexer(repo_path: &Path, last_indexed_commit_sha: Option<String>) -> Result<Vec<u8>> {
    let repo = gix::open(repo_path)?;

    let mut head = repo.head()?;
    let head_commit = head.peel_to_commit()?;

    let head_id: gix_hash::ObjectId = head_commit.id().detach().into();
    let walk = repo.rev_walk([head_id]);
    let mut walk = walk.all()?;

    let branch_hint_value = head
        .referent_name()
        .map(|name| name.to_string())
        .unwrap_or_default();

    let mut shas = Vec::new();
    let mut messages = Vec::new();
    let mut author_signatures = Vec::new();
    let mut authored_at = Vec::new();
    let mut branch_hints = Vec::new();
    let mut additions: Vec<u64> = Vec::new();
    let mut deletions: Vec<u64> = Vec::new();

    println!("[gitoxide] Starting commit indexing...");
    let commit_count = repo
    .rev_walk([head_id.clone()])
    .all()?
    .try_fold(0usize, |acc, item| -> Result<_, gix::revision::walk::iter::Error> {
        item?;
        Ok(acc + 1)
    })?;
    println!("[gitoxide] Commit count: {}", commit_count);


    while let Some(item) = walk.next() {
        let commit = item?.object()?;

        let sha = commit.id().to_string();

        if last_indexed_commit_sha.as_deref() == Some(&sha) {
            println!("[gitoxide] Reached last indexed commit {}, stopping.", sha);
            break;
        }

        // logging progress every 100 commits
        if shas.len() % 100 == 0 {
            println!("[gitoxide] Indexed commits: {}", shas.len());
        }

        shas.push(sha);

        let raw_message = commit.message_raw_sloppy().to_string();
        messages.push(raw_message);

        let (signature, timestamp_ms) = match commit.author() {
            Ok(sig) => {
                let author = format!("{} <{}>", sig.name, sig.email);
                let millis = sig.seconds().saturating_mul(1_000);
                (author, millis)
            }
            Err(_) => ("unknown <unknown>".to_owned(), 0),
        };
        author_signatures.push(signature);
        authored_at.push(timestamp_ms);

        branch_hints.push(branch_hint_value.clone());
        let (added_lines, removed_lines) = commit_line_stats(&repo, &commit)?;
        additions.push(added_lines);
        deletions.push(removed_lines);
    }

    println!("[gitoxide] Finished, indexed {} commits", shas.len());

    let schema = Schema::new(vec![
        Field::new("sha", DataType::Utf8, false),
        Field::new("message", DataType::Utf8, false),
        Field::new("author_signature", DataType::Utf8, false),
        Field::new(
            "authored_at",
            DataType::Timestamp(TimeUnit::Millisecond, None),
            false,
        ),
        Field::new("branch_hint", DataType::Utf8, false),
        Field::new("additions", DataType::UInt64, false),
        Field::new("deletions", DataType::UInt64, false),
    ]);

    let commits: ArrayRef = Arc::new(StringArray::from(shas));
    let messages: ArrayRef = Arc::new(StringArray::from(messages));
    let authors: ArrayRef = Arc::new(StringArray::from(author_signatures));
    let timestamps: ArrayRef =
        Arc::new(TimestampMillisecondArray::from_iter_values(authored_at.iter().copied()));
    let branch_hints: ArrayRef = Arc::new(StringArray::from(branch_hints));
    let additions: ArrayRef = Arc::new(UInt64Array::from(additions));
    let deletions: ArrayRef = Arc::new(UInt64Array::from(deletions));

    let batch = RecordBatch::try_new(
        Arc::new(schema.clone()),
        vec![
            commits,
            messages,
            authors,
            timestamps,
            branch_hints,
            additions,
            deletions,
        ],
    )
    .map_err(|err| anyhow!(err.to_string()))?;

    let mut buffer = Vec::new();
    {
        let mut writer = StreamWriter::try_new(&mut buffer, &schema)?;
        writer.write(&batch)?;
        writer.finish()?;
    }

    Ok(buffer)
}


fn commit_line_stats<'repo>(
    repo: &'repo gix::Repository,
    commit: &gix::Commit<'repo>,
) -> Result<(u64, u64)> {
    let current_tree = commit.tree()?;

    let base_tree = if let Some(parent_id) = commit.parent_ids().next() {
        let parent_commit = parent_id.object()?.try_into_commit()?;
        parent_commit.tree()?
    } else {
        repo.empty_tree()
    };

    let mut diff_platform = base_tree
        .changes()
        .context("failed to prepare tree diff platform")?;
    diff_platform.options(|opts| {
        opts.track_filename().track_rewrites(None);
    });

    let stats = diff_platform
        .stats(&current_tree)
        .map_err(|err| anyhow!(err))
        .with_context(|| "failed to compute tree diff stats")?;

    Ok((stats.lines_added, stats.lines_removed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::TempDir;

    fn execute_git_command(args: &[&str], path: &Path) {
        Command::new("git")
            .args(args)
            .current_dir(path)
            .output()
            .expect("failed to execute git command");
    }

    fn create_test_repo() -> TempDir {
        let dir = TempDir::new().expect("failed to create temp dir");
        let path = dir.path();

        execute_git_command(&["init"], path);
        execute_git_command(&["config", "user.email", "test@example.com"], path);
        execute_git_command(&["config", "user.name", "Test User"], path);
        std::fs::write(path.join("file.txt"), "hello world\n").expect("failed to write file");
        execute_git_command(&["add", "."], path);
        execute_git_command(&["commit", "-m", "Initial commit"], path);

        dir
    }

    #[test]
    fn test_repo_head_returns_sha() {
        let repo_dir = create_test_repo();
        let result = repo_head(repo_dir.path());

        assert!(result.is_ok());
        let sha = result.unwrap();
        assert_eq!(sha.len(), 40, "SHA should be 40 hex characters");
    }

    #[test]
    fn test_tracked_paths_returns_files() {
        let repo_dir = create_test_repo();
        let result = tracked_paths(repo_dir.path());

        assert!(result.is_ok());
        let paths = result.unwrap();
        assert!(paths.contains(&"file.txt".to_string()));
    }

    #[test]
    fn test_branches_includes_main_or_master() {
        let repo_dir = create_test_repo();
        let result = branches(repo_dir.path());

        assert!(result.is_ok());
        let branch_list = result.unwrap();
        assert!(
            branch_list.contains(&"main".to_string())
                || branch_list.contains(&"master".to_string()),
            "Should have main or master branch"
        );
    }

    #[test]
    fn test_run_git_indexer_returns_arrow_data() {
        let repo_dir = create_test_repo();
        let result = run_git_indexer(repo_dir.path(), None);

        assert!(result.is_ok());
        let data = result.unwrap();
        assert!(!data.is_empty(), "Arrow data should not be empty");
    }

    #[test]
    fn test_repo_head_error_on_invalid_path() {
        let result = repo_head(Path::new("/nonexistent/path"));
        assert!(result.is_err());
    }
}
