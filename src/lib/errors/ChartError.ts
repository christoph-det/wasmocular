class ChartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartError";
  }
}

export default ChartError;
