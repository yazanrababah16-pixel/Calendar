"use client";

import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  parse,
} from "date-fns";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8);

interface Appointment {
  id: string;
  title: string | null;
  status: string;
  startTime: string;
  endTime: string;
  patient: { user: { name: string; email: string } };
  provider: { user: { name: string; email: string } };
}

interface WeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onSlotClick?: (start: Date) => void;
  onAppointmentClick?: (id: string) => void;
}

export function WeekView({
  currentDate,
  appointments,
  onSlotClick,
  onAppointmentClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  function getAppointmentsForDayAndHour(day: Date, hour: number) {
    return appointments.filter((apt) => {
      const start = new Date(apt.startTime);
      const end = new Date(apt.endTime);
      return isSameDay(start, day) && start.getHours() <= hour && end.getHours() > hour;
    });
  }

  const statusColors: Record<string, string> = {
    SCHEDULED: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
    CONFIRMED: "border-l-green-500 bg-green-50 dark:bg-green-950/30",
    IN_PROGRESS: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
    COMPLETED: "border-l-gray-500 bg-gray-50 dark:bg-gray-950/30",
    CANCELLED: "border-l-red-500 bg-red-50 dark:bg-red-950/30 opacity-60",
    NO_SHOW: "border-l-red-500 bg-red-50 dark:bg-red-950/30 opacity-60",
  };

  return (
    <div className="overflow-auto rounded-lg border">
      <div className="grid min-w-[700px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div className="sticky top-0 z-10 border-b bg-background" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "sticky top-0 z-10 border-b bg-background px-2 py-3 text-center",
              isToday(day) && "bg-accent",
            )}
          >
            <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
            <div
              className={cn(
                "mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day) && "bg-primary text-primary-foreground",
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}

        {HOURS.map((hour) => (
          <>
            <div
              key={`time-${hour}`}
              className="border-b border-r px-2 py-3 text-right text-xs text-muted-foreground"
            >
              {format(parse(String(hour), "H", new Date()), "ha")}
            </div>
            {days.map((day) => {
              const dayAppointments = getAppointmentsForDayAndHour(day, hour);
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={cn(
                    "relative min-h-[60px] border-b px-1 py-1 transition-colors hover:bg-accent/50 cursor-pointer",
                    isToday(day) && "bg-accent/20",
                  )}
                  onClick={() => {
                    const slotStart = new Date(day);
                    slotStart.setHours(hour, 0, 0, 0);
                    onSlotClick?.(slotStart);
                  }}
                >
                  {dayAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className={cn(
                        "mb-1 cursor-pointer rounded border-l-2 px-2 py-1 text-xs shadow-xs transition-colors hover:opacity-80",
                        statusColors[apt.status] ?? "border-l-gray-300",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick?.(apt.id);
                      }}
                    >
                      <div className="font-medium truncate">{apt.title || "Appointment"}</div>
                      <div className="truncate text-muted-foreground">
                        {format(new Date(apt.startTime), "h:mm a")} &middot; {apt.patient.user.name}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
