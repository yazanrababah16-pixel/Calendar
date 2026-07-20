"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { appointmentsQuery } from "@/lib/queries/appointments";
import { providersQuery } from "@/lib/queries/providers";
import { CalendarView } from "@/components/calendar/calendar-view";
import { BookingModal } from "@/components/calendar/booking-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAssignedProviders, getCurrentProvider } from "@/server/actions/providers";

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
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | undefined>();
  const [selectedProviderId, setSelectedProviderId] = useState<string | "">("");

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

  const providerFilter = useMemo(() => {
    if (role === "ADMIN") return undefined;
    if (role === "PROVIDER") return currentProviderResult?.id;
    if (role === "RECEPTIONIST" && selectedProviderId) return selectedProviderId;
    return undefined;
  }, [role, currentProviderResult, selectedProviderId]);

  const {
    data: appointments,
    isLoading,
    isError,
    error,
  } = useQuery(appointmentsQuery(providerFilter ? { providerId: providerFilter } : undefined));

  const scopedProviders = useMemo(() => {
    if (role === "ADMIN") return undefined;
    if (role === "PROVIDER") return currentProviderResult ? [currentProviderResult] : undefined;
    if (role === "RECEPTIONIST") return assignedResult;
    return undefined;
  }, [role, assignedResult, currentProviderResult]);

  const lockedProviderId = useMemo(() => {
    if (role === "PROVIDER") return currentProviderResult?.id;
    return undefined;
  }, [role, currentProviderResult]);

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

  const showProviderFilter = role === "RECEPTIONIST" && (assignedResult?.length ?? 0) > 1;

  const loading =
    role === "RECEPTIONIST"
      ? isLoading || !assignedResult
      : role === "PROVIDER"
        ? isLoading || !currentProviderResult
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
        <div className="text-sm text-muted-foreground">
          Showing schedule for{" "}
          <span className="font-medium text-foreground">{currentProviderResult.user.name}</span>
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
      />
      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultStart={selectedStart}
        appointment={selectedAppointment}
        scopedProviders={scopedProviders}
        lockedProviderId={lockedProviderId}
      />
    </div>
  );
}
