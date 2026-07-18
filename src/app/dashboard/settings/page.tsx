"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Shield, User } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-base">{user?.name ?? "N/A"}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="size-3.5" />
                {user?.email ?? "N/A"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Shield className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium capitalize">{user?.role?.toLowerCase() ?? "N/A"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
