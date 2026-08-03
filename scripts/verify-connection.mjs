import pg from "pg";
import { randomUUID } from "node:crypto";

const urls = {
  pooled:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  direct:
    process.env.DIRECT_DATABASE_URL ||
    "postgresql://neondb_owner:npg_AvCF1DO0Wlmq@ep-rapid-king-awkbvf7a.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require",
};

console.log("=== Testing Database Connections ===\n");

// Test pooled
try {
  const c1 = new pg.Client({ connectionString: urls.pooled });
  await c1.connect();
  const r1 = await c1.query("SELECT 1 AS ok");
  const r2 = await c1.query('SELECT COUNT(*)::int AS cnt FROM "users"');
  const r3 = await c1.query('SELECT COUNT(*)::int AS cnt FROM "providers"');
  console.log("✅ POOLED connection: OK");
  console.log(`   Users: ${r2.rows[0].cnt}, Providers: ${r3.rows[0].cnt}`);
  await c1.end();
} catch (e) {
  console.log("❌ POOLED connection FAILED:", e.message);
}

// Test direct
try {
  const c2 = new pg.Client({ connectionString: urls.direct });
  await c2.connect();
  const r1 = await c2.query("SELECT 1 AS ok");
  console.log("✅ DIRECT connection: OK");
  await c2.end();
} catch (e) {
  console.log("❌ DIRECT connection FAILED:", e.message);
}

console.log("\n=== Checking AUTH_SECRET ===");
const secret = process.env.AUTH_SECRET;
if (secret === "local-dev-auth-secret-change-in-production") {
  console.log("⚠️  AUTH_SECRET is still the DEFAULT dev secret!");
  console.log("   This will cause session validation failures in production.");
  console.log(
    "   Generate a new one: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
  );
} else {
  console.log("✅ AUTH_SECRET is set to a custom value");
}
