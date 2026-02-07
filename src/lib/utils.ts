import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a new repo indentifier based on the current date and a random value.
 */
export function generateRepoIdentifier(): string {
  return Date.now().toString(16) + Math.random().toString(16).slice(2, 5);
}
