"""
backend/infrastructure/headscale_acl.py

Manages Headscale policy.hujson dynamically via the Headscale API.
Called from lab_worker.py (after deploy) and lab_cleanup_worker.py (after destroy).

The policy is fetched, mutated in memory, and pushed back atomically.
Headscale reloads the policy automatically on PUT.

Environment variables required:
  HEADSCALE_URL      — e.g. https://sentinel.dedyn.io
  HEADSCALE_API_KEY  — Headscale API key with read/write policy access
"""

import asyncio
import json
import logging
import os
import re

import httpx

from dotenv import load_dotenv
load_dotenv()

log = logging.getLogger("headscale_acl")

HEADSCALE_API_URL = os.environ["HEADSCALE_API_URL"].rstrip("/")
HEADSCALE_API_KEY = os.environ["HEADSCALE_API_KEY"]
POLICY_ENDPOINT   = f"{HEADSCALE_API_URL}/api/v1/policy"

# How long to wait for the Headscale API
REQUEST_TIMEOUT = 10.0

# Retry settings for the compare-and-swap loop
MAX_RETRIES = 5
RETRY_DELAY = 1.0  # seconds between retries on conflict

_headers = {
    "Authorization": f"Bearer {HEADSCALE_API_KEY}",
    "Content-Type":  "application/json",
    "Accept":        "application/json",
}


# ── Low-level API calls ───────────────────────────────────────────────────────

async def _get_policy() -> tuple[str, str]:
    """
    Fetch the current policy from Headscale.
    Returns (policy_str, updated_at) where policy_str is the raw HuJSON string.
    """
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.get(POLICY_ENDPOINT, headers=_headers)
        resp.raise_for_status()
        data = resp.json()
        return data["policy"], data.get("updatedAt", "")


async def _put_policy(policy_str: str) -> dict:
    """
    Push an updated policy string to Headscale.
    Returns the response body.
    """
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.put(
            POLICY_ENDPOINT,
            headers=_headers,
            content=json.dumps({"policy": policy_str}),
        )
        resp.raise_for_status()
        return resp.json()


# ── HuJSON helpers ────────────────────────────────────────────────────────────
# Headscale returns the policy as a HuJSON string (JSON with comments).
# We strip comments before parsing, and work with the parsed dict.
# On write we re-serialise to standard JSON — Headscale accepts both.

def _strip_hujson_comments(text: str) -> str:
    """Remove single-line (//) and block (/* */) comments from HuJSON."""
    # Remove block comments
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    # Remove single-line comments (but not URLs — avoid stripping http://)
    text = re.sub(r"(?<!:)//[^\n]*", "", text)
    return text


def _parse_policy(policy_str: str) -> dict:
    clean = _strip_hujson_comments(policy_str)
    return json.loads(clean)


def _serialise_policy(policy: dict) -> str:
    return json.dumps(policy, indent=2)


# ── ACL entry helpers ─────────────────────────────────────────────────────────

def _make_acl_entry(user_id: str, subnet_cidr: str) -> dict:
    return {
        "action": "accept",
        "src":    [f"user-{user_id}@"],
        "dst":    [f"{subnet_cidr}:*"],
    }


def _entry_matches(entry: dict, user_id: str, subnet_cidr: str) -> bool:
    src_match = entry.get("src") == [f"user-{user_id}@"]
    dst_match = entry.get("dst") == [f"{subnet_cidr}:*"]
    return src_match and dst_match


def _add_acl_entry(policy: dict, user_id: str, subnet_cidr: str) -> bool:
    """
    Add an ACL entry for (user_id, subnet_cidr) if not already present.
    Returns True if the policy was modified.
    """
    acls = policy.setdefault("acls", [])
    for entry in acls:
        if _entry_matches(entry, user_id, subnet_cidr):
            log.info("ACL entry already present for user=%s subnet=%s", user_id, subnet_cidr)
            return False
    acls.append(_make_acl_entry(user_id, subnet_cidr))
    log.info("ACL entry added for user=%s subnet=%s", user_id, subnet_cidr)
    return True


def _remove_acl_entry(policy: dict, user_id: str, subnet_cidr: str) -> bool:
    """
    Remove the ACL entry for (user_id, subnet_cidr) if present.
    Returns True if the policy was modified.
    """
    acls = policy.get("acls", [])
    new_acls = [e for e in acls if not _entry_matches(e, user_id, subnet_cidr)]
    if len(new_acls) == len(acls):
        log.info("No ACL entry found to remove for user=%s subnet=%s", user_id, subnet_cidr)
        return False
    policy["acls"] = new_acls
    log.info("ACL entry removed for user=%s subnet=%s", user_id, subnet_cidr)
    return True


# ── Public interface ──────────────────────────────────────────────────────────

async def _mutate_policy(mutate_fn, user_id: str, subnet_cidr: str, operation: str):
    """
    Fetch → mutate → PUT with retry on conflict.
    mutate_fn(policy, user_id, subnet_cidr) → bool (True = modified)
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            policy_str, updated_at = await _get_policy()
            policy = _parse_policy(policy_str)

            modified = mutate_fn(policy, user_id, subnet_cidr)
            if not modified:
                log.info(
                    "Policy unchanged for %s user=%s subnet=%s — skipping PUT",
                    operation, user_id, subnet_cidr,
                )
                return

            new_policy_str = _serialise_policy(policy)
            await _put_policy(new_policy_str)
            log.info(
                "Policy updated (%s) for user=%s subnet=%s (attempt %d)",
                operation, user_id, subnet_cidr, attempt,
            )
            return

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 409 and attempt < MAX_RETRIES:
                log.warning(
                    "Policy conflict on attempt %d for %s — retrying in %ss",
                    attempt, operation, RETRY_DELAY,
                )
                await asyncio.sleep(RETRY_DELAY)
            else:
                log.error(
                    "Failed to %s ACL entry for user=%s subnet=%s: %s",
                    operation, user_id, subnet_cidr, e,
                )
                raise

        except Exception as e:
            log.error(
                "Unexpected error during %s for user=%s subnet=%s: %s",
                operation, user_id, subnet_cidr, e,
            )
            raise


async def add_deployment_acl(user_id: str, subnet_cidr: str):
    """
    Add an ACL rule allowing user_id to reach subnet_cidr.
    Called from lab_worker.py after a successful deployment.
    """
    await _mutate_policy(_add_acl_entry, user_id, subnet_cidr, "add")


async def remove_deployment_acl(user_id: str, subnet_cidr: str):
    """
    Remove the ACL rule for user_id → subnet_cidr.
    Called from lab_cleanup_worker.py after a successful destroy.
    """
    await _mutate_policy(_remove_acl_entry, user_id, subnet_cidr, "remove")


async def add_autoApprover_for_wazuh(cidr: str = "10.30.0.0/16", tag: str = "tag:router"):
    """
    One-time helper: add 10.30.0.0/16 to autoApprovers so subnet router
    routes are approved automatically without manual `headscale routes enable`.
    Call this once from a management script, not from the worker.
    """
    policy_str, _ = await _get_policy()
    policy = _parse_policy(policy_str)

    auto = policy.setdefault("autoApprovers", {})
    routes = auto.setdefault("routes", {})

    if cidr in routes and tag in routes[cidr]:
        log.info("autoApprover for %s already present", cidr)
        return

    routes.setdefault(cidr, [])
    if tag not in routes[cidr]:
        routes[cidr].append(tag)

    await _put_policy(_serialise_policy(policy))
    log.info("autoApprover added: %s → %s", cidr, tag)