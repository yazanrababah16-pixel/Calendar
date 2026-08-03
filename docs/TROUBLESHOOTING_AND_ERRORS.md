# Troubleshooting & Errors — Knowledge Base

> Standard reference for diagnosing and fixing recurrent issues in this project.

---

## 1. React Error #418 — Hydration Mismatch

| Field          | Value                                                                                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symptom**    | React Error #418: Text content did not match. Server rendered "X" but client rendered "Y". Appears on full-page reload.                                                                                                                                                          |
| **Location**   | Components reading `localStorage` during initial render (e.g., theme toggle, sidebar state).                                                                                                                                                                                     |
| **Root Cause** | `localStorage` is a client-only API. During SSR, the server renders a default value. On hydration, React sees the client-side value (from `localStorage`) and detects a mismatch.                                                                                                |
| **Fix**        | Replace `useState` + `useEffect` for reading `localStorage` with `useSyncExternalStore`. This hook safely synchronizes server and client state by subscribing to an external store and returning the server value during SSR, then switching to the client value post-hydration. |

### Before

```tsx
const [isOpen, setIsOpen] = useState(true);
useEffect(() => {
  setIsOpen(localStorage.getItem("sidebar-open") === "true");
}, []);
```

### After

```tsx
function getSnapshot() {
  return localStorage.getItem("sidebar-open") === "true";
}
function getServerSnapshot() {
  return true; // default server value
}
const isOpen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
```

---

## 2. Auth.js Redirect Loop — HTML on API Routes

| Field          | Value                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symptom**    | API routes returning HTML instead of JSON. Client fetch calls throwing "Unexpected token < in JSON at position 0". Redirect loops on `/api/*`.                                          |
| **Location**   | `src/proxy.ts` (Next.js middleware wrapping Auth.js).                                                                                                                                   |
| **Root Cause** | Auth.js middleware intercepts unauthenticated requests and redirects to the login page — even for `/api/*` routes. An API client expecting JSON receives an HTML redirect page instead. |
| **Fix**        | Add a guard in the middleware to skip all role checks and redirects when the path starts with `/api`. The API route handler itself calls `auth()` and returns proper JSON errors.       |

### Code

```ts
const isApiRoute = pathname.startsWith("/api");

// Skip all role-based redirects for API routes
if (!isLoggedIn && !isPublic && !isApiRoute) {
  // redirect to login
}
if (isLoggedIn && req.auth?.user && !isApiRoute) {
  // role-based redirect
}
```

---

## 3. 401 Unauthorized After Environment Switch

| Field          | Value                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symptom**    | User logs in successfully on one environment (e.g., localhost), but gets `401 Unauthorized` on another (e.g., Vercel production).                                                                                                                       |
| **Location**   | `src/lib/auth.ts` — Auth.js config using `AUTH_SECRET`.                                                                                                                                                                                                 |
| **Root Cause** | `AUTH_SECRET` is used to encrypt the JWT session cookie. If the secret differs between environments, the session cookie created on localhost cannot be decrypted by Vercel. The initial dev default was `"local-dev-auth-secret-change-in-production"`. |
| **Fix**        | 1. Generate a strong secret: `openssl rand -base64 32`<br>2. Set the same `AUTH_SECRET` in both `.env` (local) and Vercel Environment Variables<br>3. Users must log out and log back in to get a new cookie encrypted with the matching secret         |

### Prevention

- Never use the default placeholder `AUTH_SECRET` in production
- Sync secrets across all environments (local, staging, production)
- Document `AUTH_SECRET` as a required env var on first deploy

---

## 4. 400 Bad Request on API Routes — Zod Validation Failure

| Field          | Value                                                                                                                                                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symptom**    | API routes return `400 Invalid query parameters`. The frontend shows "Failed to load providers" or "Failed to load appointments".                                                                                                                                                                                             |
| **Location**   | `src/app/api/providers/route.ts`, `src/app/api/appointments/route.ts`                                                                                                                                                                                                                                                         |
| **Root Cause** | `URLSearchParams.get("param")` returns `null` when a query parameter is absent from the URL. Zod's `.optional()` only accepts `undefined`, not `null`. When a param like `specialty` or `providerId` is missing, `null` is passed to the Zod schema, which rejects it because `z.string().optional()` does not accept `null`. |
| **Fix**        | Convert `null` to `undefined` with `?? undefined` before passing to `safeParse`.                                                                                                                                                                                                                                              |

### Before

```ts
const parsed = querySchema.safeParse({
  isActive: searchParams.get("isActive"),
  specialty: searchParams.get("specialty"),
});
```

### After

```ts
const parsed = querySchema.safeParse({
  isActive: searchParams.get("isActive") ?? undefined,
  specialty: searchParams.get("specialty") ?? undefined,
});
```

### Affected Files

| File                                | Params Fixed                                              |
| ----------------------------------- | --------------------------------------------------------- |
| `src/app/api/providers/route.ts`    | `isActive`, `specialty`                                   |
| `src/app/api/appointments/route.ts` | `providerId`, `patientId`, `dateFrom`, `dateTo`, `status` |

---

## 5. Silent UI Failures — Empty States Instead of Errors

| Field          | Value                                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Symptom**    | API call fails (e.g., 400, 401, 500), but the UI shows an empty list or blank page with no error message. User doesn't know something went wrong.                                                                    |
| **Location**   | `src/components/providers/provider-list.tsx`, various page components using TanStack Query.                                                                                                                          |
| **Root Cause** | Components only checked `isLoading` from `useQuery`. When the query errored, `data` was `undefined`, and the UI treated it the same as an empty result set — rendering an empty state with no indication of failure. |
| **Fix**        | Destructure `isError` and `error` from `useQuery` and render a dedicated error UI alongside the loading and empty states.                                                                                            |

### Before

```tsx
const { data, isLoading } = useQuery(providersQuery());
if (isLoading) return <Loading />;
if (!data?.length) return <Empty />;
```

### After

```tsx
const { data, isLoading, isError, error } = useQuery(providersQuery());
if (isLoading) return <Loading />;
if (isError) return <ErrorCard message={error.message} />;
if (!data?.length) return <Empty />;
```

### Pattern Applied To

| Component                | Error State                                      |
| ------------------------ | ------------------------------------------------ |
| `provider-list.tsx`      | Shows error card with "Failed to load providers" |
| Calendar week/month view | Shows error alert                                |
| Appointments page        | Shows error alert                                |

---

## 6. Week View Limited to Business Hours (8AM–5PM)

| Field          | Value                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Symptom**    | Weekly calendar only showed hours 8AM–5PM. Overnight appointments not visible.                                           |
| **Location**   | `src/components/calendar/week-view.tsx`                                                                                  |
| **Root Cause** | Hours array hardcoded to `Array.from({ length: 10 }, (_, i) => i + 8)` → `[8, 9, ..., 17]`.                              |
| **Fix**        | Changed to `Array.from({ length: 24 }, (_, i) => i)` → `[0, 1, ..., 23]`, rendering all 24 hours from midnight to 11 PM. |

---

## Appendix: Quick Debug Checklist

When encountering a new issue, check these in order:

1. **Check browser DevTools → Network tab** for the failing request's HTTP status and response body
2. **Check Vercel Logs** for server-side errors (database timeouts, unhandled exceptions)
3. **Verify env vars** — `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_DATABASE_URL` match across environments
4. **Clear cookies / re-login** — especially after changing `AUTH_SECRET`
5. **Run `node scripts/quick-debug.mjs`** — verifies DB connection, provider records, and `AUTH_SECRET` validity
