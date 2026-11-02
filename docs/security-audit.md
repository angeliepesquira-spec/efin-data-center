# Taxx Savage Data Center: security audit

Date: 2026-11-02. Method: the Cloudflare security-audit approach (name the trust boundary, prove with a bounded local test,
do not assume infrastructure we cannot see, separate severity from confidence, smallest fix plus a test).
No real data or secrets are in this file.

## What was checked

Password gate and every server function, uploads and parsing, storage (database tables and the private file bucket),
the pages' own scripts (every place report text is written into the page), exports, packages, and response headers.

## Confirmed and fixed

| # | Finding | Severity | Evidence | Fix |
|---|---------|----------|----------|-----|
| 1 | Storage policy `"taxx-uploads authenticated read/write"` let ANY signed-in Supabase user read and write the bucket that holds the original uploaded files. The project's anon key is public (it is in `.env`), so if Supabase sign-ups are on, anyone can create an account and reach the files. The server never needs this policy: it uses the service-role key. | High if sign-ups are enabled (needs-validation in the Supabase dashboard); otherwise Medium | Migration `..._store_original_uploads_in_private_bucket.sql` | New migration `20261102090000_remove_unneeded_storage_policy.sql` drops the policy. Only the server can reach the files now. |
| 2 | No cost to guessing the shared password: unlimited fast attempts. | Medium (confidence: confirmed in code; real exposure depends on password strength) | Wrong password was answered immediately | Every wrong password now waits about 0.8 seconds (measured 1.26 s round trip). Add a Cloudflare rate-limiting rule on the site for a real limit (see below). |
| 3 | Upload size had no ceiling in the request check, so one huge request could use up server memory. | Low | `base64: z.string().min(1)` | Limited to 60,000,000 characters (about 45 MB of file). Real reports are a few MB. |
| 4 | Missing basic browser protections on responses. | Low | `curl -I` showed none | `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` on every response. Framing was left alone on purpose so AI Studio previews keep working. |
| 5 | CSV fallback export: text from reports starting with `=`, `+`, `-`, `@` would run as a formula when opened in Excel (the .xlsx export is not affected, it writes text cells). | Low | Reading `exportSheets` | Such text gets a leading apostrophe. Numbers such as -5 are untouched (tested). |
| 6 | Package `seroval` (used by the framework to read requests) had a critical bypass advisory (GHSA-p6vx-979v-rg4c). | High (it parses data sent by anyone) | `bun audit` | Pinned to a fixed version through `overrides` (now 1.7.6). Type check and build pass. |

## Checked and found fine (no finding)

- Every one of the 10 server functions checks the password on the server (constant-time compare). No service-role key or `APP_PASSWORD` is in the browser bundle (`dist/client` searched).
- Report text written into pages: every place in the dashboard, accounts, reports, upload and Ask pages escapes text; the remaining raw values are fixed labels, month names or numbers. Links from the data are only used when they start with `http(s)://`, and open with `rel="noopener"`.
- Cross-site requests to server functions are blocked by the framework's CSRF middleware.
- The page bridge between the app and the dashboard checks origin and sender in both directions.
- Sensitive columns (SSN, bank numbers, birth dates, addresses, cards) are removed before the working copy is stored; numbers of 8-9 digits are scrubbed from the list reports.

## Needs a decision or a check outside the code

1. **Original files in the bucket (High if the bucket is ever exposed).** AI Studio stores the ORIGINAL upload (with SSNs and bank numbers for Federal/RA files) in the private bucket. After fix 1 only the server can read it, which is acceptable, but the safest option is to keep only a cleaned copy for Federal and RA files. This needs the owner's decision; nothing was changed.
2. **Supabase sign-ups:** in the Supabase dashboard, Authentication > Providers/Settings, turn off "Allow new users to sign up" if nobody should create accounts. This decides whether finding 1 was exploitable.
3. **Rate limit:** add a Cloudflare rate-limiting rule (for example 10 requests per minute per address on `/_serverFn/*`). The delay in fix 2 cannot stop many parallel guesses.
4. **Use a long password** (16+ characters). Everyone shares one password and there are no per-person roles yet.
5. **TanStack Start advisory GHSA-qx66-fv34-fjm8** (reflected XSS in server-function responses): the fixed versions change the framework's API and broke the project's own server functions in a trial, so the upgrade was NOT applied. Our responses are JSON returned to POST calls from the page, so no reachable path was proven. Re-test after AI Studio moves to a fixed framework version.
6. **`xlsx@0.18.5`** (prototype pollution and slow-pattern advisories): no fixed version exists on npm. Exposure needs a crafted file uploaded by someone who has the password, or tricking the owner into uploading one. Only upload files you exported yourself. The upload size limit reduces the damage.
7. **cdnjs script for Excel export** has no integrity hash. Low; it is the same package and only used for downloads.
8. **Passwords in the browser:** the password is kept in `sessionStorage` for the tab only. Acceptable for a private tool; per-person sign-in is the real fix and is on the roadmap.
9. **Hash secret:** the keys that merge Refund Advantage lines use `APP_PASSWORD` as the secret. Changing the password changes the keys, so the next upload of old RA files would be added as new lines instead of updating. Keep the password stable, or tell me before changing it.

## Not a problem (rejected after checking)

- "Dashboard shows data without login": the dashboard only loads after the server accepts the password; the static page holds no data.
- Dev-only advisories (`shell-quote`, `launch-editor`, `vite` dev server) are not part of the deployed app.
