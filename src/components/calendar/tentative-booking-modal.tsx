"use client";

import { useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, User, Calendar, ExternalLink } from "lucide-react";
import type { TentativeBooking } from "@/server/actions/booking-requests";

interface TentativeBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: TentativeBooking | null;
}

const PENDING_STYLE = "border-dashed border-amber-400 bg-amber-50 text-amber-700";
const AWAITING_STYLE = "border-dashed border-blue-400 bg-blue-50 text-blue-700";

function getTentativeStyle(status: string): { label: string; className: string } {
  if (status === "AWAITING_PATIENT_REPLY") {
    return { label: "Awaiting Reply", className: AWAITING_STYLE };
  }
  return { label: "Pending", className: PENDING_STYLE };
}

export function TentativeBookingModal({ open, onOpenChange, booking }: TentativeBookingModalProps) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!booking) return null;

  const config = getTentativeStyle(booking.status);
  const startDate = new Date(booking.start);
  const endDate = new Date(booking.end);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pending Booking Request</DialogTitle>
          <DialogDescription>
            This is a tentative booking. Approve or reject it from the requests page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`rounded-lg border-2 border-dashed p-4 ${config.className}`}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className={config.className}>
                {config.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 opacity-70" />
                <div>
                  <p className="text-xs opacity-70">Phone</p>
                  <p className="font-medium">{booking.patientPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="size-4 shrink-0 opacity-70" />
                <div>
                  <p className="text-xs opacity-70">Patient</p>
                  <p className="font-medium">{booking.patientName ?? "Unknown"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 shrink-0 opacity-70" />
                <div>
                  <p className="text-xs opacity-70">Date & Time</p>
                  <p className="font-medium">{format(startDate, "EEE, MMM d, yyyy")}</p>
                  <p className="text-xs">
                    {format(startDate, "h:mm a")} – {format(endDate, "h:mm a")}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs opacity-70">Provider</p>
                <p className="font-medium">{booking.providerName}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Link href="/dashboard/receptionist/requests">
              <Button>
                <ExternalLink className="size-4 mr-2" />
                Go to Requests
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
