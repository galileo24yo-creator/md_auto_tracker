import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function fuzzyMatch(text, target, threshold = 2) {
  const upperText = text.toUpperCase();
  const upperTarget = target.toUpperCase();
  
  if (upperText.includes(upperTarget)) return true;
  
  const words = upperText.split(/[\s\n]+/);
  for (const word of words) {
    if (word.length < Math.max(1, upperTarget.length - threshold)) continue;
    const distance = getLevenshteinDistance(word, upperTarget);
    if (distance <= threshold) return true;
  }
  
  return false;
}

export function fuzzyIncludes(text, target, maxDistance = 2) {
  const upperText = text.toUpperCase();
  const upperTarget = target.toUpperCase();
  if (upperText.includes(upperTarget)) return true;

  const tLen = upperTarget.length;
  for (let i = 0; i <= Math.max(0, upperText.length - tLen + maxDistance); i++) {
    for (let len = Math.max(1, tLen - maxDistance); len <= tLen + maxDistance; len++) {
      if (i + len > upperText.length) continue;
      const sub = upperText.substring(i, i + len);
      if (getLevenshteinDistance(sub, upperTarget) <= maxDistance) {
        return true;
      }
    }
  }
  return false;
}
