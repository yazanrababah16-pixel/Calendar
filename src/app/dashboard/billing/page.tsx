"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentModal } from "@/components/billing/payment-modal";
import { listInvoices } from "@/server/actions/billing";
import type { InvoiceWithPayments } from "@/server/actions/billing";
import { AlertCircle, DollarSign } from "lucide-react";

const statusStyles: Record<string, string> = {
  PENDING: "bg-red-100 text-red-700 border-red-200",
  PARTIAL: "bg-amber-100 text-amber-700 border-amber-200",
  PAID: "bg-green-100 text-green-700 border-green-200",
};

export default function BillingPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  if (!role || !["ADMIN", "RECEPTIONIST"].includes(role)) redirect("/dashboard");

  const [paymentTarget, setPaymentTarget] = useState<InvoiceWithPayments | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const result = await listInvoices();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const totalInvoiced = data?.reduce((s, inv) => s + inv.totalAmount, 0) ?? 0;
  const totalCollected =
    data?.reduce((s, inv) => s + inv.payments.reduce((ps, p) => ps + p.amount, 0), 0) ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12">
          <AlertCircle className="size-12 text-destructive" />
          <p className="text-sm font-medium text-destructive">Failed to load invoices</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage invoices and payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
            <p className="text-2xl font-bold">${totalInvoiced.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Collected</p>
            <p className="text-2xl font-bold text-green-600">${totalCollected.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">
              ${(totalInvoiced - totalCollected).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Patient</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Balance Due</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!data || data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No invoices found
                  </td>
                </tr>
              ) : (
                data.map((inv) => {
                  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
                  const balance = inv.totalAmount - paid;
                  return (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{inv.patient.user.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(inv.issuedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {balance > 0 ? (
                          <span className="text-red-600">${balance.toFixed(2)}</span>
                        ) : (
                          <span className="text-green-600">$0.00</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[inv.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {balance > 0 && (
                          <Button variant="outline" size="sm" onClick={() => setPaymentTarget(inv)}>
                            <DollarSign className="mr-1 size-3.5" />
                            Record Payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paymentTarget && (
        <PaymentModal
          open={!!paymentTarget}
          onOpenChange={() => setPaymentTarget(null)}
          invoiceId={paymentTarget.id}
          totalAmount={paymentTarget.totalAmount}
          paidSoFar={paymentTarget.payments.reduce((s, p) => s + p.amount, 0)}
        />
      )}
    </div>
  );
}
