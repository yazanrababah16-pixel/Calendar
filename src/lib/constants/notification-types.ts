import {
  CalendarOff,
  CalendarClock,
  MessageSquare,
  Clock,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

export interface NotificationTypeConfig {
  label: string;
  icon: LucideIcon;
  route: string;
  color: string;
}

export const NOTIFICATION_TYPES: Record<string, NotificationTypeConfig> = {
  leave_notification: {
    label: "Leave Request",
    icon: CalendarOff,
    route: "/dashboard/calendar",
    color: "text-amber-600",
  },
  reschedule_request: {
    label: "Reschedule Request",
    icon: CalendarClock,
    route: "/dashboard/receptionist/reschedule",
    color: "text-orange-600",
  },
  booking_request: {
    label: "Booking Request",
    icon: MessageSquare,
    route: "/dashboard/receptionist/requests",
    color: "text-blue-600",
  },
  patient_reschedule_request: {
    label: "Patient Reschedule",
    icon: Clock,
    route: "/dashboard",
    color: "text-purple-600",
  },
  emergency_cancellation: {
    label: "Emergency Cancellation",
    icon: ShieldAlert,
    route: "/dashboard/calendar",
    color: "text-red-600",
  },
};

export function getNotificationConfig(type: string): NotificationTypeConfig {
  return (
    NOTIFICATION_TYPES[type] ?? {
      label: type,
      icon: Clock,
      route: "/dashboard/notifications",
      color: "text-gray-600",
    }
  );
}
