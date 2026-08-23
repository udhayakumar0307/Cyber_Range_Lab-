/**
 * Point #10 assignment scheduling contract.
 *
 * datetime-local controls represent the user's browser-local wall clock.
 * Convert that wall clock to an explicit UTC ISO string before sending it.
 */

const pad2 = (value: number) => value.toString().padStart(2, '0');

export const getBrowserTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const localDateTimeToUtcIso = (
  date: string,
  time: string
): string => {
  const local = new Date(`${date}T${time}:00`);
  if (Number.isNaN(local.getTime())) {
    throw new Error('Invalid local date/time.');
  }
  return local.toISOString();
};

export const addMinutesUtcIso = (
  utcIso: string,
  minutes: number
): string => {
  const start = new Date(utcIso);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid UTC datetime.');
  }
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error('Duration must be greater than zero.');
  }
  return new Date(start.getTime() + minutes * 60_000).toISOString();
};

export const utcIsoToLocalInput = (
  utcIso: string
): { date: string; time: string } => {
  const value = new Date(utcIso);
  if (Number.isNaN(value.getTime())) {
    throw new Error('Invalid UTC datetime.');
  }

  return {
    date: `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`,
    time: `${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  };
};

export const formatUtcIsoLocal = (utcIso?: string | null): string => {
  if (!utcIso) return 'N/A';
  const value = new Date(utcIso);
  return Number.isNaN(value.getTime())
    ? utcIso
    : value.toLocaleString();
};
