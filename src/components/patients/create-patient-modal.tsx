"use client";

import { useCallback, useState } from "react";
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
import { Loader2 } from "lucide-react";

const createPatientModalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(5, "Phone number must be at least 5 characters")
    .max(20, "Phone number must be at most 20 characters")
    .regex(/^\+?[\d\-.\s()]+$/, "Phone number contains invalid characters"),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type CreatePatientModalFormData = z.infer<typeof createPatientModalSchema>;

interface CreatePatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillName: string;
  prefillPhone: string;
  onSuccess: (patientId: string) => void;
}

export function CreatePatientModal({
  open,
  onOpenChange,
  prefillName,
  prefillPhone,
  onSuccess,
}: CreatePatientModalProps) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePatientModalFormData>({
    resolver: zodResolver(createPatientModalSchema),
    defaultValues: {
      name: prefillName,
      email: `whatsapp-${prefillPhone.replace(/[^a-zA-Z0-9]/g, "")}@clinic.local`,
      phone: prefillPhone,
      dateOfBirth: "",
      notes: "",
    },
  });

  const onSubmit = useCallback(
    async (data: CreatePatientModalFormData) => {
      setError(null);
      const formData = new FormData();
      formData.set("name", data.name);
      formData.set("email", data.email);
      formData.set("phone", data.phone);
      if (data.dateOfBirth) formData.set("dateOfBirth", data.dateOfBirth);
      if (data.notes) formData.set("notes", data.notes);

      const result = await createPatient(null, formData);

      if (result.success) {
        reset();
        onOpenChange(false);
        onSuccess(result.id);
      } else {
        setError(result.error);
      }
    },
    [reset, onOpenChange, onSuccess],
  );

  const handleClose = useCallback(() => {
    setError(null);
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Patient</DialogTitle>
          <DialogDescription>
            This phone number is not linked to any patient. Create a new patient record to approve
            the booking.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient-name">Full Name</Label>
            <Input id="patient-name" {...register("name")} placeholder="John Doe" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-email">Email</Label>
            <Input
              id="patient-email"
              type="email"
              {...register("email")}
              placeholder="john@example.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-phone">Phone</Label>
            <Input id="patient-phone" {...register("phone")} placeholder="+1-555-0100" />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-dob">Date of Birth (optional)</Label>
            <Input id="patient-dob" type="date" {...register("dateOfBirth")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-notes">Notes (optional)</Label>
            <Input id="patient-notes" {...register("notes")} placeholder="Any relevant notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Save & Approve
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
