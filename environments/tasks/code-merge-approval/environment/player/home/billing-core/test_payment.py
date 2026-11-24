"""Payment processing tests for billing-core."""
import unittest
from payment_utils import charge, refund

class TestCharge(unittest.TestCase):
    def test_charge_succeeds(self):
        self.assertEqual(charge(100, "tok_visa"), "ok")

    def test_charge_rejects_zero(self):
        self.assertRaises(ValueError, charge, 0, "tok_visa")

class TestRefund(unittest.TestCase):
    def test_refund_positive_amount(self):
        result = refund(50, "ch_001")
        self.assertEqual(result["refunded"], 50)

    def test_refund_rejects_negative(self):
        self.assertRaises(ValueError, refund, -50, "ch_001")

if __name__ == "__main__":
    unittest.main()
