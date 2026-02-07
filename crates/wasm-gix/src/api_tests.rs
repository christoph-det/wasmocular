use super::*;
use std::path::Path;
use std::process::Command;
use tempfile::TempDir;

pub fn execute_git_command(args: &[&str], path: &Path) {
    Command::new("git")
        .args(args)
        .current_dir(path)
        .output()
        .expect("failed to execute git command");
}

pub fn create_test_repo() -> TempDir {
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
        branch_list.contains(&"main".to_string()) || branch_list.contains(&"master".to_string()),
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
