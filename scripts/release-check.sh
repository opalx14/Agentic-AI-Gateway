#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Agentic AI Gateway release check =="

echo
echo "[1/6] Bun tests"
bun test

echo
echo "[2/6] TypeScript"
bun run typecheck

echo
echo "[3/6] ESLint"
bun run lint

echo
echo "[4/6] Next.js production build"
bun run build

echo
echo "[5/6] Anchor build + localnet lifecycle"
SDK="${SDKROOT:-}"
if [[ -z "$SDK" ]]; then
  if [[ -d "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk" ]]; then
    SDK="/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"
  elif command -v xcrun >/dev/null 2>&1; then
    SDK="$(xcrun --sdk macosx --show-sdk-path)"
  fi
fi

ANCHOR_BIN="${ANCHOR_BIN:-anchor}"

(
  cd solana
  if [[ -n "$SDK" ]]; then
    SDKROOT="$SDK" "$ANCHOR_BIN" build
    SDKROOT="$SDK" "$ANCHOR_BIN" test --skip-build --validator legacy
  else
    "$ANCHOR_BIN" build
    "$ANCHOR_BIN" test --skip-build --validator legacy
  fi
)

echo
echo "[6/6] HTTP smoke"
if curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
  for path in / /scenarios /scenarios/logistics /scenarios/travel /policies /executions /solana; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000${path}")"
    printf "%s %s\n" "$code" "$path"
    [[ "$code" == "200" ]]
  done
else
  echo "localhost:3000 is not running; skipping dev-server HTTP smoke."
  echo "Run: bun run dev -- --port 3000"
fi

echo
echo "Release check PASS."
