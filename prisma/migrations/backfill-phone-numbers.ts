import "dotenv/config";
import pg from "pg";

async function main() {
  console.log("=== Phase 1 Migration: Phone Integrity ===\n");

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const nullResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM patients WHERE phone IS NULL",
  );
  const nullCount = nullResult.rows[0].count;
  console.log(`Patients with NULL phone: ${nullCount}`);

  if (nullCount > 0) {
    await pool.query("UPDATE patients SET phone = $1 WHERE phone IS NULL", ["0799101173"]);
    console.log(`✓ Backfilled ${nullCount} rows`);
  } else {
    console.log("✓ No NULL phones to backfill");
  }

  const verify = await pool.query(
    "SELECT COUNT(*)::int AS count FROM patients WHERE phone IS NULL",
  );
  console.log(`Remaining NULL phones: ${verify.rows[0].count}`);

  const dups = await pool.query(`
    SELECT phone, COUNT(*)::int AS cnt, ARRAY_AGG(id) AS ids
    FROM patients WHERE phone IS NOT NULL
    GROUP BY phone HAVING COUNT(*) > 1
  `);

  if (dups.rows.length > 0) {
    console.log(`\n⚠ Found ${dups.rows.length} duplicate phone numbers:`);
    for (const row of dups.rows) {
      const ids = row.ids;
      console.log(`  Phone: ${row.phone} → ${ids.length} patients`);
      for (let i = 1; i < ids.length; i++) {
        const uniquePhone = `${row.phone}_dup${i}`;
        await pool.query("UPDATE patients SET phone = $1 WHERE id = $2", [uniquePhone, ids[i]]);
        console.log(`    Fixed: ${ids[i]} → ${uniquePhone}`);
      }
    }
  } else {
    console.log("✓ No duplicate phones found");
  }

  console.log("\n=== Done. Schema change can proceed. ===");
  await pool.end();
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
