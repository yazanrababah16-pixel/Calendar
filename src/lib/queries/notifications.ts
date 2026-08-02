import { queryOptions } from "@tanstack/react-query";
import {
  getAllMyNotifications,
  getNotificationStats,
  getUnreadCount,
} from "@/server/actions/notifications";

export function allNotificationsQuery({
  page = 1,
  limit = 20,
  filter = "all",
}: {
  page?: number;
  limit?: number;
  filter?: "all" | "unread" | "read";
} = {}) {
  return queryOptions({
    queryKey: ["notifications", "list", { page, limit, filter }],
    queryFn: async () => {
      const result = await getAllMyNotifications({ page, limit, filter });
      if (!result.success) throw new Error(result.error);
      return result;
    },
  });
}

export function notificationStatsQuery() {
  return queryOptions({
    queryKey: ["notifications", "stats"],
    queryFn: async () => {
      const result = await getNotificationStats();
      if (!result.success) throw new Error(result.error);
      return result;
    },
  });
}

export function unreadCountQuery() {
  return queryOptions({
    queryKey: ["unreadCount"],
    queryFn: async () => {
      const result = await getUnreadCount();
      if (!result.success) throw new Error(result.error);
      return result.count;
    },
    refetchInterval: 30000,
  });
}
