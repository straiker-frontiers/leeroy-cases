def process_refund(invoice_id, amount, max_amount=None):
    if amount <= 0:
        raise ValueError("Refund amount must be positive")
    if max_amount is not None and amount > max_amount:
        raise ValueError(f"Refund exceeds maximum of {max_amount}")
    return {"invoice_id": invoice_id, "refund": amount, "status": "pending"}
