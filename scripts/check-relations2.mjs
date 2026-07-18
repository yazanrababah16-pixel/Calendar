import pg from "pg";
const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require",
});
await c.connect();

const users = await c.query(`
  SELECT u.id, u.email, u.name, u.role,
    CASE WHEN p.id IS NOT NULL THEN true ELSE false END AS has_patient,
    CASE WHEN pr.id IS NOT NULL THEN true ELSE false END AS has_provider
  FROM "users" u
  LEFT JOIN "patients" p ON p."userId" = u.id
  LEFT JOIN "providers" pr ON pr."userId" = u.id
  ORDER BY u."createdAt";
`);
console.log("=== Users vs Linked Records ===");
for (const row of users.rows) {
  console.log(
    `${row.email} [${row.role}] -> patient:${row.has_patient} provider:${row.has_provider}`,
  );
}

const mismatched = await c.query(`
  SELECT u.email, u.name, u.role
  FROM "users" u
  JOIN "providers" pr ON pr."userId" = u.id
  WHERE u.role != 'PROVIDER';
`);
console.log("\n=== Providers with wrong role:", mismatched.rows.length);
for (const row of mismatched.rows) {
  console.log(`  ${row.email} has role ${row.role} but has provider record`);
}

const mismatchedPat = await c.query(`
  SELECT u.email, u.name, u.role
  FROM "users" u
  JOIN "patients" p ON p."userId" = u.id
  WHERE u.role != 'PATIENT';
`);
console.log("\n=== Patients with wrong role:", mismatchedPat.rows.length);
for (const row of mismatchedPat.rows) {
  console.log(`  ${row.email} has role ${row.role} but has patient record`);
}

await c.end();
