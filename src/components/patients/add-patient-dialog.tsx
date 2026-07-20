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
import { Copy, CheckCircle2 } from "lucide-react";

const addPatientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .optional()
    .or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type AddPatientFormData = z.infer<typeof addPatientSchema>;

type AddPatientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientCreated?: (patientId: string) => void;
};

const DEFAULT_PASSWORD = "Clinic@123";

export function AddPatientDialog({ open, onOpenChange, onPatientCreated }: AddPatientDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddPatientFormData>({
    resolver: zodResolver(addPatientSchema),
    defaultValues: { name: "", email: "", username: "", phone: "", dateOfBirth: "", notes: "" },
  });

  const onSubmit = useCallback(
    async (data: AddPatientFormData) => {
      setError(null);
      setSuccessData(null);
      const formData = new FormData();
      formData.set("name", data.name);
      formData.set("email", data.email);
      if (data.username) formData.set("username", data.username);
      if (data.phone) formData.set("phone", data.phone);
      if (data.dateOfBirth) formData.set("dateOfBirth", data.dateOfBirth);
      if (data.notes) formData.set("notes", data.notes);

      const result = await createPatient(null, formData);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        setSuccessData({ email: data.email });
        reset();
        setError(null);
        onPatientCreated?.(result.id);
      } else {
        setError(result.error);
        toast({ title: "Failed to add patient", description: result.error, type: "error" });
      }
    },
    [queryClient, reset, onOpenChange, onPatientCreated, toast],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DEFAULT_PASSWORD);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, []);

  const handleClose = useCallback(() => {
    setError(null);
    setSuccessData(null);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Patient</DialogTitle>
          <DialogDescription>Create a new patient record.</DialogDescription>
        </DialogHeader>

        {successData && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle2 className="size-5" />
              Patient created successfully
            </div>
            <p className="text-sm text-green-600">
              Login credentials — share these with the patient:
            </p>
            <div className="rounded bg-white p-3 text-sm space-y-1 border border-green-200">
              <p>
                <span className="font-medium">Email:</span> {successData.email}
              </p>
              <p>
                <span className="font-medium">Password:</span> {DEFAULT_PASSWORD}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Copy className="size-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </p>
            </div>
            <Button type="button" size="sm" onClick={handleClose} className="mt-1">
              Done
            </Button>
          </div>
        )}

        {!successData && (
          <>
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
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="john@example.com"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username (optional)</Label>
                <Input id="username" {...register("username")} placeholder="john_doe" />
                {errors.username && (
                  <p className="text-xs text-destructive">{errors.username.message}</p>
                )}
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
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Patient"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
