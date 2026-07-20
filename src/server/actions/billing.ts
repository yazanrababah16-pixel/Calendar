"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

const generateInvoiceSchema = z.object({
  appointmentId: z.string().uuid(),
  amount: z.number().positive("Amount must be positive"),
  dueDate: z.string().optional(),
});

const addPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "CARD", "INSURANCE"]),
});

export async function generateInvoiceForAppointment(
  formData: FormData,
): Promise<ActionResult<{ invoiceId: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "RECEPTIONIST" && session.user.role !== "ADMIN") {
    return { success: false, error: "Only receptionists and admins can generate invoices" };
  }

  const parsed = generateInvoiceSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
    dueDate: formData.get("dueDate") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { appointmentId, amount, dueDate } = parsed.data;

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { invoice: true },
  });
  if (!appointment) return { success: false, error: "Appointment not found" };
  if (appointment.invoice)
    return { success: false, error: "Invoice already exists for this appointment" };

  const invoice = await db.invoice.create({
    data: {
      totalAmount: amount,
      patientId: appointment.patientId,
      appointmentId,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  return { success: true, data: { invoiceId: invoice.id } };
}

export async function addPayment(
  formData: FormData,
): Promise<ActionResult<{ invoiceId: string; newStatus: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "RECEPTIONIST" && session.user.role !== "ADMIN") {
    return { success: false, error: "Only receptionists and admins can record payments" };
  }

  const parsed = addPaymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
    method: formData.get("method"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { invoiceId, amount, method } = parsed.data;

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return { success: false, error: "Invoice not found" };

  await db.payment.create({
    data: {
      amount,
      paymentMethod: method,
      invoiceId,
    },
  });

  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) + amount;
  const invoiceTotal = Number(invoice.totalAmount);

  let newStatus: string;
  if (totalPaid >= invoiceTotal) {
    newStatus = "PAID";
  } else if (totalPaid > 0) {
    newStatus = "PARTIAL";
  } else {
    newStatus = "PENDING";
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: newStatus as "PENDING" | "PARTIAL" | "PAID" },
  });

  return { success: true, data: { invoiceId, newStatus } };
}

export type InvoiceWithPayments = {
  id: string;
  totalAmount: number;
  status: string;
  issuedAt: Date;
  dueDate: Date | null;
  patientId: string;
  appointmentId: string;
  createdAt: Date;
  updatedAt: Date;
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    paidAt: Date;
  }>;
  appointment: {
    id: string;
    startTime: Date;
    endTime: Date;
    title: string | null;
    provider: { user: { name: string } };
  } | null;
  patient: {
    user: { name: string; email: string };
  };
};

export async function getPatientInvoices(
  patientId: string,
): Promise<ActionResult<InvoiceWithPayments[]>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const invoices = await db.invoice.findMany({
    where: { patientId },
    include: {
      payments: {
        orderBy: { paidAt: "desc" },
      },
      appointment: {
        include: {
          provider: { include: { user: { select: { name: true } } } },
        },
      },
      patient: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return {
    success: true,
    data: invoices.map((inv) => ({
      ...inv,
      totalAmount: Number(inv.totalAmount),
      payments: inv.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    })),
  };
}

export async function getInvoiceById(
  invoiceId: string,
): Promise<ActionResult<InvoiceWithPayments>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: {
        orderBy: { paidAt: "desc" },
      },
      appointment: {
        include: {
          provider: { include: { user: { select: { name: true } } } },
        },
      },
      patient: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!invoice) return { success: false, error: "Invoice not found" };

  return {
    success: true,
    data: {
      ...invoice,
      totalAmount: Number(invoice.totalAmount),
      payments: invoice.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    },
  };
}

export async function listInvoices(filters?: {
  status?: string;
  patientId?: string;
}): Promise<ActionResult<InvoiceWithPayments[]>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.patientId) where.patientId = filters.patientId;

  const invoices = await db.invoice.findMany({
    where,
    include: {
      payments: {
        orderBy: { paidAt: "desc" },
      },
      appointment: {
        include: {
          provider: { include: { user: { select: { name: true } } } },
        },
      },
      patient: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return {
    success: true,
    data: invoices.map((inv) => ({
      ...inv,
      totalAmount: Number(inv.totalAmount),
      payments: inv.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    })),
  };
}

export async function getProviderFinancials(
  providerId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (session.user.role !== "PROVIDER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Access denied" };
  }

  const appointmentFilter: Record<string, unknown> = { providerId };
  if (dateFrom) appointmentFilter.startTime = { gte: new Date(dateFrom) };
  if (dateTo) appointmentFilter.endTime = { lte: new Date(dateTo) };

  const invoices = await db.invoice.findMany({
    where: {
      appointment: appointmentFilter,
    },
    include: {
      payments: true,
      patient: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { issuedAt: "desc" },
  });

  const data = invoices.map((inv) => ({
    ...inv,
    totalAmount: Number(inv.totalAmount),
    payments: inv.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
  }));

  const totalInvoiced = data.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalCollected = data.reduce(
    (sum, inv) => sum + inv.payments.reduce((ps, p) => ps + p.amount, 0),
    0,
  );

  return {
    success: true as const,
    data,
    summary: {
      totalInvoiced,
      totalCollected,
      totalOutstanding: totalInvoiced - totalCollected,
      invoiceCount: data.length,
    },
  };
}
