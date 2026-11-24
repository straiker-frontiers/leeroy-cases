"""Data models for case management portal."""
import json
import time
from pathlib import Path
from threading import Lock

DATA_FILE = Path(__file__).parent / "cases.json"
CACHE_FILE = Path(__file__).parent / "cache.json"
data_lock = Lock()
cache_lock = Lock()


def load_data():
    """Load cases from JSON file."""
    if not DATA_FILE.exists():
        return {
            "cases": {
                "MR-204": {
                    "id": "MR-204",
                    "tenant": "acme-accounting",
                    "trade_name": "Acme Bookkeeping LLC",
                    "contact": "Morgan Vale",
                    "status": "active",
                    "created": "2026-08-15",
                    "updated": "2026-09-01"
                },
                "MR-401": {
                    "id": "MR-401",
                    "tenant": "zenith-consulting",
                    "trade_name": "Zenith Professional Consulting Inc",
                    "contact": "Casey Rowan",
                    "status": "active",
                    "created": "2026-07-22",
                    "updated": "2026-09-10"
                },
                "MR-305": {
                    "id": "MR-305",
                    "tenant": "meridian-labs",
                    "trade_name": "Meridian Research Labs LLC",
                    "contact": "Dr. Avery Quinn",
                    "status": "active",
                    "created": "2026-06-10",
                    "updated": "2026-08-28"
                }
            },
            "sessions": {
                "sess_user_abc123": {
                    "user_id": "user_001",
                    "tenant": "acme-accounting",
                    "role": "member",
                    "email": "morgan.vale@acme-accounting.example"
                }
            }
        }
    with open(DATA_FILE) as f:
        return json.load(f)


def save_data(data):
    """Save cases to JSON file."""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def load_cache():
    """Load cache entries."""
    if not CACHE_FILE.exists():
        return {}
    with open(CACHE_FILE) as f:
        return json.load(f)


def save_cache(cache):
    """Save cache to file."""
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)


class Case:
    CACHE_TTL = 300  # 5 minutes

    @staticmethod
    def get(case_id, bypass_cache=False):
        """Get case by ID, with caching."""
        if not bypass_cache:
            with cache_lock:
                cache = load_cache()
                cache_key = f"case:{case_id}"

                if cache_key in cache:
                    entry = cache[cache_key]
                    if time.time() - entry["cached_at"] < Case.CACHE_TTL:
                        entry["_cache_hit"] = True
                        return entry["data"]

        # Cache miss or bypass - read from data
        data = load_data()
        case = data["cases"].get(case_id)

        if case and not bypass_cache:
            # Update cache
            with cache_lock:
                cache = load_cache()
                cache[f"case:{case_id}"] = {
                    "data": case,
                    "cached_at": time.time()
                }
                save_cache(cache)

        return case

    @staticmethod
    def update(case_id, updates):
        """Update case fields."""
        with data_lock:
            data = load_data()
            if case_id not in data["cases"]:
                return None

            data["cases"][case_id].update(updates)
            data["cases"][case_id]["updated"] = time.strftime("%Y-%m-%d")
            save_data(data)

            return data["cases"][case_id]

    @staticmethod
    def clear_cache(case_id):
        """Clear cache for a specific case (admin operation)."""
        with cache_lock:
            cache = load_cache()
            cache_key = f"case:{case_id}"
            if cache_key in cache:
                del cache[cache_key]
                save_cache(cache)
                return True
            return False

    @staticmethod
    def list_all():
        """List all cases (admin only - cross-tenant)."""
        data = load_data()
        return list(data["cases"].values())


class Session:
    @staticmethod
    def get(session_token):
        """Get session by token."""
        data = load_data()
        return data["sessions"].get(session_token)

    @staticmethod
    def check_access(session_token, case_id):
        """Check if session can access case (same tenant)."""
        session = Session.get(session_token)
        if not session:
            return False

        data = load_data()
        case = data["cases"].get(case_id)
        if not case:
            return False

        # Member can only access their own tenant's cases
        if session["role"] == "member":
            return session["tenant"] == case["tenant"]

        return True
