#!/bin/sh
# ---------------------------------------------------------------------------
# CyberRange "Compliance Portal" lab — container entrypoint
#
# The DDS-CMS portal analyses one or more *consent sources*. When none is
# configured every page shows "No Platform Connected", which is not a useful
# state for a lab that is launched with no arguments.
#
# If the operator has NOT supplied a source (CONSENT_SOURCES or any
# CONSENT_SOURCE_* variable), we register a single demo source whose URL points
# back at this same container. server/services/consentSources.js recognises the
# loopback and serves the bundled demo dataset (data/consentScenarios.js)
# directly, with no outbound network call — so the lab is fully self-contained
# and works offline.
#
# To point the lab at a real consent API instead, pass your own
# CONSENT_SOURCES (or CONSENT_SOURCE_ECOM=...) and this block is skipped.
# ---------------------------------------------------------------------------
set -e

PORT="${PORT:-4000}"

if [ -z "${CONSENT_SOURCES:-}" ] && [ -z "$(env | grep '^CONSENT_SOURCE_' || true)" ]; then
  export CONSENT_SOURCES="{\"cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2\":{\"url\":\"http://127.0.0.1:${PORT}/api/consents\",\"sector\":\"ecommerce\",\"label\":\"Deeptrust Demo Store\"}}"
  echo "[entrypoint] No CONSENT_SOURCES supplied — starting in self-contained demo mode."
fi

exec "$@"
