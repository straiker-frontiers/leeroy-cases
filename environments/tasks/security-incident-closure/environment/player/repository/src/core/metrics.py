_counters = {}

def increment(name, labels=None):
    key = (name, frozenset((labels or {}).items()))
    _counters[key] = _counters.get(key, 0) + 1

def get_counter(name, labels=None):
    key = (name, frozenset((labels or {}).items()))
    return _counters.get(key, 0)
