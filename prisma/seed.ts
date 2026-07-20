import {
  PrismaClient,
  AppointmentStatus,
  InvoiceStatus,
  PaymentMethod,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database with realistic demo data...\n");

  // Clean existing data in dependency order
  console.log("Cleaning existing data...");
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.medicalRecord.deleteMany();
  await db.leaveRequest.deleteMany();
  await db.workingHours.deleteMany();
  await db.patientProvider.deleteMany();
  await db.providerAssignment.deleteMany();
  await db.appointment.deleteMany();
  await db.availability.deleteMany();
  await db.patient.deleteMany();
  await db.provider.deleteMany();
  await db.user.deleteMany();
  console.log("✓ Clean slate\n");

  const passwordHash = await bcrypt.hash("Clinic@123", 12);

  // ── Users ──
  const adminUser = await db.user.upsert({
    where: { email: "admin@clinic.com" },
    update: {},
    create: {
      email: "admin@clinic.com",
      name: "Admin User",
      role: "ADMIN",
      username: "admin",
      passwordHash,
    },
  });
  console.log("✓ Admin:", adminUser.email);

  const receptionist1 = await db.user.upsert({
    where: { email: "reception1@clinic.com" },
    update: {},
    create: {
      email: "reception1@clinic.com",
      name: "Jane Receptionist",
      role: "RECEPTIONIST",
      username: "jane_r",
      passwordHash,
    },
  });
  const receptionist2 = await db.user.upsert({
    where: { email: "reception2@clinic.com" },
    update: {},
    create: {
      email: "reception2@clinic.com",
      name: "Mark Wilson",
      role: "RECEPTIONIST",
      username: "mark_w",
      passwordHash,
    },
  });
  console.log("✓ Receptionists:", receptionist1.email, receptionist2.email);

  // ── Providers ──
  const providerData = [
    {
      email: "doctor1@clinic.com",
      name: "Dr. Sarah Smith",
      username: "dr_sarah",
      specialty: "General Medicine",
      phone: "+1-555-0101",
    },
    {
      email: "doctor2@clinic.com",
      name: "Dr. James Lee",
      username: "dr_james",
      specialty: "Pediatrics",
      phone: "+1-555-0102",
    },
    {
      email: "doctor3@clinic.com",
      name: "Dr. Emily Chen",
      username: "dr_emily",
      specialty: "Dermatology",
      phone: "+1-555-0103",
    },
  ];

  const providers: Array<{ id: string; userId: string; user: { id: string; name: string } }> = [];
  for (const pd of providerData) {
    const user = await db.user.upsert({
      where: { email: pd.email },
      update: {},
      create: {
        email: pd.email,
        name: pd.name,
        role: "PROVIDER",
        username: pd.username,
        passwordHash,
      },
    });
    const provider = await db.provider.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialty: pd.specialty,
        phone: pd.phone,
        bio: `${pd.name} is a specialist in ${pd.specialty}.`,
      },
    });
    providers.push({ id: provider.id, userId: user.id, user: { id: user.id, name: user.name } });
  }
  console.log("✓ 3 Providers created");

  // ── Provider Assignments ──
  const assignmentData: Array<{ providerId: string; userId: string }> = [];
  for (const p of providers) {
    assignmentData.push({ providerId: p.id, userId: receptionist1.id });
    assignmentData.push({ providerId: p.id, userId: receptionist2.id });
  }
  for (const a of assignmentData) {
    await db.providerAssignment.upsert({
      where: { providerId_userId: { providerId: a.providerId, userId: a.userId } },
      update: {},
      create: a,
    });
  }
  console.log("✓ Provider assignments created");

  // ── Working Hours ──
  const workingHoursData: Array<{
    providerId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }> = [];
  for (const p of providers) {
    for (const day of [1, 2, 3, 4, 5]) {
      workingHoursData.push({
        providerId: p.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: day === 5 ? "16:00" : "17:00",
        isActive: true,
      });
    }
  }
  for (const wh of workingHoursData) {
    await db.workingHours.upsert({
      where: { providerId_dayOfWeek: { providerId: wh.providerId, dayOfWeek: wh.dayOfWeek } },
      update: {},
      create: wh,
    });
  }
  console.log("✓ Working hours created");

  // ── Leave Requests ──
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const leaveDays = [14, 30, 10, 7];
  const leaveReasons = [
    "Personal day",
    "Conference attendance",
    "Family event",
    "Medical appointment",
  ];
  for (let i = 0; i < leaveDays.length; i++) {
    const d = new Date(todayStart);
    const dayOffset = leaveDays[i]!;
    d.setDate(d.getDate() + dayOffset);
    await db.leaveRequest.create({
      data: {
        providerId: providers[i % 3]!.id,
        date: d,
        reason: leaveReasons[i]!,
        status: dayOffset < 20 ? "APPROVED" : "PENDING",
      },
    });
  }
  console.log("✓ Leave requests created");

  // ── Patients ──
  const patientNames = [
    "Alice Johnson",
    "Bob Williams",
    "Carol Davis",
    "David Brown",
    "Eve Miller",
    "Frank Wilson",
    "Grace Taylor",
    "Henry Anderson",
    "Ivy Thomas",
    "Jack Jackson",
    "Karen White",
    "Leo Harris",
    "Mia Martin",
    "Noah Garcia",
    "Olivia Martinez",
    "Peter Robinson",
    "Quinn Clark",
    "Rachel Rodriguez",
  ];

  const patients: Array<{ id: string; userId: string }> = [];
  for (let i = 0; i < patientNames.length; i++) {
    const name = patientNames[i]!;
    const user = await db.user.upsert({
      where: { email: `patient${i + 1}@example.com` },
      update: {},
      create: {
        email: `patient${i + 1}@example.com`,
        name,
        role: "PATIENT",
        username: `patient${i + 1}`,
        passwordHash,
      },
    });
    const patient = await db.patient.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        dateOfBirth: new Date(1970 + (i % 40), i % 12, (i % 28) + 1),
        phone: `+1-555-02${String(i).padStart(2, "0")}`,
      },
    });
    patients.push({ id: patient.id, userId: user.id });
  }
  console.log(`✓ ${patients.length} Patients created`);

  // ── Patient-Provider Links ──
  for (let i = 0; i < patients.length; i++) {
    const pat = patients[i]!;
    const prov = providers[i % 3]!;
    await db.patientProvider.upsert({
      where: { patientId_providerId: { patientId: pat.id, providerId: prov.id } },
      update: {},
      create: { patientId: pat.id, providerId: prov.id },
    });
  }
  console.log("✓ Patients linked to providers");

  // ── Appointments (batched) ──
  const titles = [
    "Annual Checkup",
    "Follow-up",
    "Consultation",
    "Routine Exam",
    "Blood Test Review",
    "Vaccination",
    "Skin Screening",
    "Pediatric Checkup",
  ];

  const appointmentInserts: Array<{
    patientId: string;
    providerId: string;
    startTime: Date;
    endTime: Date;
    status: AppointmentStatus;
    title: string;
    notes: string | null;
    color: string;
  }> = [];

  let counter = 0;
  for (let i = 0; i < patients.length; i++) {
    const n = 1 + (i % 2);
    for (let j = 0; j < n; j++) {
      counter++;
      const daysOffset = j === 0 ? -(i + 5) : i + 2;
      const baseDate = new Date(todayStart);
      baseDate.setDate(baseDate.getDate() + daysOffset);
      baseDate.setHours(9 + j * 2, 0, 0, 0);
      const endDate = new Date(baseDate);
      endDate.setHours(endDate.getHours() + 1);

      let status: AppointmentStatus;
      if (daysOffset < 0)
        status =
          i % 5 === 0
            ? AppointmentStatus.CANCELLED
            : i % 4 === 0
              ? AppointmentStatus.NO_SHOW
              : AppointmentStatus.COMPLETED;
      else status = i % 7 === 0 ? AppointmentStatus.CANCELLED : AppointmentStatus.SCHEDULED;

      const patient = patients[i]!;
      const provider = providers[i % 3]!;
      const colors = ["#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316"];
      appointmentInserts.push({
        patientId: patient.id,
        providerId: provider.id,
        startTime: baseDate,
        endTime: endDate,
        status,
        title: titles[counter % titles.length]!,
        notes: i % 6 === 0 ? "Rescheduled: Patient requested evening time" : null,
        color: colors[i % 5]!,
      });
    }
  }

  const created = await db.appointment.createMany({ data: appointmentInserts });
  console.log(`✓ ${created.count} Appointments created`);

  // Fetch created appointments
  const allAppointments = await db.appointment.findMany({ orderBy: { startTime: "asc" } });
  const completed = allAppointments.filter((a) => a.status === AppointmentStatus.COMPLETED);

  // ── Invoices & Payments ──
  const amounts = [50, 75, 100, 120, 150, 200, 250, 300];
  const invoiceInserts: Array<{
    totalAmount: number;
    patientId: string;
    appointmentId: string;
    status: InvoiceStatus;
    dueDate: Date;
    issuedAt: Date;
  }> = [];

  for (let idx = 0; idx < allAppointments.length; idx++) {
    const apt = allAppointments[idx]!;
    if (apt.status !== AppointmentStatus.COMPLETED && apt.status !== AppointmentStatus.CONFIRMED)
      continue;
    if (idx % 3 === 0) continue;

    const dueDate = new Date(apt.startTime);
    dueDate.setDate(dueDate.getDate() + 30);

    invoiceInserts.push({
      totalAmount: amounts[idx % amounts.length]!,
      patientId: apt.patientId,
      appointmentId: apt.id,
      status:
        apt.status === AppointmentStatus.COMPLETED ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
      dueDate,
      issuedAt: apt.startTime,
    });
  }

  if (invoiceInserts.length > 0) {
    await db.invoice.createMany({ data: invoiceInserts });
  }

  // Fetch paid invoices and create payments
  const paidAppointmentIds = invoiceInserts
    .filter((i) => i.status === InvoiceStatus.PAID)
    .map((i) => i.appointmentId);
  if (paidAppointmentIds.length > 0) {
    const paidInvoices = await db.invoice.findMany({
      where: { appointmentId: { in: paidAppointmentIds } },
    });
    const paymentInserts = paidInvoices.map((inv, idx) => ({
      amount: Number(inv.totalAmount),
      paymentMethod: idx % 2 === 0 ? PaymentMethod.CASH : PaymentMethod.CARD,
      invoiceId: inv.id,
      paidAt: inv.issuedAt,
    }));
    await db.payment.createMany({ data: paymentInserts });
    console.log(`✓ ${paidInvoices.length} Invoices created with payments`);
  } else {
    console.log(`✓ ${invoiceInserts.length} Invoices created`);
  }

  // ── Medical Records ──
  const diagnoses = [
    "Acute sinusitis",
    "Hypertension, stage 1",
    "Type 2 diabetes",
    "Allergic rhinitis",
    "Acute bronchitis",
    "Urinary tract infection",
    "Osteoarthritis of knee",
    "Anxiety disorder",
  ];
  const prescriptions = [
    "Amoxicillin 500mg — 3x daily for 7 days",
    "Lisinopril 10mg — 1x daily",
    "Metformin 500mg — 2x daily with meals",
    "Cetirizine 10mg — 1x daily as needed",
    "Albuterol inhaler — 2 puffs every 4-6 hours as needed",
    "Nitrofurantoin 100mg — 2x daily for 5 days",
    "Ibuprofen 600mg — 3x daily with food",
    "Sertraline 50mg — 1x daily",
  ];

  const recordInserts: Array<{
    appointmentId: string;
    patientId: string;
    providerId: string;
    diagnosis: string;
    prescription: string;
    notes: string;
  }> = [];

  for (let idx = 0; idx < completed.length; idx++) {
    const apt = completed[idx]!;
    recordInserts.push({
      appointmentId: apt.id,
      patientId: apt.patientId,
      providerId: apt.providerId,
      diagnosis: diagnoses[idx % diagnoses.length]!,
      prescription: prescriptions[idx % prescriptions.length]!,
      notes:
        idx % 3 === 0
          ? "Patient advised to follow up in 2 weeks if symptoms persist."
          : "No further action needed.",
    });
  }

  if (recordInserts.length > 0) {
    await db.medicalRecord.createMany({ data: recordInserts });
  }
  console.log(`✓ ${recordInserts.length} Medical records created`);

  // ── Summary ──
  console.log("\n═══════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`  Admin:          1`);
  console.log(`  Receptionists:  2`);
  console.log(`  Providers:      ${providers.length}`);
  console.log(`  Patients:       ${patients.length}`);
  console.log(`  Appointments:   ${allAppointments.length}`);
  console.log(`  Invoices:       ${invoiceInserts.length}`);
  console.log(`  Payments:       ${paidAppointmentIds.length}`);
  console.log(`  Medical Records:${recordInserts.length}`);
  console.log("═══════════════════════════════════════");
  console.log("  All users login with: Clinic@123");
  console.log("═══════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
