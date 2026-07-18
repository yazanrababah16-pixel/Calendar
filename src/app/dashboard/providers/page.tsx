"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { canManageProviders } from "@/lib/role-utils";
import { Button } from "@/components/ui/button";
import { ProviderList } from "@/components/providers/provider-list";
import { AddProviderDialog } from "@/components/providers/add-provider-dialog";
import { Plus } from "lucide-react";

export default function ProvidersPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as "ADMIN" | "PROVIDER" | "RECEPTIONIST" | "PATIENT" | undefined;
  const [dialogOpen, setDialogOpen] = useState(false);
  const canAdd = role ? canManageProviders(role) : false;

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

      <ProviderList />

      <AddProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
