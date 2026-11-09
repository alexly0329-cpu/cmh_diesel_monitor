"""Build the public Columbus diesel order-to-invoice dataset.

Only City Auditor records are used. PO quantities are ordered quantities, not
proof of delivery; invoice journals are accounting records, not scanned bills.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sqlite3
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path


YEAR = 2026
VENDOR_ACCOUNT = "002166"
MATERIAL_VARIANCE_CENTS = 2500
CENT = Decimal("0.01")
BASE = "https://dlstpprodeastus001.blob.core.windows.net/exceldatasets-synapse/TransactionData"
CONTRACT_URL = "https://columbus.legistar.com/LegislationDetail.aspx?FullText=1&GUID=E32AE369-3AFA-4D83-8652-ADF077FCE64D&ID=7444913"
AUTHORIZATION_URL = "https://columbus.legistar.com/LegislationDetail.aspx?GUID=B7CCB628-B1C1-4036-917A-525C92C3DE0D&ID=7923564"
BID_URL = "https://www.columbus.gov/files/sharedassets/city/v/1/city-council/documents/city-bulletins/2025/bulletin20250517_1.pdf"
ERD_URL = "https://www.columbusauditor.org/Data-Hub/Data-Entity-Diagram/"


def source_url(category: str, year: int = YEAR) -> str:
    return f"{BASE}/{category}/CityOfColumbus_DataSet_{category}__{year}-01-01-{year}-12-31.csv"


def stream_csv(category: str, year: int = YEAR):
    request = urllib.request.Request(source_url(category, year), headers={"User-Agent": "ColumbusDieselMonitor/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        yield from csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig", newline=""))


def cents(value) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int((Decimal(str(value)) / CENT).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError):
        return None


def dollars(value: int | None) -> float | None:
    return None if value is None else value / 100


def quantity(value) -> int | float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        return None
    return int(number) if number == number.to_integral_value() else float(number)


def sum_known(values) -> int | None:
    values = list(values)
    return sum(values) if values and all(value is not None for value in values) else None


def line_kind(name: str, category: str = "") -> str:
    label = name.lower().strip()
    if label.startswith("fuel| diesel|") and ("tank wagon" in label or "transport" in label):
        return "diesel_fuel"
    if "tax" in label or category.lower() == "custom tax or duty":
        return "tax"
    return "other"


def _date(value: str) -> str | None:
    value = (value or "").strip()
    return value[:10] if len(value) >= 10 else None


def _mode(lines: list[dict]) -> str | None:
    names = [line["description"].lower() for line in lines if line["kind"] == "diesel_fuel"]
    modes = set()
    if any("tank wagon" in name for name in names):
        modes.add("Tank wagon")
    if any("transport" in name for name in names):
        modes.add("Transport")
    return " / ".join(sorted(modes)) if modes else None


def build_dataset(po_line_rows, invoice_rows, accounting_rows, *, year: int = YEAR,
                  as_of: str | None = None) -> dict:
    """Reconcile public PO lines, posted invoice journals, and accounting entries.

    Full PO line totals include every fuel, additive, and tax component on a
    selected order. Only main diesel lines contribute to ordered diesel gallons.
    """
    as_of = as_of or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    db = sqlite3.connect(":memory:")
    try:
        db.execute("CREATE TABLE po_line (po_id TEXT, vendor TEXT, line_number TEXT, listed_date TEXT, "
                   "description TEXT, category TEXT, amount TEXT, qty TEXT, source_line TEXT)")
        for row in po_line_rows:
            if row.get("[VendAccount]") != VENDOR_ACCOUNT:
                continue
            db.execute("INSERT INTO po_line VALUES (?,?,?,?,?,?,?,?,?)", (
                row.get("[PurchId]", ""), row.get("[VendAccount]", ""), row.get("[LineNumber]", ""),
                row.get("[DeliveryDate]", ""), row.get("[Name]", ""), row.get("[ProcurementCategory]", ""),
                row.get("[LineAmount]", ""), row.get("[PurchQty]", ""), row.get("[SourceDocumentLine]", "")))
        selected = {r[0] for r in db.execute(
            "SELECT DISTINCT po_id FROM po_line WHERE vendor = ? "
            "AND (lower(description) LIKE 'fuel| diesel| tank wagon%' "
            "OR lower(description) LIKE 'fuel| diesel| transport%')", (VENDOR_ACCOUNT,)) if r[0]}

        line_groups = defaultdict(list)
        for raw in db.execute("SELECT po_id, line_number, listed_date, description, category, amount, qty, source_line "
                              "FROM po_line ORDER BY po_id, CAST(line_number AS INTEGER)"):
            if raw[0] not in selected:
                continue
            po_id, number, listed_date, description, category, amount, qty, source_line = raw
            line_groups[po_id].append({
                "line_number": int(number) if str(number).isdigit() else number or None,
                "listed_date": _date(listed_date), "description": description or "",
                "category": category or "", "ordered_qty": quantity(qty),
                "amount": dollars(cents(amount)), "kind": line_kind(description or "", category or ""),
                "source_document_line": source_line or None,
            })

        invoices_by_po = defaultdict(dict)
        conflicting_invoice_ids = defaultdict(set)
        for row in invoice_rows:
            po_id = row.get("[PurchId]", "")
            if po_id not in selected or row.get("[OrderAccount]") != VENDOR_ACCOUNT:
                continue
            invoice_id = row.get("[InvoiceId]", "") or row.get("[LedgerVoucher]", "") or row.get("[SourceDocumentHeader]", "")
            key = (po_id, invoice_id)
            normalized = {
                "invoice_id": invoice_id or None, "invoice_date": _date(row.get("[InvoiceDate]", "")),
                "amount": dollars(cents(row.get("[InvoiceAmount]"))),
                "ledger_voucher": row.get("[LedgerVoucher]") or None,
                "source_document_header": row.get("[SourceDocumentHeader]") or None,
            }
            old = invoices_by_po[po_id].get(invoice_id)
            if old is None:
                invoices_by_po[po_id][invoice_id] = normalized
            elif old != normalized:
                conflicting_invoice_ids[po_id].add(invoice_id)

        selected_headers = {inv["source_document_header"] for group in invoices_by_po.values()
                            for inv in group.values() if inv["source_document_header"]}
        accounting_by_header = defaultdict(list)
        accounting_seen = set()
        for row in accounting_rows:
            header = row.get("[SourceDocumentHeader]")
            if header not in selected_headers:
                continue
            record_id = row.get("[AcctDist_RECID]") or (
                header, row.get("[SourceDocumentLine]"), row.get("[TransactionCurrencyAmount]"))
            if record_id in accounting_seen:
                continue
            accounting_seen.add(record_id)
            accounting_by_header[header].append({
                "source_document_header": header,
                "source_document_line": row.get("[SourceDocumentLine]") or None,
                "amount": dollars(cents(row.get("[TransactionCurrencyAmount]"))),
                "department": row.get("[DEPARTMENTNAME]") or None,
                "division": row.get("[DIVISIONNAME]") or None,
                "object_class": row.get("[OBJECTCLASSNAME]") or None,
            })

        orders = []
        source_files = [
            {"label": f"{year} purchase-order lines", "url": source_url("PurchaseOrderLines", year)},
            {"label": f"{year} invoice journals", "url": source_url("VendorInvoiceJournals", year)},
            {"label": f"{year} accounting distributions", "url": source_url("AccountingDistribution", year)},
        ]
        for po_id in sorted(selected):
            lines = line_groups[po_id]
            fuel = [line for line in lines if line["kind"] == "diesel_fuel"]
            tax = [line for line in lines if line["kind"] == "tax"]
            other = [line for line in lines if line["kind"] == "other"]
            dates = sorted({line["listed_date"] for line in fuel if line["listed_date"]})
            po_total_cents = sum_known(cents(line["amount"]) for line in lines)
            fuel_cents = sum_known(cents(line["amount"]) for line in fuel)
            tax_cents = sum_known(cents(line["amount"]) for line in tax)
            other_cents = sum_known(cents(line["amount"]) for line in other)
            gallons = [line["ordered_qty"] for line in fuel]
            ordered_gallons = sum(gallons) if gallons and all(q is not None for q in gallons) else None
            invoices = list(invoices_by_po[po_id].values())
            invoice_amounts = [cents(inv["amount"]) for inv in invoices]
            invoice_total_cents = sum_known(invoice_amounts) if not conflicting_invoice_ids[po_id] else None
            difference_cents = (invoice_total_cents - po_total_cents if invoice_total_cents is not None
                                and po_total_cents is not None else None)
            components = [component for inv in invoices for component in accounting_by_header[inv["source_document_header"]]]
            accounting_cents = sum_known(cents(component["amount"]) for component in components)
            accounting_difference_cents = (invoice_total_cents - accounting_cents if invoice_total_cents is not None
                                           and accounting_cents is not None else None)

            reasons = []
            if not invoices:
                reasons.append(f"Invoice not found in loaded {year} journal; check adjacent years and source records.")
            if conflicting_invoice_ids[po_id]:
                reasons.append("Conflicting invoice rows share an invoice ID; inspect source records.")
            if po_total_cents is None or any(line["ordered_qty"] is None for line in fuel):
                reasons.append("Source amount or fuel quantity is missing; inspect purchase-order line.")
            if invoices and invoice_total_cents is None and not conflicting_invoice_ids[po_id]:
                reasons.append("Invoice amount is missing in the published journal.")
            if difference_cents is not None and abs(difference_cents) >= MATERIAL_VARIANCE_CENTS:
                reasons.append("Material order/invoice variance; inspect authorized changes and source records.")
            if invoices and not components:
                reasons.append("Invoice accounting components not found in loaded source.")
            elif components and accounting_cents is None:
                reasons.append("Accounting component amount is missing in the published source.")
            elif accounting_difference_cents is not None and abs(accounting_difference_cents) >= 1:
                reasons.append("Posted invoice does not reconcile to accounting components.")

            if not invoices:
                difference_class = "invoice_not_in_loaded_file"
            elif difference_cents is None:
                difference_class = "unknown"
            elif abs(difference_cents) >= MATERIAL_VARIANCE_CENTS:
                difference_class = "material_variance"
            elif difference_cents == 0:
                difference_class = "exact_match"
            else:
                difference_class = "minor_adjustment"

            orders.append({
                "po_id": po_id, "listed_date": dates[0] if dates else None, "mode": _mode(lines),
                "ordered_gallons": ordered_gallons, "po_fuel_amount": dollars(fuel_cents),
                "po_tax_amount": dollars(tax_cents), "po_other_amount": dollars(other_cents),
                "po_total": dollars(po_total_cents),
                "invoice_ids": [inv["invoice_id"] for inv in invoices],
                "invoice_date": max((inv["invoice_date"] for inv in invoices if inv["invoice_date"]), default=None),
                "invoice_total": dollars(invoice_total_cents), "difference": dollars(difference_cents),
                "difference_class": difference_class, "review_reasons": reasons, "source_files": source_files,
                "po_lines": lines, "invoices": invoices, "accounting_components": components,
                "accounting_total": dollars(accounting_cents),
                "accounting_difference": dollars(accounting_difference_cents),
            })

        monthly_groups = defaultdict(list)
        for order in orders:
            monthly_groups[order["listed_date"][:7] if order["listed_date"] else "Unknown"].append(order)
        monthly = []
        for month, group in sorted(monthly_groups.items()):
            monthly.append({
                "month": month, "orders_count": len(group),
                "ordered_gallons": sum(o["ordered_gallons"] for o in group if o["ordered_gallons"] is not None),
                "po_fuel_amount": round(sum(o["po_fuel_amount"] for o in group if o["po_fuel_amount"] is not None), 2),
                "po_total": round(sum(o["po_total"] for o in group if o["po_total"] is not None), 2),
                "invoice_total": round(sum(o["invoice_total"] for o in group if o["invoice_total"] is not None), 2),
                "review_count": sum(bool(o["review_reasons"]) for o in group),
            })
        summary = {
            "orders_count": len(orders), "matched_orders": sum(bool(o["invoice_ids"]) for o in orders),
            "unmatched_orders": sum(not o["invoice_ids"] for o in orders),
            "review_count": sum(bool(o["review_reasons"]) for o in orders),
            "minor_adjustment_orders": sum(o["difference_class"] == "minor_adjustment" for o in orders),
            "material_variance_orders": sum(o["difference_class"] == "material_variance" for o in orders),
            "ordered_gallons": sum(o["ordered_gallons"] for o in orders if o["ordered_gallons"] is not None),
            "po_fuel_amount": round(sum(o["po_fuel_amount"] for o in orders if o["po_fuel_amount"] is not None), 2),
            "po_total": round(sum(o["po_total"] for o in orders if o["po_total"] is not None), 2),
            "invoice_total": round(sum(o["invoice_total"] for o in orders if o["invoice_total"] is not None), 2),
            "coverage": {
                "ordered_gallons_known_orders": sum(o["ordered_gallons"] is not None for o in orders),
                "po_fuel_amount_known_orders": sum(o["po_fuel_amount"] is not None for o in orders),
                "po_total_known_orders": sum(o["po_total"] is not None for o in orders),
                "invoice_total_known_matched_orders": sum(bool(o["invoice_ids"]) and o["invoice_total"] is not None for o in orders),
            },
        }
        return {
            "as_of": as_of, "sources": [
                {"id": "purchase_order_lines", "label": f"City Auditor {year} purchase-order lines",
                 "url": source_url("PurchaseOrderLines", year), "retrieved_at": as_of},
                {"id": "invoice_journals", "label": f"City Auditor {year} vendor invoice journals",
                 "url": source_url("VendorInvoiceJournals", year), "retrieved_at": as_of},
                {"id": "accounting_distribution", "label": f"City Auditor {year} accounting distribution",
                 "url": source_url("AccountingDistribution", year), "retrieved_at": as_of},
                {"id": "join_diagram", "label": "City Auditor dataset relationship diagram", "url": ERD_URL},
            ],
            "contract": {
                "rfq": "RFQ030275", "agreement": "PA008056",
                "awarded_vendor": "Benchmark Biodiesel, Inc.", "vendor_account": VENDOR_ACCOUNT,
                "estimated_annual_gallons": 600000, "term_end": "2027-09-30",
                "bid_url": BID_URL, "award_url": CONTRACT_URL, "authorization_url": AUTHORIZATION_URL,
                "association_note": "The public CSVs identify vendor and product, but do not carry the purchase-agreement ID for each order.",
            },
            "methodology": {
                "scope": f"{year} orders for vendor account {VENDOR_ACCOUNT} with at least one main diesel tank-wagon or transport line.",
                "ordered_gallons": "Sum of main diesel fuel PO line quantities only; excludes tax, winterizer, and biodiesel lines.",
                "po_total": "Sum of all listed PO line amounts, including other fuel, additive, and tax lines on a selected order.",
                "invoice_total": "Sum of unique posted invoice IDs for the selected PO in the loaded year's journal.",
                "difference": "Posted invoice total minus listed PO line total; a difference is not proof of a billing error.",
                "summary_totals": "Totals sum available values only. Coverage counts state how many orders have each underlying value.",
                "material_variance_threshold_usd": dollars(MATERIAL_VARIANCE_CENTS),
                "unmatched": "No matching invoice in the loaded year's public file; invoices may appear in another year.",
                "limits": "No delivery tickets, scanned invoice PDFs, or proprietary daily contract index are provided. PO dates and gallons do not prove physical delivery.",
            },
            "summary": summary, "monthly": monthly, "orders": orders,
        }
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=YEAR)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "dist" / "data.json")
    args = parser.parse_args()
    data = build_dataset(stream_csv("PurchaseOrderLines", args.year),
                         stream_csv("VendorInvoiceJournals", args.year),
                         stream_csv("AccountingDistribution", args.year), year=args.year)
    example = next((order for order in data["orders"] if order["po_id"] == "PO585255"), None)
    if args.year == 2026 and (example is None or example["ordered_gallons"] != 503
                              or example["po_fuel_amount"] != 2152.94 or example["po_tax_amount"] != 399.0
                              or example["invoice_total"] != 2551.76):
        raise SystemExit("PO585255 source check failed; inspect changed public data before publishing.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}: {data['summary']['orders_count']} orders, "
          f"{data['summary']['matched_orders']} matched invoices, "
          f"{data['summary']['review_count']} review candidates")


if __name__ == "__main__":
    main()
