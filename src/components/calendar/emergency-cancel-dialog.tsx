"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { AlertTriangle, Loader2 } from "lucide-react";
import { emergencyCancelDoctorDay } from "@/server/actions/appointments";
import { providersQuery } from "@/lib/queries/providers";

interface EmergencyCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProviderId?: string;
  defaultDate?: string;
}

export function EmergencyCancelDialog({
  open,
  onOpenChange,
  defaultProviderId,
  defaultDate,
}: EmergencyCancelDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [providerId, setProviderId] = useState(defaultProviderId ?? "");
  const [date, setDate] = useState(defaultDate ?? format(new Date(), "yyyy-MM-dd"));

  const { data: providers } = useQuery(providersQuery({ isActive: true }));

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await emergencyCancelDoctorDay(providerId, date);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      toast({
        title: "Emergency cancellation processed",
        description: `${data.flagged} appointments affected, ${data.notificationsSent} patients notified.`,
        type: "success",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Emergency cancellation failed",
        description: error.message,
        type: "error",
      });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!providerId || !date) return;
    mutation.mutate();
  }, [providerId, date, mutation]);

  const selectedProvider = providers?.find((p) => p.id === providerId);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!mutation.isPending) onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Emergency Cancel Doctor&apos;s Day
          </DialogTitle>
          <DialogDescription>
            This will cancel all scheduled appointments for the selected provider on the specified
            date and notify all affected patients.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mb-1 size-4" />
            <p className="font-medium">Warning</p>
            <p className="text-xs text-amber-700">
              This action will set all active appointments to &quot;Emergency Cancelled&quot;
              status. Affected patients will be notified that their appointment has been temporarily
              paused.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency-provider">Provider</Label>
            <select
              id="emergency-provider"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select a provider...</option>
              {providers?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user.name} — {p.specialty}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency-date">Date</Label>
            <input
              id="emergency-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {selectedProvider && (
            <p className="text-xs text-muted-foreground">
              Dr. {selectedProvider.user.name} — All active appointments on{" "}
              {date
                ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "the selected date"}{" "}
              will be affected.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleSubmit}
              disabled={!providerId || !date || mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-1 size-4" />
                  Confirm Emergency Cancellation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
