"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function getMonthlyRevenue() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") return { success: false as const, error: "Access denied" };

  const months: Array<{ month: string; revenue: number }> = [];

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const payments = await db.payment.findMany({
      where: {
        paidAt: { gte: start, lte: end },
        invoice: { status: { in: ["PAID", "PARTIAL"] } },
      },
    });

    const revenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    months.push({
      month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      revenue,
    });
  }

  return { success: true as const, months };
}

export async function getAppointmentStatusDistribution() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") return { success: false as const, error: "Access denied" };

  const counts = await db.appointment.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const distribution = counts.map((c) => ({
    status: c.status,
    count: c._count.id,
  }));

  return { success: true as const, distribution };
}

export type ProviderWorkload = {
  id: string;
  name: string;
  appointmentCount: number;
  totalRevenue: number;
};

export async function getProviderWorkload() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (session.user.role !== "ADMIN") return { success: false as const, error: "Access denied" };

  const providers = await db.provider.findMany({
    include: {
      user: { select: { name: true } },
      appointments: {
        where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        select: { id: true },
      },
    },
  });

  const workload: ProviderWorkload[] = await Promise.all(
    providers.map(async (p) => {
      const invoices = await db.invoice.findMany({
        where: { appointment: { providerId: p.id } },
        include: { payments: true },
      });
      const totalRevenue = invoices.reduce(
        (sum, inv) => sum + inv.payments.reduce((ps, pay) => ps + Number(pay.amount), 0),
        0,
      );
      return {
        id: p.id,
        name: p.user.name,
        appointmentCount: p.appointments.length,
        totalRevenue,
      };
    }),
  );

  workload.sort((a, b) => b.appointmentCount - a.appointmentCount);

  return { success: true as const, workload };
}
