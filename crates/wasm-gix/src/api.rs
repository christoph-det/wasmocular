use anyhow::{anyhow, Context, Result};
use arrow_array::array::ArrayRef;
use arrow_array::{RecordBatch, StringArray, TimestampMillisecondArray, UInt64Array};
use arrow_ipc::writer::StreamWriter;
use arrow_schema::{DataType, Field, Schema, TimeUnit};
use std::path::Path;
use std::sync::Arc;

const BRANCH_PREFIX: &str = "refs/heads/";

/// Returns the SHA of the HEAD commit of the repository at the given path.
pub fn repo_head(repo_path: &Path) -> Result<String> {
    // open repository
    let repo = gix::open(repo_path)
        .with_context(|| format!("failed to open repository at {}", repo_path.display()))?;

    let mut head = repo.head().context("failed to read HEAD")?;

    if head.is_unborn() {
        return Err(anyhow!("repository has no commits"));
    }

    // get HEAD commit SHA
    let sha = head
        .peel_to_commit()
        .map(|commit| commit.id().to_string())
        .unwrap_or_else(|_| String::from("unknown"));

    Ok(sha)
}

/// Returns a list of all tracked file paths in the repository at the given path.
pub fn tracked_paths(repo_path: &Path) -> Result<Vec<String>> {
    let repo = gix::open(repo_path)
        .with_context(|| format!("failed to open repository at {}", repo_path.display()))?;

    collect_tracked_paths(&repo)
}

fn collect_tracked_paths(repo: &gix::Repository) -> Result<Vec<String>> {
    // get HEAD commit
    let mut head = repo.head().context("failed to read HEAD")?;
    if head.is_unborn() {
        return Ok(Vec::new());
    }
    let commit = head
        .peel_to_commit()
        .context("failed to peel HEAD to commit")?;
    // traverse the commit tree to collect file paths
    let tree = commit.tree().context("failed to load commit tree")?;
    let entries = tree
        .traverse()
        .breadthfirst
        .files()
        .map_err(|err| anyhow!(err))?;

    // collect file paths, excluding directories
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

/// Returns a list of all branch names in the repository at the given path.
pub fn branches(repo_path: &Path) -> Result<Vec<String>> {
    let repo = gix::open(repo_path)
        .with_context(|| format!("failed to open repository at {}", repo_path.display()))?;

    let references = repo.references().context("failed to access references")?;
    let refs = references
        .prefixed(BRANCH_PREFIX)
        .context("failed to iterate local branches")?;

    let mut names = Vec::new();
    // iterate over branch references and collect their short names
    for reference in refs {
        let reference = reference.map_err(|err| anyhow!(err.to_string()))?;
        let full_name = reference.name().as_bstr().to_string();
        names.push(short_branch_name(&full_name));
    }

    Ok(names)
}

fn short_branch_name(full_name: &str) -> String {
    full_name
        .strip_prefix(BRANCH_PREFIX)
        .unwrap_or(full_name)
        .to_string()
}

/// Runs the git indexer on the repository at the given path, optionally starting from the last indexed commit SHA.
/// Going from newest to oldest commit.
pub fn run_git_indexer(
    repo_path: &Path,
    last_indexed_commit_sha: Option<String>,
) -> Result<Vec<u8>> {
    let repo = gix::open(repo_path)?;

    // prepare rev walk from HEAD
    let mut head = repo.head()?;
    let head_commit = head.peel_to_commit()?;
    let head_id: gix_hash::ObjectId = head_commit.id().detach().into();
    let walk = repo.rev_walk([head_id]);
    let mut walk = walk.all()?;

    // get branch name, for now we just use branch of HEAD, could be extended to multiple branches later
    let branch_hint_value = head
        .referent_name()
        .map(|name| short_branch_name(&name.to_string()))
        .unwrap_or_default();

    // we walk the repo here another time to count commits to show progress in the UI, could be dropped but
    // calculatiing the diffs is the bottleneck anyway
    let commit_count = repo.rev_walk([head_id.clone()]).all()?.try_fold(
        0usize,
        |acc, item| -> Result<_, gix::revision::walk::iter::Error> {
            item?;
            Ok(acc + 1)
        },
    )?;

    let commit_data = collect_commit_data(
        &repo,
        &mut walk,
        &branch_hint_value,
        last_indexed_commit_sha.as_deref(),
        commit_count,
    )?;
    // build Arrow RecordBatch and serialize to IPC format for return to JS worker
    let schema = commit_schema();
    let batch = build_commit_batch(&schema, commit_data)?;
    write_batch_to_ipc(&schema, &batch)
}

struct CommitData {
    shas: Vec<String>,
    messages: Vec<String>,
    author_signatures: Vec<String>,
    authored_at: Vec<i64>,
    branch_hints: Vec<String>,
    additions: Vec<u64>,
    deletions: Vec<u64>,
}

/// Collects commit data from the revision walk, stopping if the last indexed commit SHA is encountered.
fn collect_commit_data(
    repo: &gix::Repository,
    walk: &mut gix::revision::Walk<'_>,
    branch_hint_value: &str,
    last_indexed_commit_sha: Option<&str>,
    commit_count: usize,
) -> Result<CommitData> {
    // used to show progress in UI
    println!("[gitoxide] Starting commit indexing...");
    println!("[gitoxide] Commit count: {}", commit_count);

    let mut data = CommitData {
        shas: Vec::with_capacity(commit_count),
        messages: Vec::with_capacity(commit_count),
        author_signatures: Vec::with_capacity(commit_count),
        authored_at: Vec::with_capacity(commit_count),
        branch_hints: Vec::with_capacity(commit_count),
        additions: Vec::with_capacity(commit_count),
        deletions: Vec::with_capacity(commit_count),
    };

    // iterate over commits by walking the revision history until last indexed commit is reached or walk ends
    while let Some(item) = walk.next() {
        let commit = item?.object()?;

        let sha = commit.id().to_string();
        if last_indexed_commit_sha == Some(sha.as_str()) {
            println!("[gitoxide] Reached last indexed commit {}, stopping.", sha);
            break;
        }

        // show progress every 100 commits, compromise between too frequent updates and user feedback
        if data.shas.len() % 100 == 0 {
            println!("[gitoxide] Indexed commits: {}", data.shas.len());
        }

        data.shas.push(sha);
        data.messages.push(commit.message_raw_sloppy().to_string());

        let (signature, timestamp_ms) = match commit.author() {
            Ok(sig) => {
                let author = format!("{} <{}>", sig.name, sig.email);
                let millis = sig.seconds().saturating_mul(1_000);
                (author, millis)
            }
            Err(_) => ("unknown <unknown>".to_owned(), 0),
        };
        data.author_signatures.push(signature);
        data.authored_at.push(timestamp_ms);
        data.branch_hints.push(branch_hint_value.to_string());

        let (added_lines, removed_lines) = commit_line_stats(repo, &commit)?;
        data.additions.push(added_lines);
        data.deletions.push(removed_lines);
    }

    println!("[gitoxide] Finished, indexed {} commits", data.shas.len());
    Ok(data)
}

/// Builds an Arrow RecordBatch from the collected commit data.
fn build_commit_batch(schema: &Schema, data: CommitData) -> Result<RecordBatch> {
    let commits_array: ArrayRef = Arc::new(StringArray::from(data.shas));
    let messages_array: ArrayRef = Arc::new(StringArray::from(data.messages));
    let authors_array: ArrayRef = Arc::new(StringArray::from(data.author_signatures));
    let timestamps_array: ArrayRef = Arc::new(TimestampMillisecondArray::from_iter_values(
        data.authored_at.iter().copied(),
    ));
    let branch_hints_array: ArrayRef = Arc::new(StringArray::from(data.branch_hints));
    let additions_array: ArrayRef = Arc::new(UInt64Array::from(data.additions));
    let deletions_array: ArrayRef = Arc::new(UInt64Array::from(data.deletions));

    RecordBatch::try_new(
        Arc::new(schema.clone()),
        vec![
            commits_array,
            messages_array,
            authors_array,
            timestamps_array,
            branch_hints_array,
            additions_array,
            deletions_array,
        ],
    )
    .map_err(|err| anyhow!(err.to_string()))
}

/// Serializes the RecordBatch to Arrow IPC format and returns the byte vector.
fn write_batch_to_ipc(schema: &Schema, batch: &RecordBatch) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    {
        let mut writer = StreamWriter::try_new(&mut buffer, schema)?;
        writer.write(batch)?;
        writer.finish()?;
    }
    Ok(buffer)
}

/// Defines the Arrow schema for the commit data.
fn commit_schema() -> Schema {
    Schema::new(vec![
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
    ])
}

/// Computes the line addition and deletion stats for a given commit.
fn commit_line_stats<'repo>(
    repo: &'repo gix::Repository,
    commit: &gix::Commit<'repo>,
) -> Result<(u64, u64)> {
    let current_tree = commit.tree()?;

    // for merge commits, we use the first parent so stats reflect diff vs primary branch
    let base_tree = if let Some(parent_id) = commit.parent_ids().next() {
        let parent_commit = parent_id.object()?.try_into_commit()?;
        parent_commit.tree()?
    } else {
        repo.empty_tree()
    };

    let mut diff_platform = base_tree
        .changes()
        .context("failed to prepare tree diff platform")?;

    // configure diff to track renames and copies (compromise between accuracy and performance)
    let rewrites = gix::diff::Rewrites {
        copies: None, // disable copy detection for performance
        percentage: Some(0.8), // 80% similarity threshold for renames
        limit: 1000, // limit 1000 rewrite candidates for comparison
        track_empty: false, 
    };
    diff_platform.options(|opts| {
        opts.track_filename().track_rewrites(Some(rewrites));
    });

    let stats = diff_platform
        .stats(&current_tree)
        .map_err(|err| anyhow!(err))
        .with_context(|| "failed to compute tree diff stats")?;

    Ok((stats.lines_added, stats.lines_removed))
}

#[cfg(test)]
#[path = "api_tests.rs"]
mod api_tests;
