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
import { generateInvoiceForAppointment } from "@/server/actions/billing";
import { Loader2 } from "lucide-react";

type GenerateInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  onInvoiceCreated?: (invoiceId: string) => void;
};

export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  appointmentId,
  onInvoiceCreated,
}: GenerateInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Amount must be a positive number");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("appointmentId", appointmentId);
    formData.set("amount", String(parsed));

    const result = await generateInvoiceForAppointment(formData);
    setSubmitting(false);

    if (result.success) {
      toast({
        title: "Invoice generated",
        description: `Invoice #${result.data.invoiceId.slice(0, 8)}`,
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["appointmentInvoice"] });
      onInvoiceCreated?.(result.data.invoiceId);
      onOpenChange(false);
    } else {
      setError(result.error);
      toast({ title: "Failed", description: result.error, type: "error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>Enter the total amount for this appointment.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gi-amount">Total Amount ($)</Label>
            <Input
              id="gi-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Generating..." : "Generate Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
