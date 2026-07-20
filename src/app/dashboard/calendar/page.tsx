"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appointmentsQuery } from "@/lib/queries/appointments";
import { CalendarView } from "@/components/calendar/calendar-view";
import { BookingModal } from "@/components/calendar/booking-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

type AppointmentData = {
  id: string;
  patientId: string;
  providerId: string;
  startTime: string;
  endTime: string;
  title: string | null;
  notes: string | null;
  color: string | null;
  status: string;
};

export default function CalendarPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | undefined>();

  const { data: appointments, isLoading, isError, error } = useQuery(appointmentsQuery());

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">View and manage appointments</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <AlertCircle className="size-12 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load appointments</p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "An unexpected error occurred."}
            </p>
          </CardContent>
        </Card>
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
