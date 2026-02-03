use super::*;
use std::ffi::CStr;

#[test]
fn test_ffi_repo_head_returns_sha() {
    let repo_dir = api_tests::create_test_repo();
    let repo_path = repo_dir.path().to_str().unwrap();
    let result_ptr = crate::ffi::gitoxide_repo_head(repo_path.as_ptr() as *const i8);

    let result_str = unsafe { CStr::from_ptr(result_ptr) }.to_str().unwrap();
    assert!(
        !result_str.starts_with("error:"),
        "Got error: {}",
        result_str
    );

    assert_eq!(
        result_str.len(),
        40,
        "SHA should be 40 hex characters, got: {}",
        result_str
    );
}
