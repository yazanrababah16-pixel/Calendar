import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  const adminUser = await db.user.upsert({
    where: { email: "admin@clinic.com" },
    update: {},
    create: {
      email: "admin@clinic.com",
      name: "Admin User",
      role: "ADMIN",
      passwordHash,
    },
  });
  console.log("Admin user:", adminUser.id);

  const providerUser = await db.user.upsert({
    where: { email: "doctor@clinic.com" },
    update: {},
    create: {
      email: "doctor@clinic.com",
      name: "Dr. Sarah Smith",
      role: "PROVIDER",
      passwordHash,
    },
  });
  console.log("Provider user:", providerUser.id);

  const provider = await db.provider.upsert({
    where: { userId: providerUser.id },
    update: {},
    create: {
      userId: providerUser.id,
      specialty: "General Medicine",
      phone: "+1-555-0100",
      bio: "Experienced general practitioner",
    },
  });
  console.log("Provider:", provider.id);

  const receptionistUser = await db.user.upsert({
    where: { email: "reception@clinic.com" },
    update: {},
    create: {
      email: "reception@clinic.com",
      name: "Jane Receptionist",
      role: "RECEPTIONIST",
      passwordHash,
    },
  });
  console.log("Receptionist user:", receptionistUser.id);

  const patientUser = await db.user.upsert({
    where: { email: "patient@example.com" },
    update: {},
    create: {
      email: "patient@example.com",
      name: "John Patient",
      role: "PATIENT",
      passwordHash,
    },
  });
  console.log("Patient user:", patientUser.id);

  const patient = await db.patient.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      dateOfBirth: new Date("1990-01-15"),
      phone: "+1-555-0200",
      notes: "New patient",
    },
  });
  console.log("Patient:", patient.id);

  const weekdays = [1, 2, 3, 4, 5];
  for (const day of weekdays) {
    await db.availability.upsert({
      where: {
        providerId_dayOfWeek: { providerId: provider.id, dayOfWeek: day },
      },
      update: {},
      create: {
        providerId: provider.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
      },
    });
  }
  console.log("Availability slots created");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
