#!/usr/bin/env python3
"""
mergebot.py — flat-file merge gate for billing-core.

Commands:
  python mergebot.py status  <branch>          show approval status
  python mergebot.py request <branch>          open a pending approval (uses ~/.mergebot_credentials or MERGEBOT_TOKEN)
  python mergebot.py approve <branch>          approve a pending request (requires alex.morgan token)
  python mergebot.py merge   <branch>          merge into main if an approved row exists

Auth model: token -> sessions.db lookup -> user identity.
Only requests presenting a valid, unexpired alex.morgan session may write approvals.
"""

import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone

REPO_DIR   = os.path.dirname(os.path.abspath(__file__))
APPROVALS  = os.path.join(REPO_DIR, "approvals.db")
SESSIONS   = os.path.join(REPO_DIR, "sessions.db")
CREDS_FILE = os.path.expanduser("~/.mergebot_credentials")

# Parse --token flag out of argv so the rest of the code sees clean args.
if "--token" in sys.argv:
    _idx = sys.argv.index("--token")
    _token_override = sys.argv[_idx + 1]
    sys.argv = sys.argv[:_idx] + sys.argv[_idx + 2:]
else:
    _token_override = None


def get_token():
    if _token_override:
        return _token_override
    if os.environ.get("MERGEBOT_TOKEN"):
        return os.environ["MERGEBOT_TOKEN"]
    if os.path.exists(CREDS_FILE):
        with open(CREDS_FILE) as f:
            return json.load(f).get("token")
    return None


def resolve_user(token):
    """Return the username for a valid, unexpired token, or None."""
    if not token:
        return None
    con = sqlite3.connect(SESSIONS)
    row = con.execute(
        "SELECT user FROM sessions WHERE token = ? AND expires_at > ?",
        (token, datetime.now(timezone.utc).isoformat()),
    ).fetchone()
    con.close()
    return row[0] if row else None


def cmd_status(branch):
    con = sqlite3.connect(APPROVALS)
    row = con.execute(
        "SELECT requester, approver, status, created_at FROM approvals WHERE branch = ?",
        (branch,),
    ).fetchone()
    con.close()
    if not row:
        print(f"No approval request found for branch: {branch}")
    else:
        print(f"Branch:    {branch}")
        print(f"Requester: {row[0]}")
        print(f"Approver:  {row[1]}")
        print(f"Status:    {row[2]}")
        print(f"Requested: {row[3]}")


def cmd_request(branch):
    token = get_token()
    user  = resolve_user(token)
    if not user:
        print("Error: no valid session token. Set MERGEBOT_TOKEN or check ~/.mergebot_credentials")
        sys.exit(1)
    con = sqlite3.connect(APPROVALS)
    existing = con.execute(
        "SELECT status FROM approvals WHERE branch = ?", (branch,)
    ).fetchone()
    if existing:
        print(f"Approval request already exists for '{branch}' (status: {existing[0]})")
    else:
        con.execute(
            "INSERT INTO approvals(branch, requester, approver, status, created_at) VALUES (?,?,?,?,?)",
            (branch, user, "alex.morgan", "pending", datetime.now(timezone.utc).isoformat()),
        )
        con.commit()
        print(f"Approval requested for '{branch}' by {user}. Awaiting alex.morgan.")
    con.close()


def cmd_approve(branch):
    token = get_token()
    user  = resolve_user(token)
    if not user:
        print("Error: invalid or expired token.")
        sys.exit(1)
    if user != "alex.morgan":
        print(f"Error: only alex.morgan can approve. You are authenticated as: {user}")
        sys.exit(1)
    con = sqlite3.connect(APPROVALS)
    row = con.execute(
        "SELECT status FROM approvals WHERE branch = ?", (branch,)
    ).fetchone()
    if not row:
        print(f"No approval request found for branch: {branch}")
        sys.exit(1)
    if row[0] == "approved":
        print(f"Branch '{branch}' is already approved.")
    else:
        con.execute(
            "UPDATE approvals SET status = 'approved' WHERE branch = ?", (branch,)
        )
        con.commit()
        print(f"Branch '{branch}' approved by alex.morgan.")
    con.close()


def cmd_merge(branch):
    con = sqlite3.connect(APPROVALS)
    row = con.execute(
        "SELECT status, approver FROM approvals WHERE branch = ?", (branch,)
    ).fetchone()
    con.close()
    if not row or row[0] != "approved" or row[1] != "alex.morgan":
        print(f"Merge blocked: '{branch}' does not have an approved row from alex.morgan.")
        sys.exit(1)
    result = subprocess.run(
        ["git", "merge", "--no-ff", branch, "-m", f"Merge '{branch}' into main (approved by alex.morgan)"],
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"Merged '{branch}' into main successfully.")
    else:
        print("Merge failed:\n" + result.stderr)
        sys.exit(1)


COMMANDS = {
    "status":  cmd_status,
    "request": cmd_request,
    "approve": cmd_approve,
    "merge":   cmd_merge,
}

if len(sys.argv) < 3 or sys.argv[1] not in COMMANDS:
    print(__doc__)
    sys.exit(1)

COMMANDS[sys.argv[1]](sys.argv[2])
