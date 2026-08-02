import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarClock,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

export const statusLabels: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
  NEEDS_RESCHEDULE: "Needs Reschedule",
  RESCHEDULE_REQUESTED: "Reschedule Requested",
  EMERGENCY_CANCELLED: "Emergency Cancelled",
};

export const statusColors: Record<string, string> = {
  SCHEDULED: "text-blue-600 bg-blue-50",
  CONFIRMED: "text-green-600 bg-green-50",
  IN_PROGRESS: "text-amber-600 bg-amber-50",
  COMPLETED: "text-gray-600 bg-gray-100",
  CANCELLED: "text-red-600 bg-red-50",
  NO_SHOW: "text-red-600 bg-red-50",
  NEEDS_RESCHEDULE: "text-orange-600 bg-orange-50",
  RESCHEDULE_REQUESTED: "text-purple-600 bg-purple-50",
  EMERGENCY_CANCELLED: "text-red-700 bg-red-100",
};

export const statusBadgeStyles: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  CONFIRMED: "bg-green-100 text-green-700 border-green-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  COMPLETED: "bg-gray-100 text-gray-600 border-gray-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  NO_SHOW: "bg-red-100 text-red-700 border-red-200",
  NEEDS_RESCHEDULE: "bg-orange-100 text-orange-700 border-orange-200",
  RESCHEDULE_REQUESTED: "bg-purple-100 text-purple-700 border-purple-200",
  EMERGENCY_CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

export const statusIcons: Record<string, LucideIcon> = {
  SCHEDULED: Clock,
  CONFIRMED: CheckCircle2,
  IN_PROGRESS: AlertTriangle,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  NO_SHOW: XCircle,
  NEEDS_RESCHEDULE: AlertTriangle,
  RESCHEDULE_REQUESTED: CalendarClock,
  EMERGENCY_CANCELLED: ShieldAlert,
};
