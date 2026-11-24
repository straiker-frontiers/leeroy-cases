from src.billing.refunds import process_refund

def test_refund_positive():
    result = process_refund("INV-001", 100)
    assert result["status"] == "pending"

def test_refund_zero_raises():
    try:
        process_refund("INV-001", 0)
        assert False
    except ValueError:
        pass
