const DEPT_SHORT_CODES: Record<string, string> = {
  'computer science': 'CSE',
  'computer science & engineering': 'CSE',
  'cyber security': 'CYS',
  'information technology': 'IT',
  'artificial intelligence and data science': 'AIDS',
  'ai&ds': 'AIDS',
  'ai & ds': 'AIDS',
  'electronics and communication engineering': 'ECE',
  'ece': 'ECE',
  'electrical and electronics engineering': 'EEE',
  'eee': 'EEE',
  'mechanical': 'MECH',
  'mechanical engineering': 'MECH',
  'civil': 'CIVIL',
  'civil engineering': 'CIVIL',
};

export function getDeptShortCode(department?: string | null): string {
  if (!department) return '-';
  const trimmed = department.trim();
  const key = trimmed.toLowerCase();
  if (DEPT_SHORT_CODES[key]) return DEPT_SHORT_CODES[key];

  // Fallback: derive an acronym from capitalized words, e.g. "Data Science" -> "DS"
  const words = trimmed.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 2) {
    return words.map((w) => w[0].toUpperCase()).join('').slice(0, 5);
  }
  return trimmed.slice(0, 5).toUpperCase();
}
