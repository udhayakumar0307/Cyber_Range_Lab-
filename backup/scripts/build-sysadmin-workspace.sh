#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${SYSADMIN_WORKSPACE_IMAGE:-cyberrange/rhsa-workspace:0.3}"
echo "Building ${IMAGE} ..."
docker build -t "$IMAGE" "$ROOT/labs/linux-sysadmin-workspace"
echo "Built ${IMAGE}"
