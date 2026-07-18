"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";

import { providersQuery } from "@/lib/queries/providers";
import { patientsQuery } from "@/lib/queries/patients";
import { bookAppointment, cancelAppointment } from "@/server/actions/appointments";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { Bell, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { WorkflowEventInfo } from "@/lib/queries/appointments";

const bookingFormSchema = z.object({
  patientId: z.string().uuid("Please select a patient"),
  providerId: z.string().uuid("Please select a provider"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  title: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

type BookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStart?: string;
  appointment?: {
    id: string;
    patientId: string;
    providerId: string;
    startTime: string;
    endTime: string;
    title: string | null;
    notes: string | null;
    status: string;
    workflowEvents?: WorkflowEventInfo[];
  };
};

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

export function BookingModal({ open, onOpenChange, defaultStart, appointment }: BookingModalProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  const { data: providers } = useQuery(providersQuery({ isActive: true }));
  const { data: patients } = useQuery(patientsQuery());

  const isEdit = !!appointment;
  const canCancel =
    appointment && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status);

  const defaultEnd = defaultStart
    ? new Date(new Date(defaultStart).getTime() + 60 * 60 * 1000).toISOString().slice(0, 16)
    : undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      patientId: appointment?.patientId ?? "",
      providerId: appointment?.providerId ?? session?.user?.id ?? "",
      startTime: appointment?.startTime.slice(0, 16) ?? defaultStart?.slice(0, 16) ?? "",
      endTime: appointment?.endTime.slice(0, 16) ?? defaultEnd ?? "",
      title: appointment?.title ?? "",
      notes: appointment?.notes ?? "",
    },
  });

  const onSubmit = useCallback(
    async (data: BookingFormData) => {
      setError(null);
      const formData = new FormData();
      formData.set("patientId", data.patientId);
      formData.set("providerId", data.providerId);
      formData.set("startTime", new Date(data.startTime).toISOString());
      formData.set("endTime", new Date(data.endTime).toISOString());
      if (data.title) formData.set("title", data.title);
      if (data.notes) formData.set("notes", data.notes);

      const result = await bookAppointment(null, formData);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        reset();
        setError(null);
        onOpenChange(false);
        toast({ title: "Appointment booked", type: "success" });
      } else {
        setError(result.error);
        toast({ title: "Booking failed", description: result.error, type: "error" });
      }
    },
    [queryClient, reset, onOpenChange, toast],
  );

  const handleCancel = useCallback(async () => {
    if (!appointment) return;
    setError(null);
    setCancelling(true);
    const result = await cancelAppointment(appointment.id);
    setCancelling(false);

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setError(null);
      onOpenChange(false);
      toast({ title: "Appointment cancelled", type: "success" });
    } else {
      setError(result.error);
      toast({ title: "Cancellation failed", description: result.error, type: "error" });
    }
  }, [appointment, queryClient, onOpenChange, toast]);

  const showProviderSelect = role === "ADMIN" || role === "RECEPTIONIST" || role === "PROVIDER";
  const canEdit = role === "ADMIN" || role === "RECEPTIONIST";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Appointment #${appointment.id.slice(0, 8)}` : "Book Appointment"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Status: ${statusLabels[appointment.status] ?? appointment.status}`
              : "Fill in the details to create a new appointment."}
          </DialogDescription>
          {isEdit && (
            <span
              className={`mt-1 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                statusColors[appointment.status] ?? "text-gray-600 bg-gray-100"
              }`}
            >
              {statusLabels[appointment.status] ?? appointment.status}
            </span>
          )}
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {isEdit && appointment.workflowEvents && appointment.workflowEvents.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">Workflow Events</p>
            {appointment.workflowEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-2 text-xs">
                {event.status === "DELIVERED" && <CheckCircle2 className="size-3 text-green-500" />}
                {event.status === "FAILED" && <XCircle className="size-3 text-red-500" />}
                {event.status === "PROCESSING" && <Clock className="size-3 text-amber-500" />}
                {(event.status === "PENDING" || !event.status) && (
                  <Bell className="size-3 text-muted-foreground" />
                )}
                <span className="capitalize">{event.workflowType.replace(/_/g, " ")}</span>
                <span
                  className={`ml-auto font-medium ${
                    event.status === "DELIVERED"
                      ? "text-green-600"
                      : event.status === "FAILED"
                        ? "text-red-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient</Label>
            <select
              id="patientId"
              {...register("patientId")}
              disabled={isEdit && !canEdit}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a patient...</option>
              {patients?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user.name}
                </option>
              ))}
            </select>
            {errors.patientId && (
              <p className="text-xs text-destructive">{errors.patientId.message}</p>
            )}
          </div>

          {showProviderSelect && (
            <div className="space-y-2">
              <Label htmlFor="providerId">Provider</Label>
              <select
                id="providerId"
                {...register("providerId")}
                disabled={isEdit && !canEdit}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a provider...</option>
                {providers?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user.name}
                  </option>
                ))}
              </select>
              {errors.providerId && (
                <p className="text-xs text-destructive">{errors.providerId.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="datetime-local"
                {...register("startTime")}
                disabled={isEdit && !canEdit}
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                {...register("endTime")}
                disabled={isEdit && !canEdit}
              />
              {errors.endTime && (
                <p className="text-xs text-destructive">{errors.endTime.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder="e.g. Follow-up visit"
              {...register("title")}
              disabled={isEdit && !canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Any additional notes..."
              {...register("notes")}
              disabled={isEdit && !canEdit}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setError(null);
                onOpenChange(false);
              }}
            >
              {isEdit ? "Close" : "Cancel"}
            </Button>
            {isEdit && canCancel && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel Appointment"}
              </Button>
            )}
            {(!isEdit || canEdit) && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Book Appointment"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
