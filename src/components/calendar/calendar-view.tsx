"use client";

import { useState, useCallback } from "react";
import { CalendarHeader } from "./calendar-header";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";

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

interface CalendarViewProps {
  appointments: Appointment[];
  onSlotClick?: (start: Date) => void;
  onAppointmentClick?: (id: string) => void;
}

export function CalendarView({ appointments, onSlotClick, onAppointmentClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleViewChange = useCallback((v: "week" | "month") => {
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
      {view === "week" ? (
        <WeekView
          currentDate={currentDate}
          appointments={appointments}
          onSlotClick={onSlotClick}
          onAppointmentClick={onAppointmentClick}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          appointments={appointments}
          onDayClick={(day) => {
            setCurrentDate(day);
            setView("week");
          }}
          onAppointmentClick={onAppointmentClick}
        />
      )}
    </div>
  );
}
