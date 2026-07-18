"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { providerQuery } from "@/lib/queries/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Stethoscope, Mail, Phone, Calendar } from "lucide-react";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: provider, isLoading } = useQuery(providerQuery(params.id));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!provider) {
    return <div className="py-12 text-center text-muted-foreground">Provider not found</div>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/providers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Providers
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{provider.user.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" />
            {provider.user.email}
          </div>
          {provider.specialty && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Stethoscope className="size-4" />
              {provider.specialty}
            </div>
          )}
          {provider.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" />
              {provider.phone}
            </div>
          )}
          {provider.bio && <p className="text-muted-foreground">{provider.bio}</p>}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                provider.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {provider.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </CardContent>
      </Card>

      {provider.availabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4" />
              Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center text-sm">
              {dayNames.map((name, i) => {
                const slot = provider.availabilities.find((a) => a.dayOfWeek === i);
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-2 ${
                      slot && slot.isActive
                        ? "border-green-200 bg-green-50"
                        : "border-gray-100 bg-gray-50 text-muted-foreground"
                    }`}
                  >
                    <div className="mb-1 text-xs font-medium">{name}</div>
                    {slot && slot.isActive ? (
                      <div className="text-xs">
                        {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                      </div>
                    ) : (
                      <div className="text-xs">—</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
