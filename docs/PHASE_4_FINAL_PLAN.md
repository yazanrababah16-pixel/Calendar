# Phase 4: Clinical, Analytics & Production Polish

## Track 1: Electronic Medical Records (EMR)

- [x] Create `MedicalRecord` model in Prisma schema (linked to Patient, Provider, Appointment 1:1)
- [x] Run migration `add_emr_module`
- [x] Create `src/server/actions/clinical.ts` — `addMedicalRecord`, `getMedicalRecord`, `getPatientMedicalRecords`
- [x] Update BookingModal with EMR tab/modal for PROVIDER role to add/view diagnosis, prescription, notes

## Track 2: Analytics & Admin Dashboard

- [ ] Install `recharts` charting library
- [ ] Create `src/server/actions/analytics.ts` — monthly revenue, appointment status distribution, provider workload
- [ ] Overhaul ADMIN dashboard with revenue bar/line chart + appointment status pie/donut chart

## Track 3: Production Seeding & Polish

- [ ] Overhaul `prisma/seed.ts` with realistic demo data:
  - 1 Admin, 2 Receptionists, 3 Providers (with working hours, leave requests)
  - 15+ Patients linked to providers
  - Dozens of appointments (past, upcoming, cancelled) with invoices, payments, medical records
  - All users password: `Clinic@123`
- [ ] Verify `prisma db seed` command in package.json
