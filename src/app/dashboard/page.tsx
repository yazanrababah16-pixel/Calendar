import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarDays,
  Stethoscope,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Receipt,
} from "lucide-react";
import { LinkByUsername } from "@/components/patients/link-by-username";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

const statusBadge: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  CONFIRMED: "bg-green-100 text-green-700 border-green-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  COMPLETED: "bg-gray-100 text-gray-600 border-gray-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  NO_SHOW: "bg-red-100 text-red-700 border-red-200",
};

const statusIcon: Record<string, React.ReactNode> = {
  SCHEDULED: <Clock className="size-4 text-blue-600" />,
  CONFIRMED: <CheckCircle2 className="size-4 text-green-600" />,
  IN_PROGRESS: <AlertTriangle className="size-4 text-amber-600" />,
  COMPLETED: <CheckCircle2 className="size-4 text-gray-500" />,
  CANCELLED: <XCircle className="size-4 text-red-600" />,
  NO_SHOW: <XCircle className="size-4 text-red-600" />,
};

function extractRescheduleReason(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Rescheduled:\s*(.+?)(?:\n|$)/);
  return match?.[1]?.trim() ?? null;
}

async function PatientDashboard({ userId }: { userId: string }) {
  const patient = await db.patient.findUnique({ where: { userId }, select: { id: true } });
  if (!patient) {
    return <p className="text-sm text-muted-foreground">Patient profile not found.</p>;
  }

  const [links, upcoming, past, invoices] = await Promise.all([
    db.patientProvider.findMany({
      where: { patientId: patient.id },
      include: {
        provider: {
          include: {
            user: { select: { id: true, name: true, email: true, username: true, image: true } },
          },
        },
      },
    }),
    db.appointment.findMany({
      where: {
        patientId: patient.id,
        startTime: { gte: new Date() },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      include: {
        provider: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { startTime: "asc" },
    }),
    db.appointment.findMany({
      where: {
        patientId: patient.id,
        OR: [
          { startTime: { lt: new Date() } },
          { status: { in: ["CANCELLED", "NO_SHOW", "COMPLETED"] } },
        ],
      },
      include: {
        provider: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { startTime: "desc" },
      take: 50,
    }),
    db.invoice.findMany({
      where: { patientId: patient.id },
      include: {
        payments: { orderBy: { paidAt: "desc" } },
        appointment: {
          include: {
            provider: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  const invStatusBadge: Record<string, string> = {
    PENDING: "bg-red-100 text-red-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    PAID: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-8">
      {/* My Doctors + Link by Username */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Stethoscope className="size-5 text-primary" />
          My Doctors
        </h2>
        <LinkByUsername
          doctors={links.map((l) => ({
            id: l.provider.id,
            specialty: l.provider.specialty,
            user: {
              id: l.provider.user.id,
              name: l.provider.user.name,
              email: l.provider.user.email,
              username: l.provider.user.username,
              image: l.provider.user.image,
            },
            linkedAt: l.createdAt.toISOString(),
          }))}
        />
      </section>

      {/* Upcoming Appointments */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <CalendarDays className="size-5 text-primary" />
          Upcoming Appointments
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No upcoming appointments.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((apt) => {
              const rescheduleReason = extractRescheduleReason(apt.notes);
              return (
                <Card key={apt.id} className="overflow-hidden">
                  {rescheduleReason && (
                    <div className="flex items-start gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 border-b border-amber-200">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      <span>
                        <span className="font-medium">Rescheduled: </span>
                        {rescheduleReason}
                      </span>
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {statusIcon[apt.status] ?? <Clock className="size-4" />}
                          <p className="font-medium">{apt.title || "Appointment"}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          with{" "}
                          <span className="font-medium text-foreground">
                            {apt.provider.user.name}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(apt.startTime).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {" — "}
                          {new Date(apt.startTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {" – "}
                          {new Date(apt.endTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          statusBadge[apt.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {apt.status.replace("_", " ")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Past Appointments */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Clock className="size-5 text-muted-foreground" />
          Appointment History
        </h2>
        {past.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No past appointments.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {past.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {statusIcon[apt.status] ?? (
                    <Clock className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{apt.title || "Appointment"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {apt.provider.user.name} &middot;{" "}
                      {new Date(apt.startTime).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusBadge[apt.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {apt.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My Bills / Invoices */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Receipt className="size-5 text-primary" />
          My Bills
        </h2>
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No invoices yet.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Doctor</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-right font-medium">Balance Due</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
                    const total = Number(inv.totalAmount);
                    const balance = total - paid;
                    return (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(inv.issuedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {inv.appointment?.provider.user.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">${total.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {balance > 0 ? (
                            <span className="text-red-600">${balance.toFixed(2)}</span>
                          ) : (
                            <span className="text-green-600">$0.00</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              invStatusBadge[inv.status] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

async function ProviderDashboard({ userId }: { userId: string }) {
  const provider = await db.provider.findUnique({ where: { userId }, select: { id: true } });
  if (!provider) {
    return <p className="text-sm text-muted-foreground">Provider profile not found.</p>;
  }

  const invoices = await db.invoice.findMany({
    where: { appointment: { providerId: provider.id } },
    include: {
      payments: true,
      patient: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { issuedAt: "desc" },
    take: 50,
  });

  const data = invoices.map((inv) => ({
    ...inv,
    totalAmount: Number(inv.totalAmount),
    payments: inv.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
  }));

  const totalInvoiced = data.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalCollected = data.reduce(
    (sum, inv) => sum + inv.payments.reduce((ps, p) => ps + p.amount, 0),
    0,
  );
  const totalOutstanding = totalInvoiced - totalCollected;

  const invStatusStyles: Record<string, string> = {
    PENDING: "bg-red-100 text-red-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    PAID: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      {/* Revenue Summary */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <DollarSign className="size-5 text-primary" />
          Revenue Summary
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Invoiced</p>
              <p className="text-2xl font-bold">${totalInvoiced.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Collected</p>
              <p className="text-2xl font-bold text-green-600">${totalCollected.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-red-600">${totalOutstanding.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Invoice List */}
      {data.length > 0 && (
        <section>
          <h3 className="text-md font-semibold mb-2">Recent Invoices</h3>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Patient</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{inv.patient.user.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(inv.issuedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${inv.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            invStatusStyles[inv.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  if (role === "PATIENT") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">My Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back, {session.user.name}.</p>
        </div>
        <PatientDashboard userId={session.user.id} />
      </div>
    );
  }

  if (role === "PROVIDER") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back, {session.user.name}.</p>
        </div>
        <ProviderDashboard userId={session.user.id} />
      </div>
    );
  }

  if (role === "ADMIN") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview and analytics</p>
        </div>
        <AdminDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back, {session.user.name}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Role</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{role}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{session.user.email}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
