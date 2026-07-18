"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { appointmentsQuery } from "@/lib/queries/appointments";
import { BookingModal } from "@/components/calendar/booking-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, User, Stethoscope } from "lucide-react";

const statusLabels: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

const statusColors: Record<string, string> = {
  SCHEDULED: "text-blue-600 bg-blue-50",
  CONFIRMED: "text-green-600 bg-green-50",
  IN_PROGRESS: "text-amber-600 bg-amber-50",
  COMPLETED: "text-gray-600 bg-gray-100",
  CANCELLED: "text-red-600 bg-red-50",
  NO_SHOW: "text-red-600 bg-red-50",
};

export default function AppointmentsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [modalOpen, setModalOpen] = useState(false);

  const isPatient = role === "PATIENT";
  const filters = isPatient ? { patientId: session?.user?.id } : undefined;
  const { data: appointments, isLoading } = useQuery(appointmentsQuery(filters));

  const upcoming = appointments?.filter(
    (a) => !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(a.status),
  );
  const past = appointments?.filter((a) =>
    ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(a.status),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPatient ? "Your appointments" : "Manage all appointments"}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-1 size-4" />
          New Appointment
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {upcoming && upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.map((apt) => (
                <Card key={apt.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1.5">
                      <p className="font-medium">{apt.title ?? "Appointment"}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="size-3.5" />
                        {new Date(apt.startTime).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {new Date(apt.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {new Date(apt.endTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {isPatient ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Stethoscope className="size-3.5" />
                          {apt.provider.user.name}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="size-3.5" />
                          {apt.patient.user.name}
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[apt.status] ?? "text-gray-600 bg-gray-100"
                      }`}
                    >
                      {statusLabels[apt.status] ?? apt.status}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {past && past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Past ({past.length})</h2>
              {past.map((apt) => (
                <Card key={apt.id}>
                  <CardContent className="flex items-center justify-between p-4 opacity-60">
                    <div className="space-y-1.5">
                      <p className="font-medium">{apt.title ?? "Appointment"}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="size-3.5" />
                        {new Date(apt.startTime).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {new Date(apt.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {isPatient ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Stethoscope className="size-3.5" />
                          {apt.provider.user.name}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="size-3.5" />
                          {apt.patient.user.name}
                        </div>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[apt.status] ?? "text-gray-600 bg-gray-100"
                      }`}
                    >
                      {statusLabels[apt.status] ?? apt.status}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {(!appointments || appointments.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12">
                <Clock className="size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No appointments found</p>
                <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
                  Book your first appointment
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <BookingModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
