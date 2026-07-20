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
} from "lucide-react";
import Link from "next/link";

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

  const [links, upcoming, past] = await Promise.all([
    db.patientProvider.findMany({
      where: { patientId: patient.id },
      include: {
        provider: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
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
  ]);

  const doctors = links.map((l) => l.provider);

  return (
    <div className="space-y-8">
      {/* My Doctors */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Stethoscope className="size-5 text-primary" />
          My Doctors
        </h2>
        {doctors.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No doctors are linked to you yet. Ask the receptionist to link you to a provider.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(doc.user.name[0] ?? "?").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.user.name}</p>
                    {doc.specialty && (
                      <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
