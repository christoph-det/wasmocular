self.onmessage = function(event) {
  const { a, b } = event.data;
  self.postMessage(sum_JS(a, b));
};

function sum_JS(a, b) {
  if (b === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < b; i++) {
    sum += a + sum_JS(a, b - 1);
  }
  return sum;
}
