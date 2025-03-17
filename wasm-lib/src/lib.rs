use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[wasm_bindgen]
pub fn sum_rs(left: usize, right: usize) -> usize {
    if right == 0 {
        return 0;
    }
    let mut sum_value: usize = 0;
    for _ in 0..right {
        sum_value += left + sum_rs(left, right - 1);
    }
    sum_value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
