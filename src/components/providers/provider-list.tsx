"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { providersQuery } from "@/lib/queries/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, Mail, Phone, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { canManageProviders } from "@/lib/role-utils";

type ProviderListProps = {
  onAdd?: () => void;
};

export function ProviderList({ onAdd }: ProviderListProps) {
  const { data: session } = useSession();
  const role = session?.user?.role as "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT" | undefined;
  const {
    data: providers,
    isLoading,
    isError,
    error,
  } = useQuery(providersQuery({ isActive: true }));

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12">
          <AlertCircle className="size-12 text-destructive" />
          <p className="text-sm font-medium text-destructive">Failed to load providers</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred. Please try refreshing the page."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!providers || providers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12">
          <Stethoscope className="size-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No providers found</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
  );
}
