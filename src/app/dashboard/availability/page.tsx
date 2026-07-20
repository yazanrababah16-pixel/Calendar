"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  getWorkingHours,
  upsertWorkingHours,
  createLeaveRequest,
  getLeaveRequests,
} from "@/server/actions/availability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { Clock, CalendarDays, Save, Plus } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayEntry = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

function WorkingHoursEditor() {
  const { data: whData, isLoading } = useQuery({
    queryKey: ["workingHours"],
    queryFn: async () => {
      const result = await getWorkingHours();
      if (!result.success) throw new Error(result.error);
      return result.hours;
    },
  });

  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const days: DayEntry[] =
    whData && whData.length > 0
      ? DAY_NAMES.map((_, i) => {
          const existing = whData.find((h) => h.dayOfWeek === i);
          return existing
            ? {
                dayOfWeek: i,
                startTime: existing.startTime,
                endTime: existing.endTime,
                isActive: existing.isActive,
              }
            : { dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: i >= 1 && i <= 5 };
        })
      : DAY_NAMES.map((_, i) => ({
          dayOfWeek: i,
          startTime: "09:00",
          endTime: "17:00",
          isActive: i >= 1 && i <= 5,
        }));

  const [localDays, setLocalDays] = useState<DayEntry[]>(days);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const formData = new FormData();
    formData.set("hours", JSON.stringify(localDays));
    const result = await upsertWorkingHours(formData);
    setSaving(false);
    if (result.success) {
      toast({ title: "Working hours saved", type: "success" });
    } else {
      toast({ title: "Failed to save", description: result.error, type: "error" });
    }
  }, [localDays, toast]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4" />
          Weekly Working Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {localDays.map((day) => (
          <div key={day.dayOfWeek} className="flex items-center gap-3 rounded-md border p-3">
            <label className="flex items-center gap-2 min-w-[100px]">
              <input
                type="checkbox"
                checked={day.isActive}
                onChange={(e) =>
                  setLocalDays((prev) =>
                    prev.map((d) =>
                      d.dayOfWeek === day.dayOfWeek ? { ...d, isActive: e.target.checked } : d,
                    ),
                  )
                }
                className="size-4 rounded border-gray-300"
              />
              <span
                className={`text-sm font-medium ${day.isActive ? "" : "text-muted-foreground line-through"}`}
              >
                {DAY_NAMES[day.dayOfWeek]}
              </span>
            </label>
            {day.isActive && (
              <>
                <Input
                  type="time"
                  value={day.startTime}
                  onChange={(e) =>
                    setLocalDays((prev) =>
                      prev.map((d) =>
                        d.dayOfWeek === day.dayOfWeek ? { ...d, startTime: e.target.value } : d,
                      ),
                    )
                  }
                  className="h-8 w-32"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={day.endTime}
                  onChange={(e) =>
                    setLocalDays((prev) =>
                      prev.map((d) =>
                        d.dayOfWeek === day.dayOfWeek ? { ...d, endTime: e.target.value } : d,
                      ),
                    )
                  }
                  className="h-8 w-32"
                />
              </>
            )}
            {!day.isActive && <span className="text-sm text-muted-foreground">Not working</span>}
          </div>
        ))}
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 size-4" />
          {saving ? "Saving..." : "Save Working Hours"}
        </Button>
      </CardContent>
    </Card>
  );
}

function LeaveRequestSection() {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    data: leavesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["leaveRequests"],
    queryFn: async () => {
      const result = await getLeaveRequests();
      if (!result.success) throw new Error(result.error);
      return result.leaves;
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!date) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.set("date", date);
    if (reason) formData.set("reason", reason);
    const result = await createLeaveRequest(formData);
    setSubmitting(false);
    if (result.success) {
      setDate("");
      setReason("");
      refetch();
      toast({ title: "Leave request submitted", type: "success" });
    } else {
      toast({ title: "Failed", description: result.error, type: "error" });
    }
  }, [date, reason, refetch, toast]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-700",
      APPROVED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
    };
    return `inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          Leave Requests
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-4 space-y-3">
          <h4 className="text-sm font-medium">Request Leave</h4>
          <div className="space-y-2">
            <Label htmlFor="leaveDate">Date</Label>
            <Input
              id="leaveDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leaveReason">Reason (optional)</Label>
            <textarea
              id="leaveReason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Medical appointment"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
            />
          </div>
          <Button onClick={handleSubmit} disabled={!date || submitting} size="sm">
            <Plus className="mr-1 size-4" />
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Leave History</h4>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !leavesData || leavesData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          ) : (
            <div className="space-y-2">
              {leavesData.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {new Date(leave.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {leave.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{leave.reason}</p>
                    )}
                  </div>
                  <span className={statusBadge(leave.status)}>{leave.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AvailabilityPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (role !== "PROVIDER") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="text-sm text-muted-foreground">This page is only accessible to providers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your working hours and leave requests
        </p>
      </div>
      <WorkingHoursEditor />
      <LeaveRequestSection />
    </div>
  );
}
