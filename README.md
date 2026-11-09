# Columbus Diesel Order Monitor

An independent case study of one public buyer's fuel purchasing. The main story is the City of Columbus's 2026 diesel-coded buying pattern for one supplier: monthly ordered quantities and recorded fuel-line amounts. Invoice matching is a supporting record check. The public award gives context, but the order export does not prove each order used that agreement.

The dashboard keeps the award documents in **Sources & limits**, after the buying view, so the contract background does not imply a verified agreement for every order.

## The business question

How do one public buyer's diesel order quantities change over time, and what fuel-line amounts appear on those orders? The supporting question is which orders have a matching posted invoice journal entry. The dashboard keeps source IDs beside each result so a reviewer can trace the calculation. The records do not establish a customer relationship with any specific fuel producer.

## Why one supplier

The first version follows one vendor account, **002166**, so the selected orders form a clear group that can be traced into the City's invoice journal. This is easier to check and explain than combining suppliers whose order types or agreement terms may differ. It is a view of this supplier's diesel-coded orders to the City, **not a total of all Columbus diesel purchasing** or a comparison of competing suppliers.

## What the records support

- In its **May 17, 2025** bulletin, the City of Columbus sought about **600,000 gallons per year across ultra-low sulfur diesel, biodiesel, and non-road diesel** in bid RFQ030275. This was an estimate for the combined products, not diesel-only purchases or delivered volume. [City bid notice](https://www.columbus.gov/files/sharedassets/city/v/1/city-council/documents/city-bulletins/2025/bulletin20250517_1.pdf)
- On **July 2, 2025**, the City finalized the fuel option contract award to Benchmark Biodiesel, Inc. after two bids. The award ordinance's **$1 authorization is a contract-establishment placeholder**, not the fuel price or actual spend. [Award ordinance 1557-2025](https://columbus.legistar.com/LegislationDetail.aspx?FullText=1&GUID=E32AE369-3AFA-4D83-8652-ADF077FCE64D&ID=7444913)
- The fuel purchase authorization finalized **February 25, 2026** identifies contract **PA008056**, vendor **002166**, and a September 30, 2027 expiry. Its funding covers multiple fuel types and vendors; it is not a diesel-only sales figure. [Ordinance 0324-2026](https://columbus.legistar.com/LegislationDetail.aspx?G=4F637594-17B0-4E92-8196-37F14328D337&GUID=B7CCB628-B1C1-4036-917A-525C92C3DE0D&ID=7923564)
- The [City Auditor Data Hub](https://www.columbusauditor.org/Data-Hub/) publishes purchase-order-line, invoice-journal, and accounting-distribution datasets. Its [relationship diagram](https://www.columbusauditor.org/Data-Hub/Data-Entity-Diagram/) documents the keys used to connect them.

The analysis uses **2026 public records**. It does not attach 2025 transactions to the later PA008056 award. A selected purchase order may contain diesel, biodiesel, taxes, and other lines. Diesel ordered gallons use diesel fuel lines only; the whole-PO invoice comparison is **not diesel-only revenue**. The published order lines do not identify PA008056 per order, so the award supplies context, not proof that a particular order used that agreement. Each dashboard figure is derived from source records; see [methodology](docs/methodology.md) for definitions and limits.

The **November 5, 2026 snapshot**, covering listed PO-line dates from January through October, contains **348** qualifying supplier purchase orders. **332** have invoice-journal matches; **16** have no match in the loaded 2026 file. No matched order crosses the $25 full-order difference threshold. The year is still in progress, so these are snapshot counts, not full-year totals.

The page puts those **16 follow-up records** in view, newest listed PO-line date first. A button opens a searchable pop-up with all **348** orders, 12 per page with Previous and Next controls. The same listed date sorts the full list; it is not proof of physical delivery.

## One real record

City record **PO585255** has a main diesel line with quantity **503** (interpreted as ordered gallons), a **$2,152.94** fuel amount, and a **$399.00** tax line. Its full purchase-order total is **$2,551.94**. Invoice journal **118456COC26** records **$2,551.76**; accounting distribution includes a **$398.82** component. That component is **$0.18** below the PO tax line, but the public accounting row does not identify it as tax or explain the difference. We do not treat it as a billing-error finding. These figures come from the [City's fiscal-year 2026 data exports](https://www.columbusauditor.org/Data-Hub/), with source IDs in the dashboard.

## What a flag means

A flag means the available public records differ or a match is missing **within the loaded files**. It does not establish an incorrect bill. The dollar review threshold is **$25** on the full purchase-order total. The gallons measure is a purchase-order quantity interpreted as gallons from the fuel-line descriptions and bid context; the export has no unit field. It does not confirm delivery. The public files do not include bills of lading, scanned fuel invoices, or the daily contract index needed to verify the final per-gallon charge.

## Project structure

- `src/build_data.py` prepares and checks the public records.
- `dist/data.json` stores the compact result with source references and retrieval dates.
- `dist/index.html` is the static dashboard; no Power BI or paid service is needed.
- `docs/methodology.md` explains the record joins, calculations, and evidence limits.

## Reproduce the snapshot

From the project folder, run `python3 src/build_data.py` to download the current public CSVs and rebuild `dist/data.json`. Then run `python3 -m http.server 8000 --directory dist` and open `http://localhost:8000` to view the dashboard. The script requires Python 3 and network access; it needs no API key or paid software. Run `python3 -m unittest discover -s tests -v` for the focused data checks.

This is an independent portfolio project. It does not represent work for, or access to the internal records of, any fuel supplier or public agency.
