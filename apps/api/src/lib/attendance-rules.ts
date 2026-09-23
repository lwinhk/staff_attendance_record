export interface AttendanceCalculationInput {
  submittedStatus: "present" | "absent";
  startedAt: string | null;
  endedAt: string | null;
  normalDailyMinutes: number;
}

export interface AttendanceCalculation {
  state: "present" | "absent" | "incomplete";
  calculatedEndAt: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  usedCalculatedEnd: boolean;
}

export const calculateAttendance = (input: AttendanceCalculationInput): AttendanceCalculation => {
  if (input.submittedStatus === "absent" || !input.startedAt) return { state: "absent", calculatedEndAt: null, workedMinutes: 0, overtimeMinutes: 0, usedCalculatedEnd: false };
  const start = new Date(input.startedAt);
  const calculatedEnd = input.endedAt ? new Date(input.endedAt) : new Date(start.getTime() + input.normalDailyMinutes * 60_000);
  const workedMinutes = Math.max(0, Math.floor((calculatedEnd.getTime() - start.getTime()) / 60_000));
  return {
    state: input.endedAt ? "present" : "incomplete",
    calculatedEndAt: calculatedEnd.toISOString(),
    workedMinutes,
    overtimeMinutes: input.endedAt ? Math.max(0, workedMinutes - input.normalDailyMinutes) : 0,
    usedCalculatedEnd: !input.endedAt,
  };
};
