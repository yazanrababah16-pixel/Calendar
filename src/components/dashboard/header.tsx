"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Header() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const user = session?.user;
  const initial = user?.name ? (user.name.trim()[0]?.toUpperCase() ?? "?") : "?";

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b bg-background px-6">
      <div className="flex items-center gap-3">
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ redirectTo: "/login" })}
          title={t("header.signOut")}
        >
          <LogOut className="size-4" />
        </Button>
        <div className="text-sm">
          <p className="font-medium">{user?.name}</p>
          <p className="text-muted-foreground">{user?.role}</p>
        </div>
        <Avatar>
          <AvatarFallback className="text-sm font-semibold">{initial}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
