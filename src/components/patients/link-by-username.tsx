"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Link2, X } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import {
  linkPatientToProviderByUsername,
  unlinkMyProvider,
} from "@/server/actions/patient-linking";

type Doctor = {
  id: string;
  specialty: string | null;
  user: { id: string; name: string; email: string; username: string | null; image: string | null };
  linkedAt: string;
};

export function LinkByUsername({
  doctors: initialDoctors,
  onUpdate,
}: {
  doctors: Doctor[];
  onUpdate?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleLink() {
    if (!username.trim()) return;
    setLinking(true);
    setError(null);
    const result = await linkPatientToProviderByUsername(username.trim());
    if (result.success) {
      toast({
        title: "Linked successfully",
        description: `You are now linked to ${result.provider.user.name}`,
        type: "success",
      });
      setUsername("");
      onUpdate?.();
    } else {
      setError(result.error);
    }
    setLinking(false);
  }

  async function handleUnlink(providerId: string, name: string) {
    const result = await unlinkMyProvider(providerId);
    if (result.success) {
      toast({ title: "Unlinked", description: `You are no longer linked to ${name}` });
      onUpdate?.();
    } else {
      toast({ title: "Error", description: result.error, type: "error" });
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="doctor-username" className="text-sm font-medium">
              Link a Doctor by Username
            </label>
            <Input
              id="doctor-username"
              placeholder="Enter doctor's username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLink();
              }}
              disabled={linking}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <Button onClick={handleLink} disabled={linking || !username.trim()}>
            {linking ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Link
          </Button>
        </div>

        {initialDoctors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">My Doctors ({initialDoctors.length})</p>
            {initialDoctors.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(doc.user.name[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{doc.user.username ?? "—"}
                      {doc.specialty && <> &middot; {doc.specialty}</>}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-red-600"
                  onClick={() => handleUnlink(doc.id, doc.user.name)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
