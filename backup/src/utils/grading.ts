// Mirrors backend/app/services/grade_scale.py — keep both in sync.
// Higher band wins at an exact boundary (e.g. exactly 90 -> "O", not "A+").
const GRADE_BANDS: [number, string][] = [
  [90, 'O'],
  [80, 'A+'],
  [70, 'A'],
  [60, 'B+'],
  [50, 'B'],
  [40, 'C'],
];

const FAIL_GRADE = 'R';

export function getLetterGrade(percent: number | null | undefined): string | null {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return null;
  for (const [threshold, grade] of GRADE_BANDS) {
    if (percent >= threshold) return grade;
  }
  return FAIL_GRADE;
}

// Tailwind classes for a small grade badge, consistent across admin + student pages.
export function getGradeColor(grade: string | null | undefined): string {
  switch (grade) {
    case 'O':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800';
    case 'A+':
    case 'A':
      return 'text-[#0052CC] bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800';
    case 'B+':
    case 'B':
      return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800';
    case 'C':
      return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800';
    case 'R':
      return 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-800';
    default:
      return 'text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800/60 dark:border-slate-700';
  }
}
