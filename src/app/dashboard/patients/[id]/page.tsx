"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { patientQuery } from "@/lib/queries/patients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Phone, Calendar, Stethoscope, Users } from "lucide-react";
import { statusLabels, statusColors } from "@/lib/constants/appointment-status";
import { getPatientLinkedProviders } from "@/server/actions/patient-linking";

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: patient, isLoading } = useQuery(patientQuery(params.id));

  const { data: linkedResult } = useQuery({
    queryKey: ["patientLinkedProviders", params.id],
    queryFn: async () => {
      const result = await getPatientLinkedProviders(params.id);
      if (!result.success) throw new Error(result.error);
      return result.providers;
    },
    enabled: !!params.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!patient) {
    return <div className="py-12 text-center text-muted-foreground">Patient not found</div>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Patients
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{patient.user.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" />
            {patient.user.email}
          </div>
          {patient.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" />
              {patient.phone}
            </div>
          )}
          {patient.dateOfBirth && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-4" />
              {new Date(patient.dateOfBirth).toLocaleDateString()}
            </div>
          )}
          {patient.notes && <p className="text-muted-foreground">{patient.notes}</p>}
        </CardContent>
      </Card>

      {linkedResult && linkedResult.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Linked Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {linkedResult.map((provider) => (
                <div key={provider.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Stethoscope className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{provider.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{provider.specialty}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4" />
            Appointment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patient.appointments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>No appointments yet.</p>
              <Link
                href="/dashboard/calendar"
                className="mt-2 inline-block text-primary hover:underline"
              >
                Book the first appointment for {patient.user.name}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {patient.appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {new Date(apt.startTime).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      {new Date(apt.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">with {apt.provider.user.name}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      statusColors[apt.status] ?? "text-gray-600 bg-gray-100"
                    }`}
                  >
                    {statusLabels[apt.status] ?? apt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
