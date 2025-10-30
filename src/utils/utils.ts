export function generateRepoIdentifier(): string {
  return Date.now().toString(16);
}

function extractPercent(line: string): number | undefined {
  const match = /(\d+)%/.exec(line);
  return match ? Number(match[1]) : undefined;
}

const COUNTING_MARKER = "counting objects";
const COMPRESSING_MARKER = "compressing objects";
const RESOLVING_MARKER = "resolving deltas";
const DOWNLOAD_MARKER = "net";

// we only get seperate lines for the download phase, so we can parse percent there
export function parseCloneProgress(
  line: string
): { phase: string; percent: number } | null {
  const lowered = line.toLowerCase();
  if (lowered.includes(DOWNLOAD_MARKER)) {
    const percent = extractPercent(line);
    return percent === undefined ? null : { phase: "Downloading", percent };
  }
  if (lowered.includes(COUNTING_MARKER)) {
    return { phase: "Counting", percent: 0 };
  }
  if (lowered.includes(COMPRESSING_MARKER)) {
    return { phase: "Compressing", percent: 0 };
  }
  if (lowered.includes(RESOLVING_MARKER)) {
    return { phase: "Resolving", percent: 100 };
  }
  return null;
}
