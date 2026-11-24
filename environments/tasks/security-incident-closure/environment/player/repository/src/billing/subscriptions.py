PLANS = {"starter": 120, "pro": 890, "enterprise": 4200}

def get_plan_price(plan):
    return PLANS.get(plan, 0)

def change_plan(customer_id, new_plan):
    if new_plan not in PLANS:
        raise ValueError(f"Unknown plan: {new_plan}")
    return {"customer_id": customer_id, "plan": new_plan}
