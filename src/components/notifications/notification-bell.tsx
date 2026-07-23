"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
import {
  getMyUnreadNotifications,
  markNotificationAsRead,
  markAllAsRead,
  getUnreadCount,
} from "@/server/actions/notifications";

export function NotificationBell() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(dropdownRef, () => setOpen(false));

  const { data: countData } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: async () => {
      const result = await getUnreadCount();
      if (!result.success) throw new Error(result.error);
      return result.count;
    },
    refetchInterval: 30000,
    enabled: !!role && ["RECEPTIONIST", "PROVIDER", "ADMIN"].includes(role),
  });

  const { data: notifications } = useQuery({
    queryKey: ["unreadNotifications"],
    queryFn: async () => {
      const result = await getMyUnreadNotifications();
      if (!result.success) throw new Error(result.error);
      return result.notifications;
    },
    enabled: open,
  });

  const handleMarkRead = useCallback(
    async (id: string) => {
      setMarking((prev) => new Set(prev).add(id));
      await markNotificationAsRead(id);
      setMarking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
    [queryClient],
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllAsRead();
    queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    queryClient.invalidateQueries({ queryKey: ["unreadNotifications"] });
  }, [queryClient]);

  if (!role || !["RECEPTIONIST", "PROVIDER", "ADMIN"].includes(role)) return null;

  const unreadCount = countData ?? 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-medium">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="size-3" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={async () => {
                    await handleMarkRead(n.id);
                    if (n.type === "leave_notification") {
                      router.push("/dashboard/calendar");
                    } else if (n.type === "reschedule_request" && n.relatedEntityType) {
                      const parts = n.relatedEntityType.split("|");
                      const rescheduleDate = parts[0] ?? "";
                      const rescheduleProviderId = parts[1] ?? "";
                      const qs = new URLSearchParams();
                      if (rescheduleDate) qs.set("date", rescheduleDate);
                      if (rescheduleProviderId) qs.set("providerId", rescheduleProviderId);
                      router.push(`/dashboard/receptionist/reschedule?${qs.toString()}`);
                    }
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors border-b last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{n.sender.name}</p>
                    <p className="text-sm line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {marking.has(n.id) ? (
                    <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground mt-1" />
                  ) : (
                    <div className="size-2 shrink-0 rounded-full bg-blue-500 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
