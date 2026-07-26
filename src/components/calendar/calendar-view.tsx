"use client";

import { useState, useCallback } from "react";
import { CalendarHeader } from "./calendar-header";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { DayView } from "./day-view";
import type { TentativeBooking } from "@/server/actions/booking-requests";

interface Appointment {
  id: string;
  title: string | null;
  color: string | null;
  status: string;
  startTime: string;
  endTime: string;
  patient: { user: { name: string; email: string } };
  provider: { user: { name: string; email: string } };
}

export type CalendarViewType = "week" | "month" | "day";

interface CalendarViewProps {
  appointments: Appointment[];
  tentativeBookings?: TentativeBooking[];
  onSlotClick?: (start: Date) => void;
  onAppointmentClick?: (id: string) => void;
  onTentativeClick?: (booking: TentativeBooking) => void;
  defaultView?: CalendarViewType;
  defaultDate?: Date;
}

export function CalendarView({
  appointments,
  tentativeBookings = [],
  onSlotClick,
  onAppointmentClick,
  onTentativeClick,
  defaultView = "month",
  defaultDate,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(defaultDate ?? new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleViewChange = useCallback((v: CalendarViewType) => {
    setView(v);
  }, []);

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onViewChange={handleViewChange}
        onDateChange={handleDateChange}
      />
      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          appointments={appointments}
          tentativeBookings={tentativeBookings}
          onSlotClick={onSlotClick}
          onAppointmentClick={onAppointmentClick}
          onTentativeClick={onTentativeClick}
        />
      )}
      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          appointments={appointments}
          tentativeBookings={tentativeBookings}
          onDayClick={(day) => {
            setCurrentDate(day);
            setView("day");
          }}
          onAppointmentClick={onAppointmentClick}
          onTentativeClick={onTentativeClick}
        />
      )}
      {view === "day" && (
        <DayView
          currentDate={currentDate}
          appointments={appointments}
          tentativeBookings={tentativeBookings}
          onSlotClick={onSlotClick}
          onAppointmentClick={onAppointmentClick}
          onTentativeClick={onTentativeClick}
        />
      )}
    </div>
  );
}
