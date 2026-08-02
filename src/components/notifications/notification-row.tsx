"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { getNotificationConfig } from "@/lib/constants/notification-types";
import { markNotificationAsRead } from "@/server/actions/notifications";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface NotificationRowProps {
  notification: {
    id: string;
    type: string;
    message: string;
    status: string;
    createdAt: string | Date;
    sender: { id: string; name: string; image?: string | null };
  };
  onMarkRead: (id: string) => void;
}

function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotificationRowInner({ notification, onMarkRead }: NotificationRowProps) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const config = getNotificationConfig(notification.type);
  const Icon = config.icon;
  const isUnread = notification.status === "UNREAD";
  const isEmergency = notification.type === "emergency_cancellation";
  const createdAtDate =
    notification.createdAt instanceof Date
      ? notification.createdAt
      : new Date(notification.createdAt);

  const handleClick = async () => {
    setMarking(true);
    await markNotificationAsRead(notification.id);
    onMarkRead(notification.id);
    router.push(config.route);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-accent transition-colors border-b last:border-0 ${
        isEmergency ? "border-l-2 border-l-amber-400 bg-amber-50/30" : ""
      }`}
      aria-label={`${config.label} notification from ${notification.sender.name}`}
    >
      <div className={`mt-0.5 shrink-0 ${config.color}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs ${isUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}
        >
          {notification.sender.name}
        </p>
        <p className={`text-sm line-clamp-2 ${isUnread ? "font-medium" : ""}`}>
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatRelativeTime(createdAtDate)}
        </p>
      </div>
      {marking ? (
        <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground mt-1" />
      ) : (
        isUnread && <div className="size-2 shrink-0 rounded-full bg-blue-500 mt-1.5" />
      )}
    </button>
  );
}

export const NotificationRow = memo(NotificationRowInner);
