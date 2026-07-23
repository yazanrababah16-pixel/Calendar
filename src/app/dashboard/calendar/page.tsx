"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { appointmentsQuery } from "@/lib/queries/appointments";
import { CalendarView } from "@/components/calendar/calendar-view";
import { BookingModal } from "@/components/calendar/booking-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Filter, CalendarOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getAssignedProviders, getCurrentProvider } from "@/server/actions/providers";
import { getCurrentPatient, getMyLinkedProviders } from "@/server/actions/patient-linking";
import { cancelDayForProvider } from "@/server/actions/appointments";
import { useToast } from "@/components/ui/toaster";
import { format } from "date-fns";

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
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      }
    >
      <CalendarPageContent />
    </Suspense>
  );
}

function CalendarPageContent() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dateParam = searchParams.get("date");
  const defaultDate = dateParam ? new Date(dateParam + "T12:00:00") : undefined;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | undefined>();
  const [selectedProviderId, setSelectedProviderId] = useState<string | "">("");
  const [cancelDayOpen, setCancelDayOpen] = useState(false);
  const [cancelDayDate, setCancelDayDate] = useState<Date | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { data: assignedResult } = useQuery({
    queryKey: ["assignedProviders"],
    queryFn: async () => {
      const result = await getAssignedProviders();
      if (!result.success) throw new Error(result.error);
      return result.providers;
    },
    enabled: role === "RECEPTIONIST",
  });

  const { data: currentProviderResult } = useQuery({
    queryKey: ["currentProvider"],
    queryFn: async () => {
      const result = await getCurrentProvider();
      if (!result.success) throw new Error(result.error);
      return result.provider;
    },
    enabled: role === "PROVIDER",
  });

  const { data: patientResult } = useQuery({
    queryKey: ["currentPatient"],
    queryFn: async () => {
      const result = await getCurrentPatient();
      if (!result.success) throw new Error(result.error);
      return result.patient;
    },
    enabled: role === "PATIENT",
  });

  const { data: linkedProviders } = useQuery({
    queryKey: ["myLinkedProviders"],
    queryFn: async () => {
      const result = await getMyLinkedProviders();
      if (!result.success) throw new Error(result.error);
      return result.doctors;
    },
    enabled: role === "PATIENT",
  });

  const filter = useMemo(() => {
    if (role === "ADMIN") return undefined;
    if (role === "PROVIDER") return { providerId: currentProviderResult?.id };
    if (role === "RECEPTIONIST" && selectedProviderId) return { providerId: selectedProviderId };
    if (role === "PATIENT") return { patientId: patientResult?.id };
    return undefined;
  }, [role, currentProviderResult, selectedProviderId, patientResult]);

  const { data: appointments, isLoading, isError, error } = useQuery(appointmentsQuery(filter));

  const scopedProviders = useMemo(() => {
    if (role === "ADMIN") return undefined;
    if (role === "PROVIDER") return currentProviderResult ? [currentProviderResult] : undefined;
    if (role === "RECEPTIONIST") return assignedResult;
    if (role === "PATIENT") return linkedProviders;
    return undefined;
  }, [role, assignedResult, currentProviderResult, linkedProviders]);

  const lockedProviderId = useMemo(() => {
    if (role === "PROVIDER") return currentProviderResult?.id;
    return undefined;
  }, [role, currentProviderResult]);

  const lockedPatientId = useMemo(() => {
    if (role === "PATIENT") return patientResult?.id;
    return undefined;
  }, [role, patientResult]);

  const handleAppointmentClick = useCallback(
    (id: string) => {
      const appt = appointments?.find((a) => a.id === id);
      if (appt) {
        setSelectedAppointment(appt);
        setSelectedStart(undefined);
        setModalOpen(true);
      }
    },
    [appointments],
  );

  const handleCancelDay = useCallback(
    async (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      setCancelling(true);
      try {
        const result = await cancelDayForProvider(dateStr);
        if (result.success) {
          toast({
            title: "Rescheduling requested",
            description: `${result.flagged} appointment(s) flagged for rescheduling on ${format(date, "MMM d, yyyy")}.`,
            type: "success",
          });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          setCancelDayOpen(false);
          setCancelDayDate(null);
        } else {
          toast({ title: "Failed", description: result.error, type: "error" });
        }
      } finally {
        setCancelling(false);
      }
    },
    [queryClient, toast],
  );

  const showProviderFilter = role === "RECEPTIONIST" && (assignedResult?.length ?? 0) > 1;

  const loading =
    role === "RECEPTIONIST"
      ? isLoading || !assignedResult
      : role === "PROVIDER"
        ? isLoading || !currentProviderResult
        : role === "PATIENT"
          ? isLoading || !patientResult || !linkedProviders
          : isLoading;

  if (loading) {
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

      {showProviderFilter && (
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value as string)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All assigned providers</option>
            {assignedResult?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.user.name}
              </option>
            ))}
          </select>
          {assignedResult && assignedResult.length === 0 && (
            <p className="text-sm text-muted-foreground">No providers assigned to you yet.</p>
          )}
        </div>
      )}

      {role === "PROVIDER" && currentProviderResult && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing schedule for{" "}
            <span className="font-medium text-foreground">{currentProviderResult.user.name}</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setCancelDayDate(new Date());
              setCancelDayOpen(true);
            }}
          >
            <CalendarOff className="size-4" />
            Request Rescheduling
          </Button>
        </div>
      )}
      {role === "PATIENT" && linkedProviders && linkedProviders.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing appointments for your linked doctors
        </div>
      )}
      {role === "PATIENT" && linkedProviders?.length === 0 && (
        <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You are not linked to any doctors yet. Use the{" "}
          <a href="/dashboard" className="font-medium underline underline-offset-2">
            Dashboard
          </a>{" "}
          to link to a provider.
        </div>
      )}

      <CalendarView
        appointments={appointments ?? []}
        onSlotClick={(start) => {
          setSelectedAppointment(undefined);
          setSelectedStart(start.toISOString());
          setModalOpen(true);
        }}
        onAppointmentClick={handleAppointmentClick}
        defaultDate={defaultDate}
        defaultView={defaultDate ? "day" : "month"}
      />
      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultStart={selectedStart}
        appointment={selectedAppointment}
        scopedProviders={scopedProviders}
        lockedProviderId={lockedProviderId}
        lockedPatientId={lockedPatientId}
      />

      {role === "PROVIDER" && (
        <Dialog open={cancelDayOpen} onOpenChange={setCancelDayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Rescheduling</DialogTitle>
              <DialogDescription>
                This will flag all active appointments for the selected date as needing
                rescheduling. Receptionists and admins will be notified to handle it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={cancelDayDate ? format(cancelDayDate, "yyyy-MM-dd") : ""}
                  onChange={(e) =>
                    setCancelDayDate(e.target.value ? new Date(e.target.value + "T12:00:00") : null)
                  }
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCancelDayOpen(false)}
                  disabled={cancelling}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => cancelDayDate && handleCancelDay(cancelDayDate)}
                  disabled={!cancelDayDate || cancelling}
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CalendarOff className="size-4" />
                      Request Rescheduling
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
