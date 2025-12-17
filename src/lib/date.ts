const TIME_UNITS = [
  { label: "minute", seconds: 60 },
  { label: "hour", seconds: 60 * 60 },
  { label: "day", seconds: 60 * 60 * 24 },
  { label: "week", seconds: 60 * 60 * 24 * 7 },
  { label: "month", seconds: 60 * 60 * 24 * 30 },
  { label: "year", seconds: 60 * 60 * 24 * 365 },
];

export function updatedTimeAgo(dateInput: string): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return `invalid date format: ${dateInput}`;

  const now = Date.now();
  const diffSeconds = Math.max(0, (now - date.getTime()) / 1000);

  for (let i = 0; i < TIME_UNITS.length; i++) {
    const current = TIME_UNITS[i];
    const next = TIME_UNITS[i + 1];

    if (!next || diffSeconds < next.seconds) {
      const value = Math.ceil(diffSeconds / current.seconds);
      return `updated ${value} ${current.label}${value !== 1 ? "s" : ""} ago`;
    }
  }

  return "updated a long time ago";
}
