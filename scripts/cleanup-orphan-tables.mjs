import pg from "pg";
const c = new pg.Client({
  connectionString:
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require",
});
await c.connect();

const tables = ["Appointment", "appointments", "Patient", "patients"];
for (const t of tables) {
  try {
    const r = await c.query(`SELECT count(*)::int as cnt FROM "${t}"`);
    console.log(`${t}: ${r.rows[0].cnt} rows`);
  } catch (e) {
    console.log(`${t}: does not exist`);
  }
}

await c.query('DROP TABLE IF EXISTS "Appointment"');
await c.query('DROP TABLE IF EXISTS "Patient"');
console.log('Dropped orphan tables "Appointment" and "Patient"');

const r = await c.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
console.log("Remaining tables:", r.rows.map((x) => x.table_name).join(", "));

await c.end();
