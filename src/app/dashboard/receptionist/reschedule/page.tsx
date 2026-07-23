"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  getRescheduleQueue,
  getSuggestedSlots,
  rescheduleAppointment,
} from "@/server/actions/appointments";
import { getCurrentProvider } from "@/server/actions/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CalendarOff,
  Loader2,
  User,
} from "lucide-react";
import { useToast } from "@/components/ui/toaster";

type AppointmentItem = {
  id: string;
  title: string | null;
  status: string;
  startTime: string | Date;
  endTime: string | Date;
  patient: { user: { name: string; email: string } };
  provider: { user: { name: string; email: string } };
};

type SuggestedSlot = {
  start: string;
  end: string;
  dayLabel: string;
};

function getDurationMinutes(start: string | Date, end: string | Date) {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return Math.round((e.getTime() - s.getTime()) / 60000);
}

function MiniCalendar({
  selectedDate,
  onDateSelect,
  providerId,
}: {
  selectedDate: Date;
  onDateSelect: (d: Date) => void;
  providerId: string;
}) {
  const [viewMonth, setViewMonth] = useState(selectedDate);
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
        >
          <ChevronLeft className="size-3" />
        </Button>
        <span className="text-xs font-medium">{format(viewMonth, "MMMM yyyy")}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
        >
          <ChevronRight className="size-3" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onDateSelect(day)}
            className={cn(
              "size-7 text-xs rounded-md flex items-center justify-center transition-colors hover:bg-accent",
              !isSameMonth(day, viewMonth) && "text-muted-foreground/40",
              isToday(day) && "bg-primary text-primary-foreground font-semibold",
              isSameDay(day, selectedDate) &&
                !isToday(day) &&
                "bg-accent text-accent-foreground ring-1 ring-ring",
            )}
          >
            {format(day, "d")}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReschedulePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      }
    >
      <ReschedulePageContent />
    </Suspense>
  );
}

function ReschedulePageContent() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dateParam = searchParams.get("date");
  const providerIdParam = searchParams.get("providerId");

  const [selectedAppt, setSelectedAppt] = useState<AppointmentItem | null>(null);
  const [manualDate, setManualDate] = useState<Date>(
    dateParam ? new Date(dateParam + "T12:00:00") : new Date(),
  );
  const [scheduling, setScheduling] = useState(false);

  const { data: currentProvider } = useQuery({
    queryKey: ["currentProvider"],
    queryFn: async () => {
      const result = await getCurrentProvider();
      if (!result.success) throw new Error(result.error);
      return result.provider;
    },
    enabled: role === "RECEPTIONIST",
  });

  const effectiveProviderId = useMemo(() => {
    if (providerIdParam) return providerIdParam;
    return currentProvider?.id;
  }, [providerIdParam, currentProvider]);

  const effectiveDate = dateParam ?? format(new Date(), "yyyy-MM-dd");

  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ["rescheduleQueue", effectiveProviderId, effectiveDate],
    queryFn: async () => {
      if (!effectiveProviderId) return [];
      const result = await getRescheduleQueue(effectiveProviderId, effectiveDate);
      if (!result.success) throw new Error(result.error);
      return result.appointments;
    },
    enabled: !!effectiveProviderId,
  });

  const duration = useMemo(() => {
    if (!selectedAppt) return 30;
    return getDurationMinutes(selectedAppt.startTime, selectedAppt.endTime);
  }, [selectedAppt]);

  const fromDate = useMemo(() => {
    return format(addDays(new Date(), 1), "yyyy-MM-dd");
  }, []);

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["suggestedSlots", effectiveProviderId, duration, fromDate],
    queryFn: async () => {
      if (!effectiveProviderId) return [];
      const result = await getSuggestedSlots(effectiveProviderId, duration, fromDate);
      if (!result.success) throw new Error(result.error);
      return result.slots;
    },
    enabled: !!effectiveProviderId && !!selectedAppt,
  });

  const handleReschedule = useCallback(
    async (slot: SuggestedSlot) => {
      if (!selectedAppt) return;
      setScheduling(true);
      try {
        const result = await rescheduleAppointment(selectedAppt.id, slot.start, slot.end);
        if (result.success) {
          toast({
            title: "Appointment rescheduled",
            description: `${selectedAppt.patient.user.name} moved to ${slot.dayLabel}`,
            type: "success",
          });
          setSelectedAppt(null);
          queryClient.invalidateQueries({ queryKey: ["rescheduleQueue"] });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        } else {
          toast({ title: "Failed", description: result.error, type: "error" });
        }
      } finally {
        setScheduling(false);
      }
    },
    [selectedAppt, queryClient, toast],
  );

  if (!effectiveProviderId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Reschedule Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">No provider selected</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <AlertCircle className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Access this page from a rescheduling notification.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reschedule Appointments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(new Date(effectiveDate + "T12:00:00"), "EEEE, MMMM d, yyyy")} — Provider schedule
        </p>
      </div>

      <div className="flex gap-4 min-h-[600px]">
        {/* LEFT PANEL — Queue */}
        <div className="w-[380px] shrink-0 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarOff className="size-4 text-amber-500" />
                Pending Reschedule
                {queue && queue.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {queue.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {queueLoading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : !queue || queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <CheckCircle2 className="size-10 text-green-500 mb-2" />
                  <p className="text-sm font-medium">All clear</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No appointments need rescheduling for this date.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {queue.map((appt) => {
                    const isSelected = selectedAppt?.id === appt.id;
                    return (
                      <button
                        key={appt.id}
                        type="button"
                        onClick={() => setSelectedAppt(isSelected ? null : appt)}
                        className={cn(
                          "w-full text-left rounded-lg p-3 transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                            : "hover:bg-accent border-transparent",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {format(new Date(appt.startTime), "h:mm a")} -{" "}
                            {format(new Date(appt.endTime), "h:mm a")}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {getDurationMinutes(appt.startTime, appt.endTime)}m
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="size-3 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">
                            {appt.patient.user.name}
                          </span>
                        </div>
                        {appt.title && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {appt.title}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL — Smart Rescheduler */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4 text-blue-500" />
                {selectedAppt
                  ? `Rescheduling: ${selectedAppt.patient.user.name}`
                  : "Select an appointment"}
              </CardTitle>
              {selectedAppt && (
                <p className="text-xs text-muted-foreground">
                  Duration: {duration} minutes — Original:{" "}
                  {format(new Date(selectedAppt.startTime), "EEE MMM d, h:mm a")}
                </p>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {!selectedAppt ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Click an appointment from the queue
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Available time slots will appear here
                  </p>
                </div>
              ) : suggestionsLoading ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Finding available slots...
                  </p>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Smart Suggestions */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">
                      Suggested Slots
                      {suggestions && suggestions.length > 0 && (
                        <span className="ml-1 text-green-600">
                          ({suggestions.length} available)
                        </span>
                      )}
                    </p>
                    {suggestions && suggestions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {suggestions.map((slot) => (
                          <Button
                            key={slot.start}
                            variant="outline"
                            className="justify-start h-auto py-3 px-4"
                            onClick={() => handleReschedule(slot)}
                            disabled={scheduling}
                          >
                            {scheduling ? (
                              <Loader2 className="size-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4 mr-2 text-green-500" />
                            )}
                            <div className="text-left">
                              <p className="text-sm font-medium">{slot.dayLabel}</p>
                            </div>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No available slots found in the next 2 weeks.
                      </p>
                    )}
                  </div>

                  {/* Mini Calendar for manual pick */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Or pick a date manually
                    </p>
                    <MiniCalendar
                      selectedDate={manualDate}
                      onDateSelect={setManualDate}
                      providerId={effectiveProviderId}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
