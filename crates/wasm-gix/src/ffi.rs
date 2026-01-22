use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char};
use std::path::Path;

use crate::api;

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

fn store_result(result: anyhow::Result<String>) -> *const c_char {
    match result {
        Ok(value) => write_message(value),
        Err(err) => write_message(format!("error: {err}")),
    }
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


#[no_mangle]
pub extern "C" fn gitoxide_repo_head(repo_path: *const c_char) -> *const c_char {
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    store_result(api::repo_head(Path::new(&repo_path)))
}

#[no_mangle]
pub extern "C" fn gitoxide_tracked_paths(repo_path: *const c_char) -> *const c_char {
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    match api::tracked_paths(Path::new(&repo_path)) {
        Ok(paths) => write_message(paths.join("\n")),
        Err(err) => write_message(format!("error: {err}")),
    }
}

#[no_mangle]
pub extern "C" fn gitoxide_branches(repo_path: *const c_char) -> *const c_char {
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    match api::branches(Path::new(&repo_path)) {
        Ok(branches) => write_message(branches.join("\n")),
        Err(err) => write_message(format!("error: {err}")),
    }
}

#[no_mangle]
pub extern "C" fn gitoxide_run_git_indexer(repo_path: *const c_char, last_indexed_commit_sha: *const c_char) -> *const c_char {
    let last_indexed_commit_sha_option = if last_indexed_commit_sha.is_null() {
        None
    } else {
        match read_utf8(last_indexed_commit_sha.clone()) {
            Ok(s) => Some(s),
            Err(err) => return write_message(format!("error: {err}")),
        }
    };  

    const OUTPUT_PATH: &str = "/tmp/commits.arrow";
    let repo_path = match read_utf8(repo_path) {
        Ok(path) => path,
        Err(err) => return write_message(format!("error: {err}")),
    };
    match api::run_git_indexer(Path::new(&repo_path), last_indexed_commit_sha_option) {
        Ok(data) => match std::fs::write(OUTPUT_PATH, data) {
            Ok(_) => write_message(OUTPUT_PATH.to_owned()),
            Err(err) => write_message(format!("error: {err}")),
        },
        Err(err) => write_message(format!("error: {err}")),
    }
}
