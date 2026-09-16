#!/bin/sh
# Run both web-crypto apps; if either exits, stop the container so it restarts.
set -e
python web-crypto/app.py l19 &
P19=$!
python web-crypto/app.py l20 &
P20=$!
# poll both PIDs; exit as soon as one dies (portable, no `wait -n`)
while kill -0 "$P19" 2>/dev/null && kill -0 "$P20" 2>/dev/null; do
  sleep 2
done
echo "[!] a web-crypto app exited; shutting down for restart"
kill "$P19" "$P20" 2>/dev/null || true
exit 1
