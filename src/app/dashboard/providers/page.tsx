"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { providersQuery } from "@/lib/queries/providers";
import { canManageProviders } from "@/lib/role-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddProviderDialog } from "@/components/providers/add-provider-dialog";
import { Stethoscope, Mail, Phone, CheckCircle, XCircle, Plus } from "lucide-react";

export default function ProvidersPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT" | undefined;
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: providers, isLoading } = useQuery(providersQuery({ isActive: true }));
  const canAdd = role ? canManageProviders(role) : false;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage healthcare providers</p>
        </div>
        {canAdd && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 size-4" />
            Add Provider
          </Button>
        )}
      </div>

      {!providers || providers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <Stethoscope className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No providers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{provider.user.name}</CardTitle>
                  {provider.isActive ? (
                    <CheckCircle className="size-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-red-500 shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {provider.specialty && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Stethoscope className="size-3.5" />
                    <span>{provider.specialty}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-3.5" />
                  <span>{provider.user.email}</span>
                </div>
                {provider.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3.5" />
                    <span>{provider.phone}</span>
                  </div>
                )}
                <div className="pt-2">
                  <Link
                    href={`/dashboard/providers/${provider.id}`}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
