"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { patientsQuery } from "@/lib/queries/patients";
import { providersQuery } from "@/lib/queries/providers";
import { getAssignedProviders } from "@/server/actions/providers";
import {
  linkPatientToProvider,
  unlinkPatientProvider,
  getPatientLinkedProviders,
} from "@/server/actions/patient-linking";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddPatientDialog } from "@/components/patients/add-patient-dialog";
import { useToast } from "@/components/ui/toaster";
import {
  Users,
  Mail,
  Search,
  Plus,
  Link2,
  Unlink,
  CalendarDays,
  User,
  Stethoscope,
} from "lucide-react";

interface LinkProviderDialogProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onClose: () => void;
}

function LinkProviderDialog({ patientId, patientName, open, onClose }: LinkProviderDialogProps) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { toast } = useToast();
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const { data: allProviders } = useQuery(providersQuery({ isActive: true }));

  const { data: assignedResult } = useQuery({
    queryKey: ["assignedProviders"],
    queryFn: async () => {
      const result = await getAssignedProviders();
      if (!result.success) throw new Error(result.error);
      return result.providers;
    },
    enabled: role === "RECEPTIONIST",
  });

  const { data: linkedResult, refetch: refetchLinked } = useQuery({
    queryKey: ["patientProviders", patientId],
    queryFn: async () => {
      const result = await getPatientLinkedProviders(patientId);
      if (!result.success) throw new Error(result.error);
      return result.providers;
    },
    enabled: open,
  });

  const availableProviders = useMemo(() => {
    const pool = role === "RECEPTIONIST" ? assignedResult : allProviders;
    if (!pool || !linkedResult) return pool ?? [];
    const linkedIds = new Set(linkedResult.map((p) => p.id));
    return pool.filter((p) => !linkedIds.has(p.id));
  }, [role, assignedResult, allProviders, linkedResult]);

  const handleLink = useCallback(
    async (providerId: string) => {
      setLinking(true);
      const result = await linkPatientToProvider(patientId, providerId);
      setLinking(false);
      if (result.success) {
        refetchLinked();
        toast({ title: "Provider linked", type: "success" });
      } else {
        toast({ title: "Failed", description: result.error, type: "error" });
      }
    },
    [patientId, refetchLinked, toast],
  );

  const handleUnlink = useCallback(
    async (providerId: string) => {
      setUnlinking(true);
      const result = await unlinkPatientProvider(patientId, providerId);
      setUnlinking(false);
      if (result.success) {
        refetchLinked();
        toast({ title: "Provider unlinked", type: "success" });
      } else {
        toast({ title: "Failed", description: result.error, type: "error" });
      }
    },
    [patientId, refetchLinked, toast],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Link Provider</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Manage providers linked to <span className="font-medium">{patientName}</span>
        </p>

        {/* Already linked */}
        {linkedResult && linkedResult.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Linked Providers
            </p>
            {linkedResult.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-muted-foreground" />
                  <span className="font-medium">{p.user.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnlink(p.id)}
                  disabled={unlinking}
                  className="flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  <Unlink className="size-3" />
                  Unlink
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Available to link */}
        {availableProviders && availableProviders.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Available Providers
            </p>
            {availableProviders.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-muted-foreground" />
                  <span>{p.user.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLink(p.id)}
                  disabled={linking}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                >
                  <Link2 className="size-3" />
                  Link
                </button>
              </div>
            ))}
          </div>
        )}

        {(!availableProviders || availableProviders.length === 0) &&
          (!linkedResult || linkedResult.length === 0) && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No providers available.
            </p>
          )}

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ patientId: string; patientName: string } | null>(
    null,
  );

  const { data: patients, isLoading } = useQuery(patientsQuery(search || undefined));

  const handlePatientCreated = useCallback(
    (_patientId: string) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setDialogOpen(false);
    },
    [queryClient],
  );

  const handleLinkProvider = useCallback((patientId: string, patientName: string) => {
    setLinkDialog({ patientId, patientName });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search and manage patients</p>
        </div>
        {(role === "ADMIN" || role === "RECEPTIONIST") && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 size-4" />
            Add Patient
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patients by name, email, or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : !patients || patients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <Users className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search ? "No patients match your search" : "No patients found"}
            </p>
            {!search && (role === "ADMIN" || role === "RECEPTIONIST") && (
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                Add your first patient
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <div key={patient.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <Link
                  href={`/dashboard/patients/${patient.id}`}
                  className="flex-1 hover:opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    <p className="font-medium">{patient.user.name}</p>
                    {patient.user.username && (
                      <span className="text-xs text-muted-foreground">
                        @{patient.user.username}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    {patient.user.email}
                  </div>
                  {patient.dateOfBirth && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" />
                      DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                    </div>
                  )}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {patient.phone && (
                    <span className="text-xs text-muted-foreground">{patient.phone}</span>
                  )}
                  {(role === "ADMIN" || role === "RECEPTIONIST") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleLinkProvider(patient.id, patient.user.name)}
                    >
                      <Link2 className="mr-1 size-3.5" />
                      Link
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPatientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPatientCreated={handlePatientCreated}
      />

      {linkDialog && (
        <LinkProviderDialog
          patientId={linkDialog.patientId}
          patientName={linkDialog.patientName}
          open={!!linkDialog}
          onClose={() => setLinkDialog(null)}
        />
      )}
    </div>
  );
}
