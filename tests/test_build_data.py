import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from build_data import build_dataset


def po_line(po_id, number, name, amount, qty, date="2026-09-03"):
    return {
        "[PurchId]": po_id,
        "[VendAccount]": "002166",
        "[LineNumber]": str(number),
        "[Name]": name,
        "[ProcurementCategory]": "Diesel fuel",
        "[LineAmount]": amount,
        "[PurchQty]": qty,
        "[DeliveryDate]": date,
        "[SourceDocumentLine]": f"line-{number}",
    }


def invoice(po_id, invoice_id, amount, header="invoice-header", date="2026-09-09"):
    return {
        "[PurchId]": po_id,
        "[OrderAccount]": "002166",
        "[InvoiceId]": invoice_id,
        "[InvoiceAmount]": amount,
        "[InvoiceDate]": date,
        "[LedgerVoucher]": "voucher-1",
        "[SourceDocumentHeader]": header,
    }


def distribution(header, line, amount):
    return {
        "[AcctDist_RECID]": line,
        "[SourceDocumentHeader]": header,
        "[SourceDocumentLine]": line,
        "[TransactionCurrencyAmount]": amount,
        "[DEPARTMENTNAME]": "FINANCE",
        "[DIVISIONNAME]": "Fleet Management",
        "[OBJECTCLASSNAME]": "Material and Supplies",
    }


class BuildDataTests(unittest.TestCase):
    def test_mixed_order_counts_only_main_diesel_gallons_and_deduplicates_invoice(self):
        lines = [
            po_line("PO1", 10, "Fuel| Diesel| Tank Wagon FUEL-DIESEL-TANK", "2152.94", "503"),
            po_line("PO1", 20, "Fuel| Biodiesel| Tank Wagon FUEL-BIO-TANK", "100.00", "25"),
            po_line("PO1", 30, "Fuel| Diesel| Winterizer FUEL-DIESEL-WINTER", "10.00", "503"),
            po_line("PO1", 40, "Fuel| Diesel| Taxes FUEL-DIESEL-TAX", "399.00", "399"),
        ]
        rows = [invoice("PO1", "INV1", "2661.76")] * 2
        accounting = [distribution("invoice-header", "a", "2262.94"),
                      distribution("invoice-header", "b", "398.82")]

        result = build_dataset(lines, rows, accounting, year=2026, as_of="2026-11-05T00:00:00Z")
        order = result["orders"][0]
        self.assertEqual(order["ordered_gallons"], 503)
        self.assertEqual(order["po_fuel_amount"], 2152.94)
        self.assertEqual(order["po_tax_amount"], 399.0)
        self.assertEqual(order["po_other_amount"], 110.0)
        self.assertEqual(order["po_total"], 2661.94)
        self.assertEqual(order["invoice_total"], 2661.76)
        self.assertEqual(order["difference"], -0.18)
        self.assertEqual(order["review_reasons"], [])
        self.assertEqual(result["summary"]["matched_orders"], 1)

    def test_missing_source_values_are_null_not_zero(self):
        lines = [po_line("PO2", 10, "Fuel| Diesel| Transport FUEL-DIESEL-TRANS", "", "", "2026-12-30")]
        result = build_dataset(lines, [], [], year=2026, as_of="2026-12-31T00:00:00Z")
        order = result["orders"][0]
        self.assertIsNone(order["ordered_gallons"])
        self.assertIsNone(order["po_fuel_amount"])
        self.assertIsNone(order["po_total"])
        self.assertIsNone(order["invoice_total"])
        self.assertIsNone(order["difference"])
        self.assertTrue(any("source amount" in x.lower() for x in order["review_reasons"]))

    def test_unmatched_december_order_does_not_claim_missing_invoice(self):
        lines = [po_line("PO3", 10, "Fuel| Diesel| Tank Wagon FUEL-DIESEL-TANK", "1000.00", "400", "2026-12-30")]
        result = build_dataset(lines, [], [], year=2026, as_of="2027-01-03T00:00:00Z")
        reasons = result["orders"][0]["review_reasons"]
        self.assertTrue(any("not found in loaded 2026" in x.lower() for x in reasons))
        self.assertFalse(any("unbilled" in x.lower() for x in reasons))

    def test_material_variance_is_review_candidate_not_confirmed_error(self):
        lines = [po_line("PO4", 10, "Fuel| Diesel| Tank Wagon FUEL-DIESEL-TANK", "1000.00", "400")]
        result = build_dataset(lines, [invoice("PO4", "INV4", "900.00")],
                               [distribution("invoice-header", "a", "900.00")], year=2026)
        reasons = result["orders"][0]["review_reasons"]
        self.assertEqual(result["orders"][0]["difference"], -100.0)
        self.assertTrue(any("variance" in x.lower() for x in reasons))
        self.assertFalse(any("overbilling" in x.lower() for x in reasons))

    def test_conflicting_duplicate_invoice_amount_is_not_summed(self):
        lines = [po_line("PO5", 10, "Fuel| Diesel| Tank Wagon FUEL-DIESEL-TANK", "1000.00", "400")]
        result = build_dataset(lines, [invoice("PO5", "INV5", "1000.00"),
                                       invoice("PO5", "INV5", "1100.00")], [], year=2026)
        order = result["orders"][0]
        self.assertIsNone(order["invoice_total"])
        self.assertTrue(any("conflicting invoice" in x.lower() for x in order["review_reasons"]))

    def test_other_vendor_invoice_cannot_join_same_po_id(self):
        lines = [po_line("PO6", 10, "Fuel| Diesel| Tank Wagon FUEL-DIESEL-TANK", "1000.00", "400")]
        wrong_vendor_invoice = invoice("PO6", "INV6", "1000.00")
        wrong_vendor_invoice["[OrderAccount]"] = "OTHER"
        result = build_dataset(lines, [wrong_vendor_invoice], [], year=2026)
        self.assertIsNone(result["orders"][0]["invoice_total"])
        self.assertEqual(result["summary"]["unmatched_orders"], 1)


if __name__ == "__main__":
    unittest.main()
