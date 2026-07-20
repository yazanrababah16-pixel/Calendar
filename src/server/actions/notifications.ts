"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getMyUnreadNotifications() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const notifications = await db.notification.findMany({
    where: { receiverId: session.user.id, status: "UNREAD" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  return { success: true as const, notifications };
}

export async function getUnreadCount() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const count = await db.notification.count({
    where: { receiverId: session.user.id, status: "UNREAD" },
  });

  return { success: true as const, count };
}

export async function markNotificationAsRead(notificationId: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  await db.notification.update({
    where: { id: notificationId },
    data: { status: "READ" },
  });

  return { success: true as const };
}

export async function markAllAsRead() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  await db.notification.updateMany({
    where: { receiverId: session.user.id, status: "UNREAD" },
    data: { status: "READ" },
  });

  return { success: true as const };
}
