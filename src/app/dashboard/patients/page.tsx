"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { patientsQuery } from "@/lib/queries/patients";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddPatientDialog } from "@/components/patients/add-patient-dialog";
import { Users, Mail, Search, Plus } from "lucide-react";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: patients, isLoading } = useQuery(patientsQuery(search || undefined));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search and manage patients</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 size-4" />
          Add Patient
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patients by name or email..."
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
            {!search && (
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                Add your first patient
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/dashboard/patients/${patient.id}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{patient.user.name}</p>
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    {patient.user.email}
                  </div>
                </div>
                {patient.phone && (
                  <span className="text-sm text-muted-foreground">{patient.phone}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddPatientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
