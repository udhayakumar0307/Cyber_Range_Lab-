/**
 * Parses a print-dialog-style range string ("1-4,7,9-12") into a Set of
 * the individual numbers it refers to. Invalid tokens are silently skipped.
 */
export function parseRangeSelection(input: string, maxValue: number): Set<number> {
  const result = new Set<number>();
  const tokens = input.split(',').map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= maxValue) result.add(i);
      }
      continue;
    }
    const single = parseInt(token, 10);
    if (!isNaN(single) && single >= 1 && single <= maxValue) {
      result.add(single);
    }
  }

  return result;
}
