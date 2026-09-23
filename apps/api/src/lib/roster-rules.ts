export const normalizeWeekdays = (weekdays: number[]): number[] =>
  [...new Set(weekdays)].sort((left, right) => left - right);

export const dateRangesOverlap = (
  leftStart: string,
  leftEnd: string | null,
  rightStart: string,
  rightEnd: string | null,
): boolean => leftStart <= (rightEnd ?? "9999-12-31") && rightStart <= (leftEnd ?? "9999-12-31");

export const weekdaysOverlap = (left: number[], right: number[]): boolean =>
  left.some((weekday) => right.includes(weekday));
