/**
 * Quick DB + Auth verification script.
 * Run: node scripts/quick-debug.mjs
 *
 * This tests:
 * 1. DATABASE_URL connection
 * 2. Provider records exist
 * 3. AUTH_SECRET is not the dev default
 * 4. Direct API simulation
 */

import { config } from "dotenv";
config();

import pg from "pg";

async function main() {
  const errors = [];

  // 1. Test DB connection
  try {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    const r = await c.query("SELECT 1 AS ok");
    if (r.rows[0].ok === 1) {
      console.log("✅ DATABASE_URL: Connected");
    }
    const r2 = await c.query('SELECT COUNT(*)::int AS cnt FROM "providers"');
    console.log(`   Providers in DB: ${r2.rows[0].cnt}`);
    const r3 = await c.query(
      'SELECT u.email, u.role FROM "users" u JOIN "providers" p ON p."userId" = u.id',
    );
    for (const row of r3.rows) {
      console.log(`   - ${row.email} [${row.role}]`);
    }
    await c.end();
  } catch (e) {
    errors.push(`DATABASE_URL connection failed: ${e.message}`);
    console.log("❌ DATABASE_URL:", e.message);
  }

  // 2. Test AUTH_SECRET
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    errors.push("AUTH_SECRET is not set");
    console.log("❌ AUTH_SECRET: NOT SET");
  } else if (secret === "local-dev-auth-secret-change-in-production") {
    errors.push("AUTH_SECRET is still the dev default");
    console.log("❌ AUTH_SECRET: Using dev default — WILL CAUSE SESSION FAILURES IN PRODUCTION");
  } else {
    console.log("✅ AUTH_SECRET: Custom value set");
  }

  // 3. Summary
  console.log("\n=== Summary ===");
  if (errors.length === 0) {
    console.log("✅ All checks passed.");
    console.log("\nIf the UI still shows errors, the issue is on Vercel side:");
    console.log("  1. AUTH_SECRET in Vercel env vars must match .env");
    console.log("  2. User must log out and log back in");
    console.log("  3. Check Vercel Logs for API route errors");
  } else {
    console.log(`❌ ${errors.length} issue(s) found:`);
    for (const e of errors) {
      console.log(`   - ${e}`);
    }
  }
}

main().catch(console.error);
