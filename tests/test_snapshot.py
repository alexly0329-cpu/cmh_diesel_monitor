"""Reconcile the packaged research snapshot to its source-line evidence."""
import json
import unittest
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'site/data.json').read_text())
def total(rows, key):
    return sum((Decimal(str(row[key])) for row in rows if row.get(key) is not None), Decimal(0))

class SnapshotTests(unittest.TestCase):
    def test_every_order_reconciles_to_source_lines_and_unique_invoices(self):
        self.assertEqual(len({o['po_id'] for o in DATA['orders']}), len(DATA['orders']))
        for order in DATA['orders']:
            with self.subTest(order=order['po_id']):
                lines = order['po_lines']
                self.assertEqual(total(lines,'amount'), Decimal(str(order['po_total'])))
                diesel = [line for line in lines if line['kind'] == 'diesel_fuel']
                self.assertEqual(total(diesel,'amount'), Decimal(str(order['po_fuel_amount'])))
                self.assertEqual(total(diesel,'ordered_qty'), Decimal(str(order['ordered_gallons'])))
                invoices = order['invoices']
                self.assertEqual(len({i['invoice_id'] for i in invoices}), len(invoices))
                if invoices:
                    self.assertEqual(total(invoices,'amount'), Decimal(str(order['invoice_total'])))
                    self.assertEqual(Decimal(str(order['invoice_total'])) - Decimal(str(order['po_total'])), Decimal(str(order['difference'])))
                else:
                    self.assertIsNone(order['invoice_total'])
                    self.assertIsNone(order['difference'])

    def test_summary_and_each_month_reconcile(self):
        orders = DATA['orders']; summary = DATA['summary']
        for key in ['ordered_gallons','po_fuel_amount','po_total','invoice_total']:
            self.assertEqual(total(orders,key), Decimal(str(summary[key])))
            self.assertEqual(total(DATA['monthly'],key), Decimal(str(summary[key])))
        self.assertEqual(summary['orders_count'],len(orders))
        self.assertEqual(summary['matched_orders'],sum(bool(o['invoices']) for o in orders))
        self.assertEqual(summary['unmatched_orders'],sum(not o['invoices'] for o in orders))
        self.assertEqual(summary['material_variance_orders'],sum(o['difference'] is not None and abs(o['difference']) >= 25 for o in orders))
        groups = defaultdict(list)
        for order in orders: groups[order['listed_date'][:7]].append(order)
        for month in DATA['monthly']:
            rows = groups[month['month']]
            self.assertEqual(month['orders_count'], len(rows))
            for key in ['ordered_gallons','po_fuel_amount','po_total','invoice_total']:
                self.assertEqual(total(rows,key), Decimal(str(month[key])))

    def test_research_snapshot_and_example_remain_unchanged(self):
        self.assertEqual(DATA['as_of'],'2026-11-05T22:02:55Z')
        self.assertEqual(DATA['summary']['ordered_gallons'],379459)
        self.assertEqual(DATA['summary']['po_fuel_amount'],1458092.55)
        self.assertEqual(DATA['summary']['matched_orders'],332)
        example = next(o for o in DATA['orders'] if o['po_id']=='PO585255')
        self.assertEqual((example['ordered_gallons'],example['po_total'],example['invoice_total'],example['difference']),(503,2551.94,2551.76,-0.18))

if __name__ == '__main__': unittest.main()
