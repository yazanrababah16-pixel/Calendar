import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { NotificationList } from "@/components/notifications/notification-list";
import { getAllMyNotifications, getNotificationStats } from "@/server/actions/notifications";

export default async function NotificationsPage() {
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["notifications", "list", { page: 1, limit: 20, filter: "all" }],
      queryFn: async () => {
        const result = await getAllMyNotifications({ page: 1, limit: 20, filter: "all" });
        if (!result.success) throw new Error(result.error);
        return result;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["notifications", "stats"],
      queryFn: async () => {
        const result = await getNotificationStats();
        if (!result.success) throw new Error(result.error);
        return result;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="size-6" />
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View all your notifications and stay updated.
          </p>
        </div>
        <NotificationList />
      </div>
    </HydrationBoundary>
  );
}
