import { expect, test } from "vitest";
import { generateRepoIdentifier } from "../../src/lib/utils";

test("Repo identifier is 14 characters long and collision resistant", () => {
  const id1 = generateRepoIdentifier();
  const id2 = generateRepoIdentifier();

  // ids are 14 characters long in hex representation
  expect(id1).toMatch(/^[0-9a-f]+$/);
  expect(id2).toMatch(/^[0-9a-f]+$/);
  expect(id1).toHaveLength(14); 
  expect(id2).toHaveLength(14);
  expect(id1).not.toBe(id2);
});
