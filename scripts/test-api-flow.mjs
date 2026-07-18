import pg from "pg";
const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require",
});
await c.connect();

// 1. Raw providers count (no filter)
let r = await c.query('SELECT COUNT(*)::int AS cnt FROM "providers"');
console.log("1. Total providers:", r.rows[0].cnt);

// 2. Active providers count
r = await c.query('SELECT COUNT(*)::int AS cnt FROM "providers" WHERE "isActive" = true');
console.log("2. Active providers:", r.rows[0].cnt);

// 3. Providers with their user names
r = await c.query(`
  SELECT pr.id, pr."isActive", u.name, u.email, u.role
  FROM "providers" pr
  JOIN "users" u ON u.id = pr."userId"
`);
console.log("3. Provider + User join:");
for (const row of r.rows) {
  console.log("  ", row.name, "-", row.email, "- active:", row.isActive, "- role:", row.role);
}

// 4. Appointments with patient/provider relations
r = await c.query(`
  SELECT COUNT(*)::int AS cnt FROM "appointments" a
  JOIN "patients" p ON p.id = a."patient_id"
  JOIN "providers" pr ON pr.id = a."provider_id"
`);
console.log("4. Appointments with valid FK refs:", r.rows[0].cnt);

// 5. Check if Zod v4 coercion works as expected
const { z } = await import("zod");
const schema = z.object({ isActive: z.coerce.boolean().optional() });
const parsed = schema.safeParse({ isActive: "true" });
console.log("5. Zod coerce test:", parsed.success ? JSON.stringify(parsed.data) : parsed.error);

await c.end();
