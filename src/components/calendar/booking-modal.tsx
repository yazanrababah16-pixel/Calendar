"use client";

import { useCallback, useEffect, useState } from "react";
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
import { GenerateInvoiceDialog } from "@/components/billing/generate-invoice-dialog";
import { getInvoiceByAppointment } from "@/server/actions/billing";
import { getMedicalRecord, addMedicalRecord } from "@/server/actions/clinical";
import {
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Pencil,
  Calendar,
  Receipt,
  Stethoscope,
} from "lucide-react";
import type { WorkflowEventInfo } from "@/lib/queries/appointments";

function toLocalDatetimeString(utcIso: string): string {
  const d = new Date(utcIso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

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
  rescheduleReason: z.string().max(2000).optional().or(z.literal("")),
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
  scopedProviders?: Array<{ id: string; user: { name: string; email: string } }>;
  lockedProviderId?: string;
  lockedPatientId?: string;
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
  NEEDS_RESCHEDULE: "text-orange-600 bg-orange-50",
};

export function BookingModal({
  open,
  onOpenChange,
  defaultStart,
  appointment,
  scopedProviders,
  lockedProviderId,
  lockedPatientId,
}: BookingModalProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [editMode, setEditMode] = useState<"none" | "reschedule" | "full">("none");
  const [generateInvoiceOpen, setGenerateInvoiceOpen] = useState(false);
  const [emrOpen, setEmrOpen] = useState(false);
  const [emrForm, setEmrForm] = useState({ diagnosis: "", prescription: "", notes: "" });
  const [emrSubmitting, setEmrSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: invoiceData } = useQuery({
    queryKey: ["appointmentInvoice", appointment?.id],
    queryFn: async () => {
      if (!appointment) return null;
      const result = await getInvoiceByAppointment(appointment.id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!appointment && editMode === "none",
  });

  const { data: medicalRecord } = useQuery({
    queryKey: ["medicalRecord", appointment?.id],
    queryFn: async () => {
      if (!appointment) return null;
      const result = await getMedicalRecord(appointment.id);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!appointment && emrOpen,
  });

  const { data: allProviders } = useQuery(providersQuery({ isActive: true }));
  const { data: patients } = useQuery(patientsQuery());

  const providers = scopedProviders ?? allProviders;

  const isEdit = !!appointment;
  const canCancel =
    appointment && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status);
  const canEdit = !isEdit || role === "ADMIN" || role === "RECEPTIONIST";

  const defaultEnd = defaultStart
    ? toLocalDatetimeString(
        new Date(new Date(defaultStart).getTime() + 60 * 60 * 1000).toISOString(),
      )
    : undefined;

  const buildFormDefaults = useCallback(
    (): BookingFormData => ({
      patientId: lockedPatientId ?? appointment?.patientId ?? "",
      providerId: lockedProviderId ?? appointment?.providerId ?? "",
      startTime: appointment?.startTime
        ? toLocalDatetimeString(appointment.startTime)
        : defaultStart
          ? toLocalDatetimeString(defaultStart)
          : "",
      endTime: appointment?.endTime
        ? toLocalDatetimeString(appointment.endTime)
        : (defaultEnd ?? ""),
      title: appointment?.title ?? "",
      notes: appointment?.notes ?? "",
      color: appointment?.color ?? "#3b82f6",
      rescheduleReason: "",
    }),
    [appointment, defaultStart, defaultEnd, lockedProviderId, lockedPatientId],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: buildFormDefaults(),
  });

  useEffect(() => {
    if (open) {
      setEditMode("none");
      setError(null);
      setCancelling(false);
      setDeleting(false);
      reset(buildFormDefaults());
    }
  }, [open, reset, buildFormDefaults]);

  const watchedColor = watch("color") || "#3b82f6";

  const patientName =
    appointment && patients?.find((p) => p.id === appointment.patientId)?.user?.name;
  const providerName =
    appointment && providers?.find((p) => p.id === appointment.providerId)?.user?.name;

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

      let notes = data.notes ?? "";
      if (data.rescheduleReason) {
        const prefix = notes ? `${notes}\n---\n` : "";
        notes = `${prefix}Rescheduled: ${data.rescheduleReason}`;
      }
      if (notes) formData.set("notes", notes);

      formData.set("color", data.color || "#3b82f6");

      const result = appointment
        ? await updateAppointment(null, formData)
        : await bookAppointment(null, formData);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
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
    [appointment, queryClient, onOpenChange, toast],
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

  const handleEmrSubmit = useCallback(async () => {
    if (!appointment) return;
    setEmrSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.set("appointmentId", appointment.id);
    formData.set("diagnosis", emrForm.diagnosis);
    formData.set("prescription", emrForm.prescription);
    formData.set("notes", emrForm.notes);
    const result = await addMedicalRecord(formData);
    setEmrSubmitting(false);
    if (result.success) {
      toast({ title: "Medical record saved", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["medicalRecord"] });
      setEmrOpen(false);
    } else {
      toast({ title: "Error", description: result.error, type: "error" });
    }
  }, [appointment, emrForm, queryClient, toast]);

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

  const handleClose = useCallback(() => {
    setError(null);
    setEditMode("none");
    onOpenChange(false);
  }, [onOpenChange]);

  const handleRescheduleClick = useCallback(() => {
    setEditMode("reschedule");
  }, []);

  const handleFullEditClick = useCallback(() => {
    setEditMode("full");
  }, []);

  const handleBack = useCallback(() => {
    setEditMode("none");
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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

        {/* ─── View Mode: Read-only details ─── */}
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

        {/* ─── View Mode Action Buttons ─── */}
        {isEdit && canEdit && editMode === "none" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRescheduleClick}>
              <Calendar className="mr-1 size-4" />
              Reschedule
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleFullEditClick}>
              <Pencil className="mr-1 size-4" />
              Edit Details
            </Button>
            {(role === "ADMIN" || role === "RECEPTIONIST") &&
              (invoiceData ? (
                <a
                  href="/dashboard/billing"
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Receipt className="size-4" />
                  View Invoice
                </a>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGenerateInvoiceOpen(true)}
                >
                  <Receipt className="mr-1 size-4" />
                  Generate Invoice
                </Button>
              ))}
            {(role === "PROVIDER" || role === "ADMIN") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmrOpen(true);
                  setEmrForm({ diagnosis: "", prescription: "", notes: "" });
                }}
              >
                <Stethoscope className="mr-1 size-4" />
                Clinical Notes
              </Button>
            )}
          </div>
        )}

        {/* ─── Reschedule Mode ─── */}
        {isEdit && editMode === "reschedule" && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Patient:</span>{" "}
                <span className="font-medium">{patientName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Provider:</span>{" "}
                <span className="font-medium">{providerName}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="re-startTime">Start Time</Label>
                <Input id="re-startTime" type="datetime-local" {...register("startTime")} />
                {errors.startTime && (
                  <p className="text-xs text-destructive">{errors.startTime.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="re-endTime">End Time</Label>
                <Input id="re-endTime" type="datetime-local" {...register("endTime")} />
                {errors.endTime && (
                  <p className="text-xs text-destructive">{errors.endTime.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="re-reason">Reschedule Reason (optional)</Label>
              <textarea
                id="re-reason"
                rows={3}
                placeholder="Reason for rescheduling..."
                {...register("rescheduleReason")}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This will be appended to the appointment notes.
              </p>
            </div>

            <input type="hidden" {...register("patientId")} />
            <input type="hidden" {...register("providerId")} />
            <input type="hidden" {...register("title")} />
            <input type="hidden" {...register("notes")} />
            <input type="hidden" {...register("color")} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Reschedule"}
              </Button>
            </div>
          </form>
        )}

        {/* ─── Full Edit / New Appointment Mode ─── */}
        {((isEdit && editMode === "full") || !isEdit) && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {lockedPatientId ? (
              <input type="hidden" {...register("patientId")} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient</Label>
                <div className="flex gap-2">
                  <select
                    id="patientId"
                    {...register("patientId")}
                    className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            )}

            {lockedProviderId ? (
              <input type="hidden" {...register("providerId")} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="providerId">Provider</Label>
                <select
                  id="providerId"
                  {...register("providerId")}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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

            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input id="title" placeholder="e.g. Follow-up visit" {...register("title")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Any additional notes..."
                {...register("notes")}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Appointment Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setValue("color", c.value)}
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

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={isEdit ? handleBack : handleClose}>
                {isEdit ? "Back" : "Cancel"}
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Book Appointment"}
              </Button>
            </div>
          </form>
        )}

        {/* ─── View Mode Footer Buttons ─── */}
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
        {appointment && (
          <GenerateInvoiceDialog
            open={generateInvoiceOpen}
            onOpenChange={setGenerateInvoiceOpen}
            appointmentId={appointment.id}
            onInvoiceCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["appointmentInvoice"] });
            }}
          />
        )}

        {/* ─── EMR / Clinical Notes Modal ─── */}
        {appointment && (
          <Dialog open={emrOpen} onOpenChange={setEmrOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clinical Notes</DialogTitle>
                <DialogDescription>
                  {new Date(appointment.startTime).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" — "}
                  {format(new Date(appointment.startTime), "h:mm a")}
                </DialogDescription>
              </DialogHeader>

              {medicalRecord && !emrForm.diagnosis && !emrForm.prescription && !emrForm.notes && (
                <div className="rounded-lg border p-4 space-y-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Diagnosis</span>
                    <p className="mt-0.5">{medicalRecord.diagnosis || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Prescription</span>
                    <p className="mt-0.5 whitespace-pre-wrap">
                      {medicalRecord.prescription || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Notes</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{medicalRecord.notes || "—"}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Recorded by Dr. {medicalRecord.provider.user.name} on{" "}
                    {new Date(medicalRecord.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}

              {(role === "PROVIDER" || role === "ADMIN") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emr-diagnosis">Diagnosis</Label>
                    <Input
                      id="emr-diagnosis"
                      placeholder="e.g. Acute sinusitis"
                      value={emrForm.diagnosis}
                      onChange={(e) => setEmrForm((f) => ({ ...f, diagnosis: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emr-prescription">Prescription</Label>
                    <textarea
                      id="emr-prescription"
                      rows={3}
                      placeholder="e.g. Amoxicillin 500mg — 3x daily for 7 days"
                      value={emrForm.prescription}
                      onChange={(e) => setEmrForm((f) => ({ ...f, prescription: e.target.value }))}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emr-notes">Additional Notes</Label>
                    <textarea
                      id="emr-notes"
                      rows={3}
                      placeholder="Any additional observations..."
                      value={emrForm.notes}
                      onChange={(e) => setEmrForm((f) => ({ ...f, notes: e.target.value }))}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setEmrOpen(false)}>
                      Close
                    </Button>
                    <Button onClick={handleEmrSubmit} disabled={emrSubmitting}>
                      {emrSubmitting
                        ? "Saving..."
                        : medicalRecord
                          ? "Update Record"
                          : "Save Record"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
