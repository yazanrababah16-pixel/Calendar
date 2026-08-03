# Audit & Fix Plan — "Failed to load providers"

## 1. Rule Compliance Audit

### 1.1 Files Audited

| File                                                  | Role                         |
| ----------------------------------------------------- | ---------------------------- |
| `rules/tanstack-query-v5-cursorrules-prompt-file.mdc` | TanStack Query v5 patterns   |
| `rules/vercel-deployment.mdc`                         | Vercel deployment & env vars |
| `rules/database.mdc`                                  | Prisma + DB patterns         |
| `rules/security-devsecops-ssdls-appsec.mdc`           | Auth, secrets, RBAC          |
| `rules/clean-code.mdc`                                | Code quality                 |
| `rules/typescript.mdc`                                | TS patterns                  |
| `rules/react.mdc`                                     | React component patterns     |
| `src/server/actions/providers.ts`                     | Server action                |
| `src/app/api/providers/route.ts`                      | API route                    |
| `src/proxy.ts`                                        | Middleware                   |
| `src/lib/queries/providers.ts`                        | TanStack Query factory       |

### 1.2 Audit: `src/app/api/providers/route.ts` vs Rules

| Rule                                   | Status  | Finding                                                     |
| -------------------------------------- | ------- | ----------------------------------------------------------- |
| **DB:** Include relations in query     | ✅ PASS | `include: { user: { select: { id, name, email, image } } }` |
| **DB:** Use proper error codes         | ✅ PASS | Returns 401 for auth failure, 400 for bad params            |
| **DB:** Connection pooling             | ✅ PASS | Uses `DATABASE_URL` (pooled) via `src/lib/db.ts`            |
| **Ver:** Handle errors + HTTP codes    | ✅ PASS | `try/catch` via Next.js runtime, proper status codes        |
| **Sec:** Auth check before data access | ✅ PASS | `auth()` check returns 401 if no session                    |
| **TS:** Explicit return types          | ✅ PASS | `NextResponse.json()` typed by inference                    |
| **CC:** Single responsibility          | ✅ PASS | One endpoint, one purpose                                   |

### 1.3 Audit: `src/server/actions/providers.ts` vs Rules

| Rule                                | Status  | Finding                                         |
| ----------------------------------- | ------- | ----------------------------------------------- |
| **Sec:** RBAC enforced              | ✅ PASS | `session.user.role !== "ADMIN"` check           |
| **Sec:** bcrypt for passwords       | ✅ PASS | `bcrypt.hash(password, 12)`                     |
| **Sec:** Input validation           | ✅ PASS | Zod schema (`createProviderSchema`)             |
| **DB:** Relations created correctly | ✅ PASS | Creates `User` + `Provider` linked via `userId` |
| **TS:** Proper error return type    | ✅ PASS | `ActionResult` union type                       |
| **CC:** Single responsibility       | ✅ PASS | One action, clear purpose                       |

### 1.4 Audit: `src/proxy.ts` (Middleware) vs Rules

| Rule                                       | Status  | Finding                            |
| ------------------------------------------ | ------- | ---------------------------------- |
| **Ver:** Matcher scoped correctly          | ✅ PASS | `matcher: ["/((?!_next/static      | _next/image | favicon.ico | public/).*)"]` |
| **Ver:** API routes excluded from redirect | ✅ PASS | `!isApiRoute` guard on role checks |
| **Sec:** RBAC for page routes              | ✅ PASS | `roleRoutes` map with role arrays  |
| **TS:** Type safety                        | ✅ PASS | `Role` union type used throughout  |

### 1.5 Audit: Query Factory (`src/lib/queries/providers.ts`) vs Rules

| Rule                                    | Status  | Finding                                                |
| --------------------------------------- | ------- | ------------------------------------------------------ |
| **TQ:** `queryOptions()` pattern        | ✅ PASS | Uses `queryOptions()` factory                          |
| **TQ:** Stable query keys               | ✅ PASS | `["providers", filters]` structure                     |
| **TQ:** Error state exposed             | ✅ PASS | `isError` + `error` now destructured in `ProviderList` |
| **TQ:** No direct fetch in components   | ✅ PASS | Fetch inside `queryFn` only                            |
| **TQ:** Never inline `useQuery` options | ✅ PASS | Uses factory functions                                 |

---

## 2. Systematic Debug Plan — "Failed to load providers"

### 2.1 Failure Chain Trace

```
Browser: fetch("/api/providers?isActive=true")
  ↓
Middleware (proxy.ts): matches /api → skips all checks
  ↓
API Route (/api/providers/route.ts):
  auth() → reads session cookie from request headers
    ↓ if cookie missing or invalid → returns null
      → Returns 401 JSON { error: "Unauthorized" }
    ↓ if cookie valid → returns session
      → Queries DB → returns providers JSON
  ↓
Client: fetch receives response
  ↓ if !res.ok (401/500) → throws "Failed to fetch providers"
  ↓
TanStack Query: isError = true, data = undefined
  ↓
UI: "Failed to load providers" (our error state)
```

### 2.2 Root Cause Analysis

**Database connection:** ✅ VERIFIED WORKING (see `scripts/verify-db.mjs`)

```
Users: 7 | Providers: 2 | Connection: OK
```

**API query (direct DB):** ✅ VERIFIED WORKING

```
Dr. Sarah Smith - doctor@clinic.com - active: true - role: PROVIDER
Dr. Sara - sara@gmail.com - active: true - role: PROVIDER
```

**Zod coercion:** ✅ VERIFIED WORKING (`z.coerce.boolean().parse("true")` → `true`)

**Likely root cause: ⚠️ AUTH_SECRET mismatch**

The `auth()` call in the API route reads the session cookie, decrypts it with `AUTH_SECRET`. If Vercel's `AUTH_SECRET` differs from the one that created the session cookie, `auth()` returns `null` → 401.

### 2.3 Debug Steps (in order)

| #   | Step                                    | How to verify                                   | Expected                         |
| --- | --------------------------------------- | ----------------------------------------------- | -------------------------------- |
| 1   | **Open browser DevTools → Network tab** | Filter by `providers`                           | See the request                  |
| 2   | **Check the HTTP status**               | Look at `providers?isActive=true` response      | Should be 200                    |
| 3   | **Check if status is 401**              | Response body: `{"error":"Unauthorized"}`       | → AUTH_SECRET issue              |
| 4   | **Check if status is 500**              | Response body: error stack                      | → DB/query issue                 |
| 5   | **Verify Vercel env vars**              | Vercel Dashboard → Settings → Env Variables     | `AUTH_SECRET` must be set        |
| 6   | **Clear cookies & re-login**            | `https://calendar-beige-eight.vercel.app/login` | New session with matching secret |
| 7   | **After re-login, test API**            | Visit `/api/providers` directly in browser tab  | Should return JSON               |

---

## 3. Remediation

### 3.1 Fixes Already Applied

| Fix                                | File                                      | Date   |
| ---------------------------------- | ----------------------------------------- | ------ |
| Error handling for fetch failures  | `provider-list.tsx`                       | Latest |
| Error handling for appointments    | `appointments/page.tsx`                   | Latest |
| Error handling for calendar        | `calendar/page.tsx`                       | Latest |
| Provider dialog + server action    | `add-provider-dialog.tsx`, `providers.ts` | Latest |
| Middleware role fix (RECEPTIONIST) | `proxy.ts`                                | Latest |
| Sidebar role fix                   | `sidebar.tsx`                             | Latest |
| Existing user → Provider promotion | `providers.ts`                            | Latest |

### 3.2 Remaining Action Required

| #   | Action                                | Location                                       |
| --- | ------------------------------------- | ---------------------------------------------- |
| 1   | Set `AUTH_SECRET` in Vercel Dashboard | `+QWgENc/xjwYWbiSgwgIU/x69f6xvmESykzP+vAW2U0=` |
| 2   | Redeploy on Vercel                    | Auto-deploys on git push                       |
| 3   | Log out of the app                    | Click "Sign out"                               |
| 4   | Log back in                           | Use admin credentials                          |
| 5   | Verify `/api/providers` returns 200   | Open in browser tab after login                |

### 3.3 How to Verify the Fix

After completing steps 3.2:

1. Open **Vercel Dashboard** → `calendar` project → **Logs** tab
2. Filter by `/api/providers`
3. You should see a `200` response with the providers JSON array
4. On the site, the Providers page should show the doctor cards instead of "Failed to load providers"

If the issue persists after all steps, open the **browser DevTools Console (F12)** → **Network tab** → reload the page → click the `providers?isActive=true` request and report the exact HTTP status code and response body here.
