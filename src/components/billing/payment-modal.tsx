"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { addPayment } from "@/server/actions/billing";
import { Loader2 } from "lucide-react";

type PaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  totalAmount: number;
  paidSoFar: number;
};

export function PaymentModal({
  open,
  onOpenChange,
  invoiceId,
  totalAmount,
  paidSoFar,
}: PaymentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState(String(totalAmount - paidSoFar));
  const [method, setMethod] = useState<"CASH" | "CARD" | "INSURANCE">("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = totalAmount - paidSoFar;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    if (parsed > remaining) {
      setError(`Amount cannot exceed remaining balance ($${remaining.toFixed(2)})`);
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("invoiceId", invoiceId);
    formData.set("amount", String(parsed));
    formData.set("method", method);

    const result = await addPayment(formData);
    setSubmitting(false);

    if (result.success) {
      toast({
        title: "Payment recorded",
        description: `Invoice status: ${result.data.newStatus}`,
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onOpenChange(false);
    } else {
      setError(result.error);
      toast({ title: "Payment failed", description: result.error, type: "error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Total: ${totalAmount.toFixed(2)} &middot; Paid: ${paidSoFar.toFixed(2)} &middot;
            Remaining: ${remaining.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pm-amount">Amount to Pay</Label>
            <Input
              id="pm-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pm-method">Payment Method</Label>
            <select
              id="pm-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="INSURANCE">Insurance</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
