"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appointmentsQuery } from "@/lib/queries/appointments";
import { CalendarView } from "@/components/calendar/calendar-view";
import { BookingModal } from "@/components/calendar/booking-modal";
import { Skeleton } from "@/components/ui/skeleton";

type AppointmentData = {
  id: string;
  patientId: string;
  providerId: string;
  startTime: string;
  endTime: string;
  title: string | null;
  notes: string | null;
  status: string;
};

export default function CalendarPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | undefined>();

  const { data: appointments, isLoading } = useQuery(appointmentsQuery());

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">View and manage appointments</p>
      </div>
      <CalendarView
        appointments={appointments ?? []}
        onSlotClick={(start) => {
          setSelectedAppointment(undefined);
          setSelectedStart(start.toISOString());
          setModalOpen(true);
        }}
        onAppointmentClick={(id) => {
          const appt = appointments?.find((a) => a.id === id);
          if (appt) {
            setSelectedAppointment(appt);
            setSelectedStart(undefined);
            setModalOpen(true);
          }
        }}
      />
      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultStart={selectedStart}
        appointment={selectedAppointment}
      />
    </div>
  );
}
