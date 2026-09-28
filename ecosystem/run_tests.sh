#!/usr/bin/env bash
# Runs every automated check: unit tests, then the end-to-end workflow twice
# (do the work, then reopen and check the save). Usage: ./run_tests.sh [name-filter]
# Set GODOT to your Godot executable if it isn't on your PATH.
set -euo pipefail
cd "$(dirname "$0")"
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . -s tests/run_tests.gd -- "${1:-}"
if [ -z "${1:-}" ]; then
  E2E="$(mktemp -d)"
  trap 'rm -rf "$E2E"' EXIT
  "$GODOT" --headless --path . -- --save-dir="$E2E" --scenario=e2e 2>&1 | grep -E "^  (ok|FAIL)|^E2E"
  "$GODOT" --headless --path . -- --save-dir="$E2E" --scenario=e2e-reopen 2>&1 | grep -E "^  (ok|FAIL)|^E2E"
  grep -q . "$E2E/workspace.json"
fi
