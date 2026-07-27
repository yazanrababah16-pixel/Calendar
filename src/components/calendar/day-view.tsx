"use client";

import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { TentativeBooking } from "@/server/actions/booking-requests";

interface Appointment {
  id: string;
  title: string | null;
  color: string | null;
  status: string;
  startTime: string;
  endTime: string;
  patient: { user: { name: string; email: string } };
}

interface DayViewProps {
  currentDate: Date;
  appointments: Appointment[];
  tentativeBookings?: TentativeBooking[];
  onSlotClick?: (start: Date) => void;
  onAppointmentClick?: (id: string) => void;
  onTentativeClick?: (booking: TentativeBooking) => void;
}

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  CONFIRMED: "bg-green-500",
  IN_PROGRESS: "bg-amber-500",
  COMPLETED: "bg-gray-500",
  CANCELLED: "bg-red-300",
  NO_SHOW: "bg-red-300",
  NEEDS_RESCHEDULE: "bg-orange-400",
  RESCHEDULE_REQUESTED: "bg-purple-500",
};

export function DayView({
  currentDate,
  appointments,
  tentativeBookings = [],
  onSlotClick,
  onAppointmentClick,
  onTentativeClick,
}: DayViewProps) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  const dayAppts = appointments.filter((apt) => isSameDay(new Date(apt.startTime), currentDate));
  const dayTentative = tentativeBookings.filter((b) => isSameDay(new Date(b.start), currentDate));

  function getApptForHour(hour: number) {
    return dayAppts.filter((apt) => {
      const start = new Date(apt.startTime);
      return start.getHours() === hour;
    });
  }

  function getTentativeForHour(hour: number) {
    return dayTentative.filter((b) => {
      const start = new Date(b.start);
      return start.getHours() === hour;
    });
  }

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{format(currentDate, "EEEE, MMMM d, yyyy")}</h3>
        <p className="text-xs text-muted-foreground">
          {dayAppts.length} appointment(s), {dayTentative.length} pending
        </p>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {hours.map((hour) => {
          const slotAppts = getApptForHour(hour);
          const slotTentative = getTentativeForHour(hour);
          return (
            <div
              key={hour}
              className="flex border-b last:border-0 min-h-[60px] cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => {
                const d = new Date(currentDate);
                d.setHours(hour, 0, 0, 0);
                onSlotClick?.(d);
              }}
            >
              <div className="w-16 shrink-0 border-r px-2 py-2 text-xs text-muted-foreground text-right">
                {format(new Date(2024, 0, 1, hour), "h:mm a")}
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {slotAppts.map((apt) => (
                  <div
                    key={apt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(apt.id);
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity",
                      apt.color ? "" : (statusColor[apt.status] ?? "bg-gray-400"),
                    )}
                    style={apt.color ? { backgroundColor: apt.color } : undefined}
                  >
                    <p className="font-medium text-white truncate">{apt.title || "Appointment"}</p>
                    <p className="text-white/80 truncate">{apt.patient.user.name}</p>
                    <p className="text-white/60 text-[10px]">
                      {format(new Date(apt.startTime), "h:mm a")} -{" "}
                      {format(new Date(apt.endTime), "h:mm a")}
                    </p>
                  </div>
                ))}
                {slotTentative.map((b) => (
                  <div
                    key={`tent-${b.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTentativeClick?.(b);
                    }}
                    className={cn(
                      "rounded-md border-2 border-dashed px-2.5 py-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity",
                      b.status === "AWAITING_PATIENT_REPLY"
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                        : "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
                    )}
                  >
                    <p className="font-medium truncate">{b.patientName ?? b.patientPhone}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {format(new Date(b.start), "h:mm a")} - {format(new Date(b.end), "h:mm a")}{" "}
                      &middot; Pending
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
