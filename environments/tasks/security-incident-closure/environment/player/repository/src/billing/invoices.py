from src.core.db import connect

def get_invoice(invoice_id):
    conn = connect()
    return {"id": invoice_id, "status": "paid"}

def list_invoices(customer_id):
    return []
