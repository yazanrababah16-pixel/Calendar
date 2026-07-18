import {
  format,
  formatDistanceToNow,
  isBefore,
  isAfter,
  isToday,
  isTomorrow,
  addHours,
  differenceInMinutes,
  differenceInHours,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";

export function formatAppointmentDate(iso: string): string {
  return format(parseISO(iso), "EEE, MMM d, yyyy");
}

export function formatAppointmentTime(iso: string): string {
  return format(parseISO(iso), "h:mm a");
}

export function formatAppointmentDateTime(iso: string): string {
  return `${formatAppointmentDate(iso)} at ${formatAppointmentTime(iso)}`;
}

export function isUpcoming(iso: string): boolean {
  return isAfter(parseISO(iso), new Date());
}

export function isPast(iso: string): boolean {
  return isBefore(parseISO(iso), new Date());
}

export function getRelativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

export function getDayLabel(iso: string): string {
  const date = parseISO(iso);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE");
}

export function getDurationMinutes(startIso: string, endIso: string): number {
  return differenceInMinutes(parseISO(endIso), parseISO(startIso));
}

export function getDurationHours(startIso: string, endIso: string): number {
  return differenceInHours(parseISO(endIso), parseISO(startIso));
}

export function getAppointmentTimeRange(startIso: string, endIso: string): string {
  return `${formatAppointmentTime(startIso)} - ${formatAppointmentTime(endIso)}`;
}

export function isWithinNext24Hours(iso: string): boolean {
  const date = parseISO(iso);
  const now = new Date();
  const tomorrow = addHours(now, 24);
  return isAfter(date, now) && isBefore(date, tomorrow);
}

export function getStartOfDay(iso: string): Date {
  return startOfDay(parseISO(iso));
}

export function getEndOfDay(iso: string): Date {
  return endOfDay(parseISO(iso));
}

export function isOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = parseISO(startA);
  const eA = parseISO(endA);
  const sB = parseISO(startB);
  const eB = parseISO(endB);
  return isBefore(sA, eB) && isBefore(sB, eA);
}

export function generateTimeSlots(
  date: Date,
  startHour: number,
  endHour: number,
  durationMinutes: number,
): string[] {
  const slots: string[] = [];
  const current = new Date(date);
  current.setHours(startHour, 0, 0, 0);
  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);

  while (isBefore(current, end)) {
    slots.push(current.toISOString());
    current.setMinutes(current.getMinutes() + durationMinutes);
  }
  return slots;
}
