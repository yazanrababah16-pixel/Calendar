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

type NotificationFilter = "all" | "unread" | "read";

export async function getAllMyNotifications({
  page = 1,
  limit = 20,
  filter = "all",
}: {
  page?: number;
  limit?: number;
  filter?: NotificationFilter;
} = {}) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const where: Record<string, unknown> = { receiverId: session.user.id };
  if (filter === "unread") where.status = "UNREAD";
  else if (filter === "read") where.status = "READ";

  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sender: { select: { id: true, name: true, image: true } },
      },
    }),
    db.notification.count({ where }),
  ]);

  return {
    success: true as const,
    notifications,
    total,
    page,
    pageSize: limit,
  };
}

export async function getNotificationStats() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };

  const base = { receiverId: session.user.id };

  const [total, unread, read, actioned] = await Promise.all([
    db.notification.count({ where: base }),
    db.notification.count({ where: { ...base, status: "UNREAD" } }),
    db.notification.count({ where: { ...base, status: "READ" } }),
    db.notification.count({ where: { ...base, status: "ACTIONED" } }),
  ]);

  return { success: true as const, total, unread, read, actioned };
}

interface BulkNotificationParams {
  senderId: string;
  receiverIds: string[];
  type: string;
  message: string;
  relatedEntityId: string;
  relatedEntityType: string;
}

export async function createBulkNotifications({
  senderId,
  receiverIds,
  type,
  message,
  relatedEntityId,
  relatedEntityType,
}: BulkNotificationParams) {
  if (receiverIds.length === 0) return { success: true as const, created: 0 };

  const result = await db.notification.createMany({
    data: receiverIds.map((receiverId) => ({
      senderId,
      receiverId,
      type,
      message,
      relatedEntityId,
      relatedEntityType,
    })),
  });

  return { success: true as const, created: result.count };
}
