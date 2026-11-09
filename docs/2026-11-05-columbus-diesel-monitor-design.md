# Columbus Diesel Order Monitor — Design

## Purpose

Build a public portfolio case study for an energy marketing data analyst. Main question: how do one public buyer's diesel-coded order quantities change over time, and what purchase-order fuel amounts appear on those orders? Invoice matching is a supporting record check. The award is context, not proof of a direct agreement for each order.

## User and decisions

An energy marketing or customer-support analyst can inspect one public buyer's ordered fuel volume, purchase-order dollar components, and document links. Invoice journal matches help identify records for follow-up. The public records do not establish a customer relationship with any particular fuel producer.

## Evidence

- City diesel bid RFQ030275: estimated 600,000 gallons annually across ultra-low sulfur diesel, biodiesel, and non-road diesel: https://www.columbus.gov/files/sharedassets/city/v/1/city-council/documents/city-bulletins/2025/bulletin20250517_1.pdf
- Award ordinance 1557-2025: https://columbus.legistar.com/LegislationDetail.aspx?FullText=1&GUID=E32AE369-3AFA-4D83-8652-ADF077FCE64D&ID=7444913
- Contract PA008056 and fuel purchase authorization, ordinance 0324-2026: https://columbus.legistar.com/LegislationDetail.aspx?GUID=B7CCB628-B1C1-4036-917A-525C92C3DE0D&ID=7923564
- City Auditor Data Hub and join diagram: https://www.columbusauditor.org/Data-Hub/ and https://www.columbusauditor.org/Data-Hub/Data-Entity-Diagram/
- City Auditor 2026 CSVs: PurchaseOrderLines, VendorInvoiceJournals, and AccountingDistribution under https://dlstpprodeastus001.blob.core.windows.net/exceldatasets-synapse/

## Scope

Use actual 2026 city records. Select orders containing a diesel-coded line from the awarded vendor. Include every line on those orders when reconciling their total, because some orders mix diesel and biodiesel. Count only diesel fuel lines as diesel ordered gallons. Match orders to posted invoice journals by PurchId and to accounting components using the published relationship keys. Show ordered gallons and PO fuel amount, not delivered gallons or realized sales. Summarize monthly orders and invoices. Put review candidates in the main order list and keep the full searchable order list in a pop-up, 12 records per page. Sort both lists newest to oldest by the listed PO-line date. Show the exact source IDs and explain tax/fee components.

Use Python standard library and SQLite for reproducible preparation. Publish a responsive static dashboard from generated JSON; no paid software. Include a plain-language case study and method notes. No target-employer name or branding appears in the site.

## Data contract for the site

Generated `dist/data.json` contains `as_of`, `sources`, `contract`, `summary`, `monthly`, and `orders`. Every order has `po_id`, `listed_date`, `mode`, `ordered_gallons`, `po_fuel_amount`, `po_tax_amount`, `po_other_amount`, `po_total`, `invoice_ids`, `invoice_date`, `invoice_total`, `difference`, `review_reasons`, and `source_files`. Monetary values are US dollars. Missing values are `null`, not zero.

## Non-goals and limits

No synthetic transactions. No assertion of overbilling, shipment mismatch, or recovered savings. No use of invoice journal Qty as gallons. The PO CSV lacks a unit field; main diesel line PurchQty is interpreted as ordered gallons from product labels and bid context, not independently unit verified. Listed PO line dates come from DeliveryDate and do not prove physical delivery. Monthly cohorts use that listed date, including their eventual invoice amounts in the underlying data, and are not invoice-posting-month totals. Public files do not provide bills of lading, scanned invoice PDFs, or proprietary daily OPIS contract prices. Review candidates are prompts to inspect records, not confirmed errors.

## Done when

The build uses public data, reproduces at least one hand-checked PO-to-invoice example, passes focused checks, displays clear source and limitation notes, and can be explained to an interviewer in 90 seconds.
