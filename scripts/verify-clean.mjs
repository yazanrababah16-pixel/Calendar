import pg from "pg";
const c = new pg.Client({
  connectionString:
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require",
});
await c.connect();

const r = await c.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
console.log("Tables after cleanup:", r.rows.map((x) => x.table_name).join("\n"));
console.log("---");
console.log(
  "Any singular-named tables remaining:",
  r.rows.some((x) => /^[a-z]/.test(x.table_name) === false),
);

// Check row counts
const tables = [
  "users",
  "patients",
  "providers",
  "appointments",
  "availabilities",
  "workflow_events",
];
for (const t of tables) {
  const cr = await c.query(`SELECT count(*)::int as cnt FROM "${t}"`);
  console.log(`${t}: ${cr.rows[0].cnt} rows`);
}

await c.end();
