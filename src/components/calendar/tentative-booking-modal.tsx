"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
import { Phone, User, Calendar, ExternalLink, Pencil } from "lucide-react";
import type { TentativeBooking } from "@/server/actions/booking-requests";
import { PatientResponseModal } from "./patient-response-modal";

interface TentativeBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: TentativeBooking | null;
}

const PENDING_STYLE = "border-dashed border-amber-400 bg-amber-50 text-amber-700";
const AWAITING_STYLE = "border-dashed border-blue-400 bg-blue-50 text-blue-700";

function getTentativeStyle(status: string): { label: string; className: string } {
  if (status === "AWAITING_PATIENT_REPLY") {
    return { label: "New Time Proposed", className: AWAITING_STYLE };
  }
  return { label: "Pending", className: PENDING_STYLE };
}

export function TentativeBookingModal({ open, onOpenChange, booking }: TentativeBookingModalProps) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [responseOpen, setResponseOpen] = useState(false);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenResponse = useCallback(() => {
    setResponseOpen(true);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCloseResponse = useCallback(() => {
    setResponseOpen(false);
  }, []);

  if (!booking) return null;

  const config = getTentativeStyle(booking.status);
  const startDate = new Date(booking.start);
  const endDate = new Date(booking.end);
  const isPatient = role === "PATIENT";
  const isAwaiting = booking.status === "AWAITING_PATIENT_REPLY";

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPatient && isAwaiting ? "Action Required" : "Pending Booking Request"}
            </DialogTitle>
            <DialogDescription>
              {isPatient && isAwaiting
                ? "The receptionist has proposed a new time. Please accept or propose a different time."
                : "This is a tentative booking. Approve or reject it from the requests page."}
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
              {isPatient && isAwaiting ? (
                <>
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={handleOpenResponse}>
                    <Pencil className="size-4 mr-2" />
                    Respond
                  </Button>
                </>
              ) : isPatient ? (
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Link href="/dashboard/receptionist/requests">
                    <Button>
                      <ExternalLink className="size-4 mr-2" />
                      Go to Requests
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isPatient && isAwaiting && (
        <PatientResponseModal
          open={responseOpen}
          onOpenChange={handleCloseResponse}
          booking={booking}
        />
      )}
    </>
  );
}
