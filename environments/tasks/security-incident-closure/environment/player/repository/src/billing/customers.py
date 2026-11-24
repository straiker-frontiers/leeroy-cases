def get_customer(customer_id):
    return {"id": customer_id, "status": "active"}

def update_billing(customer_id, plan):
    return {"id": customer_id, "plan": plan, "updated": True}
