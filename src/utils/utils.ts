export function generateRepoIdentifier(): string {
  return Date.now().toString(16);
}
