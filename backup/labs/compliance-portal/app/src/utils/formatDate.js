export function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  // Intl throws RangeError on an invalid date, which takes down the whole page.
  // A field that does not hold a date should read as text, not crash the view.
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
