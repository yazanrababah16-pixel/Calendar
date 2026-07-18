"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";
import { Calendar, LayoutDashboard, Users, Stethoscope, Settings, Clock } from "lucide-react";

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
};

const navItems: NavItem[] = [
  {
    labelKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"],
  },
  {
    labelKey: "nav.calendar",
    href: "/dashboard/calendar",
    icon: Calendar,
    roles: ["ADMIN", "PROVIDER", "RECEPTIONIST"],
  },
  {
    labelKey: "nav.appointments",
    href: "/dashboard/appointments",
    icon: Clock,
    roles: ["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"],
  },
  {
    labelKey: "nav.patients",
    href: "/dashboard/patients",
    icon: Users,
    roles: ["ADMIN", "PROVIDER", "RECEPTIONIST"],
  },
  {
    labelKey: "nav.providers",
    href: "/dashboard/providers",
    icon: Stethoscope,
    roles: ["ADMIN"],
  },
  {
    labelKey: "nav.settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["ADMIN", "PROVIDER", "RECEPTIONIST"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { t } = useLocale();

  const visible = navItems.filter((item) => !role || item.roles.includes(role));

  return (
    <aside className="flex w-56 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Calendar className="size-5" />
          <span>{t("app.name")}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
