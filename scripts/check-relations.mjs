import pg from "pg";
const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require",
});
await c.connect();

// 1. Check foreign key constraints
const fk = await c.query(`
  SELECT
    tc.table_schema, tc.table_name, tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name;
`);
console.log("=== Foreign Key Constraints ===");
for (const row of fk.rows) {
  console.log(
    `${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name} (${row.constraint_name})`,
  );
}

// 2. Check users and their linked records
const users = await c.query(`
  SELECT u.id, u.email, u.name, u.role,
    p.id IS NOT NULL AS has_patient_record,
    pr.id IS NOT NULL AS has_provider_record
  FROM users u
  LEFT JOIN patients p ON p.user_id = u.id
  LEFT JOIN providers pr ON pr.user_id = u.id
  ORDER BY u.created_at;
`);
console.log("\n=== Users vs Linked Records ===");
for (const row of users.rows) {
  console.log(
    `${row.email} (${row.name}) [${row.role}] -> patient:${row.has_patient_record} provider:${row.has_provider_record}`,
  );
}

// 3. Check orphan records (patients/providers with no matching user)
const orphanPatients = await c.query(`
  SELECT p.id, p.user_id FROM patients p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL;
`);
console.log("\n=== Orphan patients (no matching user):", orphanPatients.rows.length);
for (const row of orphanPatients.rows) {
  console.log(`  patient ${row.id} -> userId ${row.user_id}`);
}

const orphanProviders = await c.query(`
  SELECT pr.id, pr.user_id FROM providers pr LEFT JOIN users u ON u.id = pr.user_id WHERE u.id IS NULL;
`);
console.log("=== Orphan providers (no matching user):", orphanProviders.rows.length);
for (const row of orphanProviders.rows) {
  console.log(`  provider ${row.id} -> userId ${row.user_id}`);
}

// 4. Check appointments references
const orphanAppts = await c.query(`
  SELECT a.id, a.patient_id, a.provider_id
  FROM appointments a
  LEFT JOIN patients p ON p.id = a.patient_id
  LEFT JOIN providers pr ON pr.id = a.provider_id
  WHERE p.id IS NULL OR pr.id IS NULL;
`);
console.log("\n=== Orphan appointments:", orphanAppts.rows.length);
for (const row of orphanAppts.rows) {
  console.log(`  appointment ${row.id} -> patient:${row.patient_id} provider:${row.provider_id}`);
}

await c.end();
