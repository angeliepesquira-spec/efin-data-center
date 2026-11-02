#!/usr/bin/env bash
# Repeatable security checks for the Data Center. Run before every release: bash tools/security-check.sh
# Needs a build first (bun run build). Prints FAIL lines and exits 1 if anything is wrong.
cd "$(dirname "$0")/.." || exit 1
bad=0
fail() { echo "FAIL: $1"; bad=1; }

# 1. Every exported operation in the server file checks the password first (verifyPassword/checkPassword excepted).
for fn in $(grep -oE "^export async function [a-zA-Z]+" src/lib/data-center/datacenter.server.ts | awk '{print $4}'); do
  body=$(awk -v f="$fn" '$0 ~ "^export async function "f"\\(" {p=1} p {print} p && /^}$/ {exit}' src/lib/data-center/datacenter.server.ts)
  # createUpload takes an object whose first check can be a few lines down
  echo "$body" | head -14 | grep -q "requirePassword" || fail "$fn does not call requirePassword near its start"
done

# 2. No secret names or service keys in the browser build.
if [ -d dist/client ]; then
  grep -rlE "APP_PASSWORD|SERVICE_ROLE|service_role" dist/client >/dev/null 2>&1 && fail "secret name found in dist/client"
else echo "note: dist/client missing, run bun run build for check 2"; fi

# 3. The last storage policy migration for the uploads bucket must not leave a policy open to signed-in users.
last=$(grep -lE "taxx-uploads" supabase/migrations/*.sql | sort | tail -1)
if [ -n "$last" ] && ! grep -qiE "DROP POLICY" "$last"; then
  grep -qiE "CREATE POLICY.*(authenticated|anon|public)" "$last" && fail "$last opens taxx-uploads to non-server users"
fi

# 4. Upload request has a size limit.
grep -q "base64: z.string().min(1).max(" src/lib/data-center/api.functions.ts || fail "upload size limit missing"

# 5. Security headers middleware present.
grep -q "nosniff" src/start.ts || fail "security headers missing in src/start.ts"

# 6. Page scripts: report text must not be written to the page unescaped. Flags innerHTML lines that use a data field
#    named name/email/notes/link/note without esc( on the same line.
grep -nE "innerHTML" public/data-center/*.js | grep -E "\\$\{[a-z]+\.(name|email|notes|link|note|preparer|company)\}" | grep -v "esc(" && fail "possible unescaped report text in innerHTML"

# 7. Types and packages.
bunx tsc --noEmit >/dev/null 2>&1 || fail "type check fails"
crit=$(bun audit 2>&1 | grep "critical:" | grep -v "shell-quote\|GHSA-qx66-fv34-fjm8" | wc -l)
[ "$crit" -eq 0 ] || fail "$crit unexplained critical package advisories (see docs/security-audit.md)"

[ $bad -eq 0 ] && echo "All security checks passed"
exit $bad
