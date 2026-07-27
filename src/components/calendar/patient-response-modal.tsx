"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, addMinutes } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { patientAcceptBooking, patientRescheduleBooking } from "@/server/actions/booking-requests";
import type { TentativeBooking } from "@/server/actions/booking-requests";
import { CheckCircle2, Clock, Calendar, User, Loader2, AlertCircle, Pencil } from "lucide-react";

interface PatientResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: TentativeBooking | null;
}

function getDurationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export function PatientResponseModal({ open, onOpenChange, booking }: PatientResponseModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [loading, setLoading] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setMode("view");
    setError(null);
    setRescheduleDate("");
    setRescheduleTime("");
    onOpenChange(false);
  }, [onOpenChange]);

  const handleAccept = useCallback(async () => {
    if (!booking) return;
    setLoading(true);
    setError(null);
    try {
      const result = await patientAcceptBooking(booking.id);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["tentativeBookings"] });
        toast({
          title: "Appointment confirmed",
          description: "Your appointment has been scheduled.",
          type: "success",
        });
        handleClose();
      } else {
        setError(result.error);
        toast({ title: "Failed", description: result.error, type: "error" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      toast({ title: "Error", description: message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [booking, queryClient, toast, handleClose]);

  const handleRescheduleSubmit = useCallback(async () => {
    if (!booking || !rescheduleDate || !rescheduleTime) return;
    setLoading(true);
    setError(null);
    try {
      const startDT = new Date(`${rescheduleDate}T${rescheduleTime}`);
      const durationMs = getDurationMinutes(booking.start, booking.end) * 60000;
      const endDT = new Date(startDT.getTime() + durationMs);

      const result = await patientRescheduleBooking(booking.id, startDT, endDT);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["tentativeBookings"] });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        toast({
          title: "New time proposed",
          description: "Your new time has been sent for review.",
          type: "success",
        });
        handleClose();
      } else {
        setError(result.error);
        toast({ title: "Failed", description: result.error, type: "error" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      toast({ title: "Error", description: message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [booking, rescheduleDate, rescheduleTime, queryClient, toast, handleClose]);

  if (!booking) return null;

  const proposedStart = new Date(booking.start);
  const proposedEnd = new Date(booking.end);
  const durationMinutes = getDurationMinutes(booking.start, booking.end);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Action Required — Modified Appointment</DialogTitle>
          <DialogDescription>
            The receptionist has proposed a new time for your appointment. Please respond.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {mode === "view" && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className="border-dashed border-blue-400 bg-blue-50 text-blue-700"
                >
                  <AlertCircle className="size-3 mr-1" />
                  New Time Proposed
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="size-4 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-600/70">Provider</p>
                    <p className="font-medium">{booking.providerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-600/70">Proposed Date</p>
                    <p className="font-medium">{format(proposedStart, "EEE, MMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Clock className="size-4 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-600/70">Proposed Time</p>
                    <p className="font-medium">
                      {format(proposedStart, "h:mm a")} – {format(proposedEnd, "h:mm a")}
                      <span className="ml-2 text-xs text-blue-600/70">({durationMinutes} min)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const minDate = format(addMinutes(new Date(), 30), "yyyy-MM-dd");
                  const defaultDate = format(proposedStart, "yyyy-MM-dd");
                  setRescheduleDate(defaultDate >= minDate ? defaultDate : minDate);
                  setRescheduleTime(format(proposedStart, "HH:mm"));
                  setMode("reschedule");
                  setError(null);
                }}
              >
                <Pencil className="size-4 mr-2" />
                Propose Different Time
              </Button>
              <Button onClick={handleAccept} disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4 mr-2" />
                )}
                Accept New Time
              </Button>
            </div>
          </div>
        )}

        {mode === "reschedule" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Suggest a different time for your appointment:
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="reschedule-date" className="text-sm font-medium">
                  Date
                </label>
                <input
                  id="reschedule-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  min={format(addMinutes(new Date(), 30), "yyyy-MM-dd")}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="reschedule-time" className="text-sm font-medium">
                  Time
                </label>
                <input
                  id="reschedule-time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Duration: {durationMinutes} minutes. Your proposal will be sent back to the
              receptionist for review.
            </p>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setMode("view");
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleRescheduleSubmit}
                disabled={loading || !rescheduleDate || !rescheduleTime}
              >
                {loading ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="size-4 mr-2" />
                )}
                Submit New Time
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
