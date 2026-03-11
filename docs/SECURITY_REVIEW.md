# Security Review – SPS3

This document summarizes the security posture of the Strategic Planning System (SPS3) and the measures applied during the review.

---

## 1. Authentication & session

| Item | Status | Notes |
|------|--------|--------|
| **JWT in cookie** | OK | Token stored in `httpOnly` cookie; not readable by client JS. |
| **Cookie flags** | OK | `secure` in production, `sameSite: 'strict'`, `path: '/'`. |
| **JWT secret** | Fixed | Production now requires `JWT_SECRET`; default/placeholder secret is rejected in production (lib/auth, forgot-password, reset-password). |
| **Token in response body** | Note | Login/Google still return `token` in JSON. Prefer not storing it in client; cookie is the source of truth. |

**Action:** Ensure `JWT_SECRET` is set in production (strong, random value). Do not use the default fallback in production.

---

## 2. Authorization (API routes)

| Area | Status | Notes |
|------|--------|--------|
| **Protected routes** | Fixed | All data APIs now require a valid JWT: token present and `verifyToken(token)` returns a payload. |
| **Invalid token handling** | Fixed | Routes that only called `verifyToken(token)` without checking the result now return 401 when the token is missing or invalid. |
| **Unauthenticated access** | Fixed | `GET /api/activities`, `GET /api/activities/[id]`, `GET /api/dashboard/stats`, and `GET /api/principal/analytics` now require authentication. |

**Routes updated in this review:**

- `GET /api/activities` – auth required
- `GET|PUT /api/activities/[id]` – auth required
- `GET /api/dashboard/stats` – auth required
- `GET /api/dashboard/principal` – invalid token now returns 401
- `GET /api/principal/strategic-summary` – invalid token now returns 401
- `GET /api/principal/analytics` – auth required
- `GET /api/reports` – invalid token now returns 401
- `POST /api/reports/email` – invalid token now returns 401
- `GET /api/users` – invalid token now returns 401
- `PUT /api/users/[id]` – invalid token now returns 401
- `GET /api/users/stats` – invalid token now returns 401

---

## 3. Role-based access

| Item | Status | Notes |
|------|--------|--------|
| **Middleware** | OK | Redirects unauthenticated users from dashboard paths; uses `active_role` for role-based redirects. |
| **API role checks** | Partial | Principal-only actions (e.g. committee proposal approve/reject) check `isPrincipal(decoded)`. Not every API enforces role (e.g. some admin-only endpoints may rely on “only admin can reach this UI”). |
| **Recommendation** | — | For sensitive operations (e.g. user CRUD, strategic activity CRUD), consider explicit role checks (e.g. admin/principal) in addition to “any logged-in user”. |

---

## 4. SQL injection & input handling

| Item | Status | Notes |
|------|--------|--------|
| **Parameterized queries** | OK | Queries use `query({ query: '...', values: [...] })` with placeholders. |
| **Dynamic filters** | OK | Search/role filters (e.g. users list) use parameterized `LIKE` with values in `values[]`. |

No raw string concatenation of user input into SQL was found in the reviewed APIs.

---

## 5. File uploads

| Item | Status | Notes |
|------|--------|--------|
| **Auth** | OK | Upload endpoint requires valid JWT. |
| **Size limit** | OK | 20 MB cap. |
| **Extension whitelist** | OK | Only allowed extensions (e.g. pdf, doc, docx, png, jpeg, jpg, xls, xlsx) accepted. |
| **Path safety** | OK | Filename sanitized (alphanumeric, `._-`), length capped; unique prefix (`Date.now()`) and `path.join` with a fixed upload dir prevent path traversal. |

---

## 6. Sensitive operations & dev tools

| Item | Status | Notes |
|------|--------|--------|
| **Debug / migrate / seed** | OK | Protected by `disallowInProduction()`; return 404 in production. |
| **Password reset** | OK | Reset token is time-limited (e.g. 1h); production requires proper `JWT_SECRET`. |
| **Email enumeration** | OK | Forgot-password returns a generic success message whether or not the email exists. |

---

## 7. Recommendations

1. **Environment**
   - Set a strong, unique `JWT_SECRET` in production.
   - Do not commit `.env` or any file containing secrets.

2. **HTTPS**
   - Use HTTPS in production so the `secure` cookie flag is effective.

3. **Token in login response**
   - Consider removing `token` from the JSON body of login/Google responses and relying only on the cookie to avoid accidental storage in client code.

4. **Role enforcement**
   - Add explicit role checks (e.g. admin/principal) on sensitive APIs (user management, strategic activity updates, report generation) if not already present.

5. **Rate limiting**
   - Consider rate limiting for login, forgot-password, and file upload to reduce brute-force and abuse.

6. **CSP / XSS**
   - Ensure Content-Security-Policy and safe rendering of user content (e.g. via `linkify` and avoiding `dangerouslySetInnerHTML` with unsanitized input) are in place where applicable.

---

## 8. Summary

- **Authentication:** JWT in httpOnly cookie; production requires a configured `JWT_SECRET`.
- **Authorization:** All reviewed data APIs now require a valid token; invalid or missing token returns 401. Previously unauthenticated endpoints (activities, dashboard stats, principal analytics) are now protected.
- **Input & DB:** Parameterized queries used; file uploads are authenticated, size- and type-limited, and path-safe.
- **Dev tools:** Debug/migrate/seed routes disabled in production.

Applying the recommendations above will further harden the system for production use.
