use crate::api;
/**
 * The foreign function interface (FFI) exposes functions for interacting with a git repository.
 */
use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::path::Path;

thread_local! {
    static RETURN_BUFFER: RefCell<Vec<u8>> = RefCell::new(Vec::with_capacity(64));
}

fn write_buffer(bytes: impl AsRef<[u8]>) -> *const c_char {
    RETURN_BUFFER.with(|buf| {
        let mut buf = buf.borrow_mut();
        buf.clear();
        buf.extend_from_slice(bytes.as_ref());
        buf.push(0);
        buf.as_ptr() as *const c_char
    })
}

fn write_message(message: impl AsRef<str>) -> *const c_char {
    match CString::new(message.as_ref()) {
        Ok(value) => write_buffer(value.as_bytes()),
        Err(_) => write_buffer(b"error: interior null byte"),
    }
}

fn format_result<T: std::fmt::Display>(result: anyhow::Result<T>) -> *const c_char {
    match result {
        Ok(value) => write_message(value.to_string()),
        Err(err) => write_message(format!("error: {err}")),
    }
}

fn format_lines_result(result: anyhow::Result<Vec<String>>) -> *const c_char {
    format_result(result.map(|v| v.join("\n")))
}

fn read_utf8(ptr: *const c_char) -> Result<String, &'static str> {
    if ptr.is_null() {
        return Err("null pointer");
    }

    unsafe { CStr::from_ptr(ptr) }
        .to_str()
        .map(str::to_owned)
        .map_err(|_| "invalid utf-8")
}

/// Gets the current HEAD commit SHA of the repository at the given path, stored for reindexing.
#[no_mangle]
pub extern "C" fn gitoxide_repo_head(repo_path: *const c_char) -> *const c_char {
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    format_result(api::repo_head(Path::new(&repo_path)))
}

/// Gets the tracked paths of the repository at the given path.
#[no_mangle]
pub extern "C" fn gitoxide_tracked_paths(repo_path: *const c_char) -> *const c_char {
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    format_lines_result(api::tracked_paths(Path::new(&repo_path)))
}

/// Gets the list of branches of the repository at the given path. Currently unused but for futre extensions to mine branch-specific data.
#[no_mangle]
pub extern "C" fn gitoxide_branches(repo_path: *const c_char) -> *const c_char {
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    format_lines_result(api::branches(Path::new(&repo_path)))
}

/// Runs the git indexer on the repository at the given path, optionally starting from the last indexed commit SHA.
#[no_mangle]
pub extern "C" fn gitoxide_run_git_indexer(
    repo_path: *const c_char,
    last_indexed_commit_sha: *const c_char,
) -> *const c_char {
    let last_indexed_commit_sha_option = if last_indexed_commit_sha.is_null() {
        None
    } else {
        match read_utf8(last_indexed_commit_sha) {
            Ok(s) => Some(s),
            Err(err) => return write_message(format!("error: {err}")),
        }
    };

    const OUTPUT_PATH: &str = "/tmp/commits.arrow";
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    let result = api::run_git_indexer(Path::new(&repo_path), last_indexed_commit_sha_option)
        .and_then(|data| std::fs::write(OUTPUT_PATH, data).map_err(|e| anyhow::anyhow!(e)))
        .map(|_| OUTPUT_PATH.to_owned());
    format_result(result)
}
