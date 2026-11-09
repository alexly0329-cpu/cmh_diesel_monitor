# Methodology and evidence limits

## Scope and sources

The case covers the City of Columbus's public diesel fuel purchasing records for fiscal year 2026. The [May 17, 2025 bid notice for RFQ030275](https://www.columbus.gov/files/sharedassets/city/v/1/city-council/documents/city-bulletins/2025/bulletin20250517_1.pdf) estimated **600,000 gallons annually across ultra-low sulfur diesel, biodiesel, and non-road diesel**. It is a bid estimate, not observed purchases. [Ordinance 1557-2025](https://columbus.legistar.com/LegislationDetail.aspx?FullText=1&GUID=E32AE369-3AFA-4D83-8652-ADF077FCE64D&ID=7444913) finalized July 2, 2025, awarded the option contract after two bids. Its $1 expenditure establishes the contract and must not be treated as a per-gallon price or sales amount. [Ordinance 0324-2026](https://columbus.legistar.com/LegislationDetail.aspx?G=4F637594-17B0-4E92-8196-37F14328D337&GUID=B7CCB628-B1C1-4036-917A-525C92C3DE0D&ID=7923564), finalized February 25, 2026, identifies the later purchase contract as PA008056, vendor 002166, expiring September 30, 2027. Its $2.5 million expenditure authorization covers several fuel types and vendors, not diesel alone.

The numerical analysis draws from the [City Auditor Data Hub](https://www.columbusauditor.org/Data-Hub/) fiscal-year 2026 exports: purchase-order lines, vendor invoice journals, and accounting distribution. The download address and retrieval time for each file are recorded in generated output. On November 5, 2026, the City's dataset pages listed October 29 as the last update for [purchase-order lines](https://www.columbusauditor.org/Data-Hub/data-sets-explorer/?DataSetCategory=PurchaseOrderLines) and October 30 for [invoice journals](https://www.columbusauditor.org/Data-Hub/data-sets-explorer/?DataSetCategory=VendorInvoiceJournals). The [Auditor's entity diagram](https://www.columbusauditor.org/Data-Hub/Data-Entity-Diagram/) identifies these published relationships:

| Left record | Shared key | Right record |
| --- | --- | --- |
| Purchase order | `PurchId` | Purchase-order line |
| Purchase-order line | `SourceDocumentLine` | Accounting distribution |
| Vendor invoice | `SourceDocumentHeader` | Accounting distribution |
| Vendor invoice | `LedgerVoucher` | Vendor payment, if payments are loaded |

Fiscal year 2026 is still in progress at this snapshot. Totals and unmatched counts can change as the City updates its exports or posts later invoices.

The analysis selects fiscal-year 2026 purchase orders for vendor 002166 with at least one main diesel tank-wagon or transport line. The ordinances establish the contract context. The published order lines do not name PA008056 per order, so the analysis does not assert that a particular order was issued under that agreement. A 2025 transaction is not assigned to PA008056 merely because the same supplier later won the contract. Order lines and invoice journals match on `PurchId`; invoice journals connect to accounting distributions through `SourceDocumentHeader`.

## Calculations

**Ordered gallons** sum `PurchQty` on main diesel tank-wagon and transport lines. The export does not provide a unit field. We interpret those quantities as gallons from the fuel-line descriptions and RFQ's gallon-based scope, so this unit is an inference. Many selected purchase orders also include biodiesel. Tax, fee, additive, biodiesel, and other non-diesel lines do not enter the diesel-gallon figure. The result describes ordered quantity, not confirmed delivery.

**Purchase-order dollars** retain diesel fuel, tax, and other components separately. **Invoice dollars** sum posted invoice-journal amounts once per unique invoice and purchase-order pair; duplicate export or accounting rows must not multiply an invoice total. The invoice comparison covers **all lines on a selected purchase order**, including biodiesel and other charges. Its total is not diesel-only revenue. A blank source value remains unknown (`null`), never zero.

**Recorded difference** is posted invoice dollars less the full purchase-order line total, which includes listed tax and other components. A difference of at least $25 in either direction is a *review candidate*. A smaller difference remains visible. Either may reflect amendments, a tax adjustment, timing, partial fulfillment, or a record missing from the loaded year. No difference is called overbilling, underbilling, or recovered savings without the underlying delivery and invoice documents.

The source check for **PO585255** finds 503 main diesel `PurchQty`, a $2,152.94 diesel line, a $399.00 tax line, and a $2,551.94 full order total. Invoice journal **118456COC26** lists $2,551.76. Accounting distribution contains $2,152.94 and $398.82 components. The latter is $0.18 below the PO tax line, but its published category does not establish the cause. The recorded difference is **-$0.18**, below the $25 review threshold. The 503 is an order quantity interpreted as gallons, not a delivered quantity.

The monthly chart groups orders by the earliest main diesel line's listed `DeliveryDate`. This is the purchase-order cohort month, not proof of delivery. Matched invoice dollars in that chart are assigned to the same cohort month; the source invoice date remains visible on each record. The chart does **not** show when invoice dollars posted.

The chart's August-to-September finding subtracts the August ordered-gallon sum from the September sum. Monthly order counts are the number of distinct selected purchase orders in each date cohort. Average inferred ordered gallons per order equals that month's ordered-gallon sum divided by its order count. These figures describe how the recorded quantity changed; they do not establish why the order count rose or whether citywide demand changed.

## Review rules

- An order with no linked invoice is **unmatched in the loaded exports**, not proven uninvoiced. An invoice may post in another fiscal year.
- A dollar difference of **$25 or more in absolute value** between the complete purchase-order line total and posted invoice total is queued for review. This comparison includes tax and other listed lines.
- A missing or ambiguous source value is marked **needs evidence**. The monitor does not infer a zero charge or a delivered quantity.
- Source IDs remain visible so each flag can be checked against the public records.

## What cannot be verified

The public exports do not include bills of lading, scanned vendor invoices, confirmed delivered gallons, or daily proprietary fuel index values such as OPIS. The invoice journal's `Qty` field, where present, **is not interpreted as fuel gallons**. The monitor therefore cannot independently certify an invoice's contractual unit price, shipment volume, or billing accuracy. It identifies records for follow-up review.

No customer, shipment, or invoice records are fabricated. The work is an independent public-record analysis, without affiliation with the City, its contractors, or any target employer.
