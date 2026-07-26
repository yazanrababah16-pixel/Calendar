"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { TentativeBooking } from "@/server/actions/booking-requests";

interface Appointment {
  id: string;
  title: string | null;
  color: string | null;
  status: string;
  startTime: string;
  patient: { user: { name: string } };
}

interface MonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  tentativeBookings?: TentativeBooking[];
  onDayClick?: (day: Date) => void;
  onAppointmentClick?: (id: string) => void;
  onTentativeClick?: (booking: TentativeBooking) => void;
}

const tentativeStatusStyles: Record<string, string> = {
  PENDING: "border-dashed border-amber-400 bg-amber-50 text-amber-800",
  AWAITING_PATIENT_REPLY: "border-dashed border-blue-400 bg-blue-50 text-blue-800",
};

export function MonthView({
  currentDate,
  appointments,
  tentativeBookings = [],
  onDayClick,
  onAppointmentClick,
  onTentativeClick,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function getAppointmentsForDay(day: Date) {
    return appointments.filter((apt) => isSameDay(new Date(apt.startTime), day));
  }

  function getTentativeForDay(day: Date) {
    return tentativeBookings.filter((b) => isSameDay(new Date(b.start), day));
  }

  const statusDot: Record<string, string> = {
    SCHEDULED: "bg-blue-500",
    CONFIRMED: "bg-green-500",
    IN_PROGRESS: "bg-amber-500",
    COMPLETED: "bg-gray-500",
    CANCELLED: "bg-red-300",
    NO_SHOW: "bg-red-300",
    NEEDS_RESCHEDULE: "bg-orange-400",
  };

  return (
    <div className="rounded-lg border">
      <div className="grid grid-cols-7 border-b">
        {dayNames.map((name) => (
          <div
            key={name}
            className="px-2 py-3 text-center text-xs font-medium text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayAppts = getAppointmentsForDay(day);
          const dayTentative = getTentativeForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const totalItems = dayAppts.length + dayTentative.length;
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[100px] border-b border-r px-1 py-2 transition-colors hover:bg-accent/50 cursor-pointer",
                !inMonth && "bg-muted/30 text-muted-foreground",
                isToday(day) && "bg-accent/20",
              )}
              onClick={() => onDayClick?.(day)}
            >
              <div
                className={cn(
                  "mb-1 flex size-7 items-center justify-center rounded-full text-sm",
                  isToday(day) && "bg-primary text-primary-foreground font-semibold",
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 2).map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 text-xs hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(apt.id);
                    }}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        apt.color ?? statusDot[apt.status] ?? "bg-gray-400",
                      )}
                      style={apt.color ? { backgroundColor: apt.color } : undefined}
                    />
                    <span className="truncate">
                      {format(new Date(apt.startTime), "h:mm")} {apt.patient.user.name}
                    </span>
                  </div>
                ))}
                {dayTentative.slice(0, 2).map((b) => (
                  <div
                    key={`tent-${b.id}`}
                    className={cn(
                      "flex items-center gap-1 cursor-pointer rounded border px-1 py-0.5 text-xs",
                      tentativeStatusStyles[b.status] ?? tentativeStatusStyles.PENDING,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTentativeClick?.(b);
                    }}
                  >
                    <span className="truncate font-medium">
                      {format(new Date(b.start), "h:mm")} {b.patientName ?? b.patientPhone}
                    </span>
                  </div>
                ))}
                {totalItems > 3 && (
                  <div className="pl-3 text-xs text-muted-foreground">+{totalItems - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
