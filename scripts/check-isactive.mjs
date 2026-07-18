import pg from "pg";
const c = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require",
});
await c.connect();

const r = await c.query('SELECT id, "isActive", "userId" FROM "providers"');
console.log(r.rowCount, "providers found");
for (const row of r.rows) {
  console.log(
    row.id.slice(0, 8) + "...",
    "isActive:",
    row.isActive,
    "userId:",
    row.userId.slice(0, 8) + "...",
  );
}

// Now simulate what the API does
const r2 = await c.query(
  'SELECT id, "isActive", "userId" FROM "providers" WHERE "isActive" = true',
);
console.log("\nAfter isActive=true filter:", r2.rowCount, "providers");

await c.end();
