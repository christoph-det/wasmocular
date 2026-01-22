#![deny(rust_2018_idioms)]

mod api;
mod api_testing_functions;
mod ffi;

pub use crate::ffi::{
    gitoxide_run_git_indexer,
    gitoxide_branches,
    gitoxide_repo_head,
    gitoxide_tracked_paths,
};

fn main() {}
