"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocale } from "@/lib/i18n/locale-context";
import { Mail, Shield, User, Languages } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useLocale();
  const user = session?.user;
  const initial = user?.name ? (user.name.trim()[0]?.toUpperCase() ?? "?") : "?";

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4" />
            {t("settings.profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initial}</AvatarFallback>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-4" />
            {t("settings.language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("settings.languageLabel")}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as "en" | "ar")}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
