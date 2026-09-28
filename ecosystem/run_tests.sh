#!/usr/bin/env bash
# Runs the headless tests. Usage: ./run_tests.sh [name-filter]
# Set GODOT to your Godot executable if it isn't on your PATH.
set -euo pipefail
cd "$(dirname "$0")"
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . -s tests/run_tests.gd -- "${1:-}"
