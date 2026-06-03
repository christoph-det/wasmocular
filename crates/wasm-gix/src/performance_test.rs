use super::*;
use std::time::Instant;
use tempfile::TempDir;

// the tests can be run with an URL to a repository or with a local path, to avoid just measuring network latency and having different versions

#[test]
fn benchmark_git_indexer_tiny_repo() {
    // artifical repository with only 3 commits for testing and benchmarking, baseline
    // let repo_url = "https://github.com/christoph-det/test-repo-wasmocular.git";
    let repo_url = "/Users/christoph/Documents/01Uni/Master/Masterarbeit/01thesis-project-code/masterarbeit/evaluation/repos/test-repo-wasmocular";
    run_benchmark(repo_url);
}

#[test]
#[ignore] // for only running during performance evaluations
fn benchmark_git_indexer_small_repo() {
    // clone smaller repo for performance testing, about 1350 commits at time of writing
    //let repo_url = "https://github.com/pmndrs/zustand.git";
    let repo_url = "/Users/christoph/Documents/01Uni/Master/Masterarbeit/01thesis-project-code/masterarbeit/evaluation/repos/zustand";
    run_benchmark(repo_url);
}

#[test]
#[ignore]
fn benchmark_git_indexer_large_repo() {
    // clone large repo for performance testing, about 13500 commits at time of writing
    //let repo_url = "https://github.com/withastro/astro.git";
    let repo_url = "/Users/christoph/Documents/01Uni/Master/Masterarbeit/01thesis-project-code/masterarbeit/evaluation/repos/astro";
    run_benchmark(repo_url);
}

fn run_benchmark(repo_url: &str) {
    let dir = TempDir::new().expect("failed to create temp dir");
    let path = dir.path();

    println!("Cloning repository: {}", repo_url);
    let start_clone_time = Instant::now();
    api_tests::execute_git_command(&["clone", repo_url, "."], path);
    let clone_duration = start_clone_time.elapsed();

    let start_index_time = Instant::now();
    let indexer_result = run_git_indexer(path, None);
    let index_duration = start_index_time.elapsed();

    assert!(
        indexer_result.is_ok(),
        "Git indexer should complete successfully"
    );
    println!(
        "Clone took {:.2?}, Git indexer completed in {:.2?} for repository {}",
        clone_duration, index_duration, repo_url
    );
}
