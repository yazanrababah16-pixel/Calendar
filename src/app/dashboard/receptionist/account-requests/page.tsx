"use client";

import { Suspense, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  User,
  AlertCircle,
  Pencil,
  Mail,
} from "lucide-react";
import { useToast } from "@/components/ui/toaster";

type RegistrationRequest = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  whatsapp_chat_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export default function AccountRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      }
    >
      <AccountRequestsContent />
    </Suspense>
  );
}

function AccountRequestsContent() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["pendingRegistrations"],
    queryFn: async () => {
      const response = await fetch("/api/admin/pending-registrations");
      if (!response.ok) throw new Error("Failed to fetch registration requests");
      return response.json();
    },
  });

  const handleSelectRequest = useCallback((req: RegistrationRequest) => {
    setSelectedRequest(req);
    setEditName(req.name);
    setEditPhone(req.phone);
    setEditEmail(req.email || "");
    setIsEditing(false);
  }, []);

  const handleApprove = useCallback(
    async (req: RegistrationRequest) => {
      setActionLoading(true);
      try {
        const response = await fetch("/api/admin/approve-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: req.id,
            name: isEditing ? editName : req.name,
            phone: isEditing ? editPhone : req.phone,
            email: isEditing ? editEmail : req.email,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          toast({
            title: "Account created",
            description: `Patient account created for ${req.name}`,
            type: "success",
          });
          setSelectedRequest(null);
          setIsEditing(false);
          queryClient.invalidateQueries({ queryKey: ["pendingRegistrations"] });
        } else {
          toast({ title: "Failed", description: data.error, type: "error" });
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Something went wrong",
          type: "error",
        });
      } finally {
        setActionLoading(false);
      }
    },
    [isEditing, editName, editPhone, editEmail, queryClient, toast],
  );

  if (!role || !["RECEPTIONIST", "ADMIN"].includes(role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Account Requests</h1>
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
        <h1 className="text-2xl font-semibold">Account Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve new patient registration requests from WhatsApp
        </p>
      </div>

      <div className="flex gap-4 min-h-[600px]">
        {/* LEFT PANEL — Queue */}
        <div className="w-[380px] shrink-0 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="size-4 text-blue-500" />
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
                  <p className="text-xs text-muted-foreground mt-1">
                    No pending registration requests.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {requests.map((req: RegistrationRequest) => {
                    const isSelected = selectedRequest?.id === req.id;
                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => handleSelectRequest(req)}
                        className={cn(
                          "w-full text-left rounded-lg p-3 transition-colors border",
                          isSelected
                            ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                            : "hover:bg-accent border-transparent",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <User className="size-3 text-muted-foreground" />
                            <span className="text-xs font-medium">{req.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(req.requested_at), "HH:mm")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Phone className="size-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{req.phone}</span>
                        </div>
                        {req.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="size-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">
                              {req.email}
                            </span>
                          </div>
                        )}
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
                {selectedRequest ? `Request from ${selectedRequest.name}` : "Select a request"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {!selectedRequest ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <UserPlus className="size-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Click a request from the queue
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review patient details and create their account
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Request Details */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Patient Details</h3>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                        <Pencil className="size-4 mr-1" />
                        {isEditing ? "Cancel Edit" : "Edit"}
                      </Button>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Full Name</Label>
                          <Input
                            id="edit-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Patient name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-phone">Phone Number</Label>
                          <Input
                            id="edit-phone"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="+9627XXXXXXXX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-email">Email (optional)</Label>
                          <Input
                            id="edit-email"
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="patient@example.com"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Full Name</p>
                          <p className="font-medium">{selectedRequest.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone Number</p>
                          <p className="font-medium">{selectedRequest.phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-medium">{selectedRequest.email || "Not provided"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">WhatsApp Chat ID</p>
                          <p className="font-medium text-xs">{selectedRequest.whatsapp_chat_id}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="font-medium">
                            {format(new Date(selectedRequest.requested_at), "MMM d, yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      onClick={() => handleApprove(selectedRequest)}
                      disabled={
                        actionLoading || (isEditing && (!editName.trim() || !editPhone.trim()))
                      }
                      className="flex-1"
                    >
                      {actionLoading ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4 mr-2" />
                      )}
                      Create Account
                    </Button>
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
