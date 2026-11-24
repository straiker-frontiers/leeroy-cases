import time

_buckets = {}

def check_rate(key, limit=100, window=60):
    now = time.time()
    bucket = [t for t in _buckets.get(key, []) if now - t < window]
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    _buckets[key] = bucket
    return True
