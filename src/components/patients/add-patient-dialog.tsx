"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createPatient } from "@/server/actions/patients";
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

const addPatientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(20).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type AddPatientFormData = z.infer<typeof addPatientSchema>;

type AddPatientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddPatientDialog({ open, onOpenChange }: AddPatientDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddPatientFormData>({
    resolver: zodResolver(addPatientSchema),
    defaultValues: { name: "", email: "", phone: "", dateOfBirth: "", notes: "" },
  });

  const onSubmit = useCallback(
    async (data: AddPatientFormData) => {
      setError(null);
      const formData = new FormData();
      formData.set("name", data.name);
      formData.set("email", data.email);
      if (data.phone) formData.set("phone", data.phone);
      if (data.dateOfBirth) formData.set("dateOfBirth", data.dateOfBirth);
      if (data.notes) formData.set("notes", data.notes);

      const result = await createPatient(null, formData);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        reset();
        setError(null);
        onOpenChange(false);
        toast({
          title: "Patient added",
          description: "Patient has been created successfully.",
          type: "success",
        });
      } else {
        setError(result.error);
        toast({ title: "Failed to add patient", description: result.error, type: "error" });
      }
    },
    [queryClient, reset, onOpenChange, toast],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Patient</DialogTitle>
          <DialogDescription>Create a new patient record.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register("name")} placeholder="John Doe" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="john@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" {...register("phone")} placeholder="+1-555-0100" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth (optional)</Label>
            <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" {...register("notes")} placeholder="Any relevant notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Patient"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
