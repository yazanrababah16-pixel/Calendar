"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createProvider } from "@/server/actions/providers";
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

const addProviderSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  specialty: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
});

type AddProviderFormData = z.infer<typeof addProviderSchema>;

type AddProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddProviderDialog({ open, onOpenChange }: AddProviderDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddProviderFormData>({
    resolver: zodResolver(addProviderSchema),
    defaultValues: { name: "", email: "", password: "", specialty: "", phone: "", bio: "" },
  });

  const onSubmit = useCallback(
    async (data: AddProviderFormData) => {
      setError(null);
      const formData = new FormData();
      formData.set("name", data.name);
      formData.set("email", data.email);
      formData.set("password", data.password);
      if (data.specialty) formData.set("specialty", data.specialty);
      if (data.phone) formData.set("phone", data.phone);
      if (data.bio) formData.set("bio", data.bio);

      const result = await createProvider(null, formData);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["providers"] });
        reset();
        setError(null);
        onOpenChange(false);
        toast({
          title: "Provider added",
          description: "Provider has been created successfully.",
          type: "success",
        });
      } else {
        setError(result.error);
        toast({ title: "Failed to add provider", description: result.error, type: "error" });
      }
    },
    [queryClient, reset, onOpenChange, toast],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Provider</DialogTitle>
          <DialogDescription>Create a new healthcare provider account.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register("name")} placeholder="Dr. John Smith" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="doctor@clinic.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder="Min. 6 characters"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Specialty (optional)</Label>
            <Input id="specialty" {...register("specialty")} placeholder="e.g. Cardiology" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" {...register("phone")} placeholder="+1-555-0100" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio (optional)</Label>
            <textarea
              id="bio"
              rows={3}
              {...register("bio")}
              placeholder="Brief professional background..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Provider"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
