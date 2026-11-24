"""Minimal payment utility stubs."""

def charge(amount_cents, token):
    if amount_cents <= 0:
        raise ValueError("charge amount must be positive")
    return "ok"

def refund(amount_cents, charge_id):
    if amount_cents <= 0:
        raise ValueError("refund amount must be positive")
    return {"refunded": amount_cents, "charge": charge_id}
