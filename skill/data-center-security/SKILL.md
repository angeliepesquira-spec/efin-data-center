---
name: data-center-security
description: Security review for the Taxx Savage Data Center. Use before every release to main, whenever AI Studio changes storage, auth or uploads, and whenever the owner asks for a security check. Based on the Cloudflare security-audit method.
---

# Data Center security review

The Data Center holds tax-client data. Treat every change as touching a trust boundary.

## Method (from the Cloudflare security-audit approach)
1. Name the boundary: who can reach this (anyone on the internet, someone with the shared password, the server only) and what they could do.
2. Report only what is proven: show the exact input and the wrong result with a bounded local test. No test, no finding.
3. Do not assume infrastructure you cannot see (Supabase dashboard settings, Cloudflare rules). Mark those "needs validation" and tell the owner what to check.
4. Rate severity (Critical / High / Medium / Low / Informational) separately from confidence. A checklist deviation with no reachable harm is not a vulnerability.
5. Fix with the smallest change, add a test or a repeatable check, then re-run.

## Checklist for this project
- Every server function in `api.functions.ts` calls through a `requirePassword` path; none returns data without it.
- No `SUPABASE_SERVICE_ROLE_KEY` or `APP_PASSWORD` in `dist/client` (grep the build).
- Storage and tables: RLS on, no policy for `anon` or `authenticated` on `taxx-uploads` or the data tables; look at every new migration, especially ones AI Studio adds.
- Uploads: size limit in the request schema; sensitive columns removed (`sanitizeSheets`, `scrubIds`) before storing the working copy; the original-file question (cleaned copies vs originals) stays with the owner.
- Page scripts in `public/data-center/`: every report-derived value goes through `esc()` before `innerHTML`; links only when they start with `http(s)://`; no new raw interpolation of strings.
- Exports: text starting with `= + - @` is guarded in the CSV path.
- Responses keep `nosniff` and `no-referrer` (`src/start.ts`).
- Packages: run `bun audit`; production-reachable critical or high items are fixed or written down in `docs/security-audit.md` with the reason. Do not upgrade the TanStack Start framework without building and testing, it broke server functions once.
- No real client data, passwords or keys in git, docs or test files.

## Automatic check
Run `bun run build && bash tools/security-check.sh` first. It checks the password on every server operation, secrets in the build, the storage policy, the upload limit, headers, unescaped text in pages, types and package advisories. It was proven to fail when a password check is removed. The manual checklist above still applies for anything it cannot see.

## Output
Update `docs/security-audit.md` (fixed / checked and fine / needs the owner), mirror it to `efin-data-center`, and tell the owner in plain words what to do outside the code.
