"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { patientRequestReschedule } from "@/server/actions/appointments";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { CalendarClock, Loader2 } from "lucide-react";

export function RescheduleButton({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const result = await patientRequestReschedule(appointmentId);
      if (result.success) {
        toast({
          title: "Reschedule requested",
          description: "Your request has been sent to the front desk.",
          type: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      } else {
        toast({ title: "Failed", description: result.error, type: "error" });
      }
    } finally {
      setLoading(false);
    }
  }, [appointmentId, queryClient, toast]);

  if (!["SCHEDULED", "CONFIRMED"].includes(status)) return null;

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <CalendarClock className="size-3.5" />
      )}
      Request Reschedule
    </Button>
  );
}
