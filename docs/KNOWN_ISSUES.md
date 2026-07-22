# Known Issues & Resolved Incidents

> Log of non-trivial bugs, their root causes, and how they were fixed.

---

## 1. "Invalid Email or Password" — Login Failure

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Date**       | 2026-07-22                                                                                                                                                                                                                                                                                                                                                                     |
| **Symptom**    | Login form returns "Invalid email or password" for all users, despite correct credentials (`admin@clinic.com` / `Clinic@123`). Users exist in the database with properly bcrypt-hashed passwords.                                                                                                                                                                              |
| **Location**   | `src/lib/auth.ts` — NextAuth `authorize` function communicating with Neon PostgreSQL                                                                                                                                                                                                                                                                                           |
| **Root Cause** | The Neon database password in `DATABASE_URL` (and `DIRECT_DATABASE_URL`) had expired or been rotated. The `authorize` function's database query silently failed — it could not connect to Neon — and returned `null`. NextAuth surfaces a connection failure the same way as a wrong password: "Invalid email or password".                                                    |
| **Fix**        | 1. Generate a new password via Neon Console: Project → Settings → Database → Reset password<br>2. Update `DATABASE_URL` and `DIRECT_DATABASE_URL` in `.env.local` with the new password<br>3. For production deployments, update the same variables in the hosting dashboard (e.g., Vercel Environment Variables)<br>4. Restart the dev server so the new env vars take effect |

### Technical Detail

NextAuth's `authorize` function (line 14–34 of `src/lib/auth.ts`) dynamically imports the Prisma db client and queries for the user. If the `pg.Pool` connection fails (wrong password, SSL error, network issue), the database query throws. NextAuth catches this and returns `null` — the same result as a bad password. There is no distinction in the UI between "database unreachable" and "wrong credentials".

```ts
// src/lib/auth.ts (simplified)
const user = await db.user.findUnique({ where: { email } }); // throws if DB unreachable
if (!user || !user.passwordHash) return null; // catches → returns null
```

### Prevention

- Set up Neon password expiry alerts in the Neon Console
- Use a secrets manager (e.g., Doppler, Vercel Environment Variables) rather than manual `.env` files
- Add a database health-check endpoint that returns a clear error when the connection fails

---

## 2. React Error #418 — Hydration Mismatch

(See `docs/TROUBLESHOOTING_AND_ERRORS.md` for this and other recurrent issues.)
