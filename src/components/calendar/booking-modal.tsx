"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

import { providersQuery } from "@/lib/queries/providers";
import { patientsQuery } from "@/lib/queries/patients";
import {
  bookAppointment,
  cancelAppointment,
  updateAppointment,
  deleteAppointment,
} from "@/server/actions/appointments";

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
import { AddPatientDialog } from "@/components/patients/add-patient-dialog";
import { Bell, CheckCircle2, Clock, XCircle, Plus, Pencil, Calendar } from "lucide-react";
import type { WorkflowEventInfo } from "@/lib/queries/appointments";

const PRESET_COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Red", value: "#ef4444" },
  { label: "Yellow", value: "#eab308" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
  { label: "Orange", value: "#f97316" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Gray", value: "#6b7280" },
  { label: "Indigo", value: "#6366f1" },
] as const;

const bookingFormSchema = z.object({
  patientId: z.string().uuid("Please select a patient"),
  providerId: z.string().uuid("Please select a provider"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  title: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
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
    color: string | null;
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
  const [deleting, setDeleting] = useState(false);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [editMode, setEditMode] = useState<"none" | "details" | "reschedule">("none");
  const [selectedColor, setSelectedColor] = useState(appointment?.color ?? "#3b82f6");
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
    setValue,
    watch,
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
      color: appointment?.color ?? "#3b82f6",
    },
  });

  const watchedColor = watch("color") || selectedColor;

  const onSubmit = useCallback(
    async (data: BookingFormData) => {
      setError(null);
      const formData = new FormData();
      if (appointment) formData.set("id", appointment.id);
      formData.set("patientId", data.patientId);
      formData.set("providerId", data.providerId);
      formData.set("startTime", new Date(data.startTime).toISOString());
      formData.set("endTime", new Date(data.endTime).toISOString());
      if (data.title) formData.set("title", data.title);
      if (data.notes) formData.set("notes", data.notes);
      formData.set("color", selectedColor);

      const result = appointment
        ? await updateAppointment(null, formData)
        : await bookAppointment(null, formData);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        reset();
        setError(null);
        setEditMode("none");
        onOpenChange(false);
        toast({
          title: appointment ? "Appointment updated" : "Appointment booked",
          type: "success",
        });
      } else {
        setError(result.error);
        toast({
          title: appointment ? "Update failed" : "Booking failed",
          description: result.error,
          type: "error",
        });
      }
    },
    [appointment, queryClient, reset, onOpenChange, toast, selectedColor],
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
      setEditMode("none");
      onOpenChange(false);
      toast({ title: "Appointment cancelled", type: "success" });
    } else {
      setError(result.error);
      toast({ title: "Cancellation failed", description: result.error, type: "error" });
    }
  }, [appointment, queryClient, onOpenChange, toast]);

  const handleDelete = useCallback(async () => {
    if (!appointment) return;
    setError(null);
    setDeleting(true);
    const result = await deleteAppointment(appointment.id);
    setDeleting(false);

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setError(null);
      setEditMode("none");
      onOpenChange(false);
      toast({ title: "Appointment deleted", type: "success" });
    } else {
      setError(result.error);
      toast({ title: "Delete failed", description: result.error, type: "error" });
    }
  }, [appointment, queryClient, onOpenChange, toast]);

  const handlePatientCreated = useCallback(
    (newPatientId: string) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setValue("patientId", newPatientId);
      toast({
        title: "Patient added",
        description: "New patient selected for booking.",
        type: "success",
      });
    },
    [queryClient, setValue, toast],
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      setSelectedColor(color);
      setValue("color", color);
    },
    [setValue],
  );

  const handleClose = useCallback(() => {
    reset();
    setError(null);
    setEditMode("none");
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const showProviderSelect =
    role === "ADMIN" || role === "RECEPTIONIST" || role === "PROVIDER" || isEdit;
  const canEdit = !isEdit || role === "ADMIN" || role === "RECEPTIONIST";
  const patientName =
    appointment && patients?.find((p) => p.id === appointment.patientId)?.user?.name;
  const providerName =
    appointment && providers?.find((p) => p.id === appointment.providerId)?.user?.name;

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

        {isEdit && editMode === "none" && appointment && (
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Appointment Details</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Patient:</span>
                <p className="font-medium">{patientName ?? appointment.patientId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Provider:</span>
                <p className="font-medium">{providerName ?? appointment.providerId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <p className="font-medium">
                  {format(new Date(appointment.startTime), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>
                <p className="font-medium">
                  {format(new Date(appointment.startTime), "h:mm a")} &ndash;{" "}
                  {format(new Date(appointment.endTime), "h:mm a")}
                </p>
              </div>
              {appointment.title && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Title:</span>
                  <p className="font-medium">{appointment.title}</p>
                </div>
              )}
              {appointment.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Notes:</span>
                  <p className="whitespace-pre-wrap text-sm">{appointment.notes}</p>
                </div>
              )}
            </div>
            {appointment.color && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <div
                  className="size-4 rounded-full border"
                  style={{ backgroundColor: appointment.color }}
                />
              </div>
            )}
          </div>
        )}

        {isEdit &&
          appointment.workflowEvents &&
          appointment.workflowEvents.length > 0 &&
          editMode === "none" && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Workflow Events</p>
              {appointment.workflowEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-2 text-xs">
                  {event.status === "DELIVERED" && (
                    <CheckCircle2 className="size-3 text-green-500" />
                  )}
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

        {/* Color Selection - shown in all edit modes */}
        {isEdit && canEdit && (
          <div className="space-y-2">
            <Label>Appointment Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => handleColorSelect(c.value)}
                  className={`size-7 rounded-full border-2 transition-all hover:scale-110 ${
                    watchedColor === c.value ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        )}

        {isEdit && canEdit && editMode === "none" && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue("startTime", appointment.startTime.slice(0, 16));
                setValue("endTime", appointment.endTime.slice(0, 16));
                setEditMode("reschedule");
              }}
            >
              <Calendar className="mr-1 size-4" />
              Reschedule
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setValue("notes", appointment.notes ?? "");
                setEditMode("details");
              }}
            >
              <Pencil className="mr-1 size-4" />
              Edit Details
            </Button>
          </div>
        )}

        {/* Edit form shown when creating, rescheduling, or editing details */}
        {(!isEdit || editMode !== "none") && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient</Label>
              <div className="flex gap-2">
                <select
                  id="patientId"
                  {...register("patientId")}
                  disabled={isEdit && editMode === "details"}
                  className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a patient...</option>
                  {patients?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.user.name}
                    </option>
                  ))}
                </select>
                {(!isEdit || canEdit) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setAddPatientOpen(true)}
                    title="Add new patient"
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
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
                  disabled={isEdit && editMode === "details"}
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

            {editMode !== "details" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input id="startTime" type="datetime-local" {...register("startTime")} />
                  {errors.startTime && (
                    <p className="text-xs text-destructive">{errors.startTime.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input id="endTime" type="datetime-local" {...register("endTime")} />
                  {errors.endTime && (
                    <p className="text-xs text-destructive">{errors.endTime.message}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. Follow-up visit"
                {...register("title")}
                disabled={isEdit && editMode === "reschedule"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Any additional notes..."
                {...register("notes")}
                disabled={isEdit && editMode === "reschedule"}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {!isEdit && (
              <div className="space-y-2">
                <Label>Appointment Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => handleColorSelect(c.value)}
                      className={`size-7 rounded-full border-2 transition-all hover:scale-110 ${
                        watchedColor === c.value
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {isEdit ? "Close" : "Cancel"}
              </Button>
              {isEdit && canEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Appointment"}
                </Button>
              )}
              {isEdit && canCancel && editMode === "none" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling..." : "Cancel Appointment"}
                </Button>
              )}
              {(!isEdit || (isEdit && editMode !== "none" && canEdit)) && (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Saving..."
                    : isEdit
                      ? editMode === "reschedule"
                        ? "Save Reschedule"
                        : editMode === "details"
                          ? "Save Details"
                          : "Save Changes"
                      : "Book Appointment"}
                </Button>
              )}
            </div>
          </form>
        )}

        {isEdit && editMode === "none" && (
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Close
            </Button>
            {canEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Appointment"}
              </Button>
            )}
            {canCancel && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel Appointment"}
              </Button>
            )}
          </div>
        )}

        <AddPatientDialog
          open={addPatientOpen}
          onOpenChange={setAddPatientOpen}
          onPatientCreated={handlePatientCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
