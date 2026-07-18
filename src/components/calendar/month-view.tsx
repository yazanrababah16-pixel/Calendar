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

interface Appointment {
  id: string;
  title: string | null;
  status: string;
  startTime: string;
  patient: { user: { name: string } };
}

interface MonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onDayClick?: (day: Date) => void;
  onAppointmentClick?: (id: string) => void;
}

export function MonthView({
  currentDate,
  appointments,
  onDayClick,
  onAppointmentClick,
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

  const statusDot: Record<string, string> = {
    SCHEDULED: "bg-blue-500",
    CONFIRMED: "bg-green-500",
    IN_PROGRESS: "bg-amber-500",
    COMPLETED: "bg-gray-500",
    CANCELLED: "bg-red-300",
    NO_SHOW: "bg-red-300",
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
          const inMonth = isSameMonth(day, currentDate);
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
                {dayAppts.slice(0, 3).map((apt) => (
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
                        statusDot[apt.status] ?? "bg-gray-400",
                      )}
                    />
                    <span className="truncate">
                      {format(new Date(apt.startTime), "h:mm")} {apt.patient.user.name}
                    </span>
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <div className="pl-3 text-xs text-muted-foreground">
                    +{dayAppts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
