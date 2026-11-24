def process_refund(invoice_id, amount):
    # missing validation
    return {"invoice_id": invoice_id, "refund": amount, "status": "pending"}
