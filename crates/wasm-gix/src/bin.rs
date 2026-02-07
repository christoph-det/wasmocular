#![deny(rust_2018_idioms)]

mod api;
mod ffi;

pub use crate::ffi::{
    gitoxide_branches, gitoxide_repo_head, gitoxide_run_git_indexer, gitoxide_tracked_paths,
};

fn main() {}
