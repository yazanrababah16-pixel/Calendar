"use client";

import { Suspense, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getBookingRequests,
  approveBookingRequest,
  rejectBookingRequest,
  modifyBookingRequest,
} from "@/server/actions/booking-requests";
import { getSuggestedSlots } from "@/server/actions/appointments";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Phone,
  User,
  Calendar,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { CreatePatientModal } from "@/components/patients/create-patient-modal";

type BookingRequestItem = {
  id: string;
  patientPhone: string;
  patientName: string | null;
  requestedDate: Date;
  requestedTime: string;
  durationMinutes: number;
  message: string | null;
  status: string;
  rejectionReason: string | null;
  modifiedStart: Date | null;
  modifiedEnd: Date | null;
  createdAt: Date;
  provider: { id: string; user: { name: string } };
  patient: { id: string; user: { name: string } } | null;
  patientId: string | null;
};

export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      }
    >
      <RequestsPageContent />
    </Suspense>
  );
}

function RequestsPageContent() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedRequest, setSelectedRequest] = useState<BookingRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModify, setShowModify] = useState(false);
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<BookingRequestItem | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["bookingRequests"],
    queryFn: async () => {
      const result = await getBookingRequests("PENDING");
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["suggestedSlots", selectedRequest?.provider.id, selectedRequest?.durationMinutes],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fromDate = format(tomorrow, "yyyy-MM-dd");
      const result = await getSuggestedSlots(
        selectedRequest.provider.id,
        selectedRequest.durationMinutes,
        fromDate,
      );
      if (!result.success) throw new Error(result.error);
      return result.slots;
    },
    enabled: !!selectedRequest && showModify,
  });

  const handleApprove = useCallback(
    async (req: BookingRequestItem) => {
      if (!req.patientId) {
        setPendingApproval(req);
        setShowCreatePatient(true);
        return;
      }

      setActionLoading(req.id);
      try {
        const result = await approveBookingRequest(req.id);
        if (result.success) {
          toast({
            title: "Request approved",
            description: `Appointment created for ${req.patientPhone}`,
            type: "success",
          });
          setSelectedRequest(null);
          queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["tentativeBookings"] });
        } else {
          toast({ title: "Failed", description: result.error, type: "error" });
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Something went wrong",
          type: "error",
        });
      } finally {
        setActionLoading(null);
      }
    },
    [queryClient, toast],
  );

  const handleCreatePatientSuccess = useCallback(
    async (patientId: string) => {
      if (!pendingApproval) return;

      setActionLoading(pendingApproval.id);
      try {
        const result = await approveBookingRequest(pendingApproval.id, patientId);
        if (result.success) {
          toast({
            title: "Patient created & request approved",
            description: `Appointment created for ${pendingApproval.patientPhone}`,
            type: "success",
          });
          setSelectedRequest(null);
          queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["tentativeBookings"] });
        } else {
          toast({ title: "Failed", description: result.error, type: "error" });
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Something went wrong",
          type: "error",
        });
      } finally {
        setActionLoading(null);
        setPendingApproval(null);
      }
    },
    [pendingApproval, queryClient, toast],
  );

  const handleReject = useCallback(
    async (req: BookingRequestItem) => {
      setActionLoading(req.id);
      try {
        const result = await rejectBookingRequest(req.id, rejectReason || undefined);
        if (result.success) {
          toast({
            title: "Request rejected",
            description: `Patient ${req.patientPhone} will be notified`,
            type: "success",
          });
          setSelectedRequest(null);
          setShowRejectInput(false);
          setRejectReason("");
          queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
        } else {
          toast({ title: "Failed", description: result.error, type: "error" });
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Something went wrong",
          type: "error",
        });
      } finally {
        setActionLoading(null);
      }
    },
    [rejectReason, queryClient, toast],
  );

  const handleModify = useCallback(
    async (req: BookingRequestItem, newStart: string, newEnd: string) => {
      setActionLoading(req.id);
      try {
        const result = await modifyBookingRequest(req.id, newStart, newEnd);
        if (result.success) {
          toast({
            title: "Time modified",
            description: `Patient ${req.patientPhone} will be notified of the new time`,
            type: "success",
          });
          setSelectedRequest(null);
          setShowModify(false);
          queryClient.invalidateQueries({ queryKey: ["bookingRequests"] });
          queryClient.invalidateQueries({ queryKey: ["tentativeBookings"] });
        } else {
          toast({ title: "Failed", description: result.error, type: "error" });
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Something went wrong",
          type: "error",
        });
      } finally {
        setActionLoading(null);
      }
    },
    [queryClient, toast],
  );

  if (!role || !["RECEPTIONIST", "ADMIN"].includes(role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Booking Requests</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <AlertCircle className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Access restricted to receptionists and admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Booking Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage incoming WhatsApp appointment requests
        </p>
      </div>

      <div className="flex gap-4 min-h-[600px]">
        {/* LEFT PANEL — Queue */}
        <div className="w-[380px] shrink-0 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="size-4 text-blue-500" />
                Pending Requests
                {requests && requests.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {requests.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : !requests || requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <CheckCircle2 className="size-10 text-green-500 mb-2" />
                  <p className="text-sm font-medium">All caught up</p>
                  <p className="text-xs text-muted-foreground mt-1">No pending booking requests.</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {requests.map((req) => {
                    const isSelected = selectedRequest?.id === req.id;
                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => {
                          setSelectedRequest(isSelected ? null : req);
                          setShowRejectInput(false);
                          setShowModify(false);
                          setRejectReason("");
                        }}
                        className={cn(
                          "w-full text-left rounded-lg p-3 transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                            : "hover:bg-accent border-transparent",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3 text-muted-foreground" />
                            <span className="text-xs font-medium">{req.patientPhone}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(req.createdAt), "HH:mm")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="size-3 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {req.modifiedStart
                              ? format(new Date(req.modifiedStart), "MMM d, HH:mm")
                              : `${format(new Date(req.requestedDate), "MMM d")} at ${req.requestedTime}`}
                          </span>
                          {req.modifiedStart && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              Modified
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="size-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">
                            {req.provider.user.name}
                          </span>
                          {req.patientName && (
                            <span className="text-xs text-muted-foreground">
                              · {req.patientName}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL — Actions */}
        <div className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4 text-amber-500" />
                {selectedRequest
                  ? `Request from ${selectedRequest.patientPhone}`
                  : "Select a request"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {!selectedRequest ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Click a request from the queue
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Approve, reject, or modify the requested time
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Request Details */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Request Details</h3>
                      <Badge variant="outline" className="text-xs">
                        {selectedRequest.durationMinutes}min
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Patient Phone</p>
                        <p className="font-medium">{selectedRequest.patientPhone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Patient Name</p>
                        <p className="font-medium">
                          {selectedRequest.patientName ??
                            selectedRequest.patient?.user.name ??
                            "Unknown"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Requested Date</p>
                        <p className="font-medium">
                          {format(new Date(selectedRequest.requestedDate), "EEEE, MMM d, yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Requested Time</p>
                        <p className="font-medium">{selectedRequest.requestedTime}</p>
                      </div>
                      {selectedRequest.modifiedStart && (
                        <>
                          <div className="col-span-2 border-t pt-2">
                            <p className="text-xs text-amber-600 font-medium mb-1">
                              Suggested New Time
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">New Date</p>
                            <p className="font-medium">
                              {format(new Date(selectedRequest.modifiedStart), "EEEE, MMM d, yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">New Time</p>
                            <p className="font-medium">
                              {format(new Date(selectedRequest.modifiedStart), "HH:mm")} –{" "}
                              {selectedRequest.modifiedEnd
                                ? format(new Date(selectedRequest.modifiedEnd), "HH:mm")
                                : "—"}
                            </p>
                          </div>
                        </>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Provider</p>
                        <p className="font-medium">{selectedRequest.provider.user.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Requested</p>
                        <p className="font-medium">
                          {format(new Date(selectedRequest.createdAt), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>
                    {selectedRequest.message && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Message</p>
                        <p className="text-sm bg-muted rounded-md p-2">{selectedRequest.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      onClick={() => handleApprove(selectedRequest)}
                      disabled={actionLoading === selectedRequest.id}
                      className="flex-1"
                    >
                      {actionLoading === selectedRequest.id ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectInput(!showRejectInput)}
                      disabled={actionLoading === selectedRequest.id}
                      className="flex-1"
                    >
                      <XCircle className="size-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowModify(!showModify)}
                      disabled={actionLoading === selectedRequest.id}
                      className="flex-1"
                    >
                      <Pencil className="size-4 mr-2" />
                      Modify
                    </Button>
                  </div>

                  {/* Reject Input */}
                  {showRejectInput && (
                    <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
                      <p className="text-sm font-medium">Rejection Reason (optional)</p>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g., Provider unavailable, fully booked..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowRejectInput(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(selectedRequest)}
                          disabled={actionLoading === selectedRequest.id}
                        >
                          {actionLoading === selectedRequest.id ? (
                            <Loader2 className="size-4 mr-1 animate-spin" />
                          ) : (
                            <XCircle className="size-4 mr-1" />
                          )}
                          Confirm Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Modify Panel */}
                  {showModify && (
                    <div className="rounded-lg border border-blue-300 p-4 space-y-3">
                      <p className="text-sm font-medium">Suggest New Time</p>
                      {suggestionsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-lg" />
                          ))}
                        </div>
                      ) : suggestions && suggestions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {suggestions.map((slot) => (
                            <Button
                              key={slot.start}
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              onClick={() => handleModify(selectedRequest, slot.start, slot.end)}
                              disabled={actionLoading === selectedRequest.id}
                            >
                              {actionLoading === selectedRequest.id ? (
                                <Loader2 className="size-3 mr-2 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3 mr-2 text-green-500" />
                              )}
                              {slot.dayLabel}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No available slots found in the next 2 weeks.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreatePatientModal
        open={showCreatePatient}
        onOpenChange={setShowCreatePatient}
        prefillName={pendingApproval?.patientName ?? ""}
        prefillPhone={pendingApproval?.patientPhone ?? ""}
        onSuccess={handleCreatePatientSuccess}
      />
    </div>
  );
}
