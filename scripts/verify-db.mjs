import { config } from "dotenv";
config();

import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  console.log("Testing DATABASE_URL connection...");

  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const r = await c.query("SELECT 1 AS ok");
  console.log("Connection:", r.rows[0].ok === 1 ? "OK" : "FAIL");

  const r2 = await c.query('SELECT COUNT(*)::int AS cnt FROM "users"');
  const r3 = await c.query('SELECT COUNT(*)::int AS cnt FROM "providers"');
  console.log("Users:", r2.rows[0].cnt, "| Providers:", r3.rows[0].cnt);

  const r4 = await c.query('SELECT email, role FROM "users" ORDER BY "createdAt"');
  console.log("\nUsers:");
  for (const row of r4.rows) {
    console.log("  " + row.email + " [" + row.role + "]");
  }

  await c.end();
}

main().catch(console.error);
