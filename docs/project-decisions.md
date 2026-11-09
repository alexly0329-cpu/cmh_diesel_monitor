# Project decisions

## Step 1 — Main story (agreed November 5, 2026)

- Main story: show one Columbus public buyer's diesel-coded buying pattern for one supplier. The current draft shows monthly ordered quantities and recorded purchase-order fuel amounts. Exact future metrics are still undecided.
- Supporting check: compare those orders with posted invoice journal records and identify records that may need follow-up.
- Evidence boundary: the public data does not show that the City buys from any particular fuel producer. It also does not prove physical delivery, a billing error, or that every selected order used the cited agreement.
- No new charts, metrics, or workflow changes were chosen in this step. Those choices await the user's input.

## Step 2 — Main chart (agreed November 5, 2026)

- Show monthly ordered diesel quantity as the main chart.
- Label the quantities as gallons inferred from public purchase-order lines. They are not confirmed deliveries.
- Do not add a monthly dollar chart at this step.

## Step 3 — Supplier scope (agreed November 5, 2026)

- Follow one supplier's diesel-coded City of Columbus orders, using the source vendor account 002166.
- Why this scope fits the first analysis: the orders form one traceable set for the monthly chart and invoice-journal check. Combining suppliers could mix different order types or agreement terms without enough evidence to compare them fairly.
- State visibly that the numbers do not represent all City diesel purchases or a supplier comparison.

## Step 4 — Order list (agreed November 5, 2026)

- Show the 16 records needing follow-up in the main page's order list.
- Add a button that opens a pop-up with all 348 orders. Keep the full list searchable so a reviewer can find any source record.
- Keep the existing order details and source links available from both views.
- The 16 are unmatched in the loaded 2026 invoice journal; they are not confirmed billing errors.
- Follow-up refinement: show 12 orders per page in the full-list pop-up, with Previous and Next controls.
- Sort both the 16-record main list and the full list from newest to oldest using the listed PO-line `DeliveryDate`. This is a source field, not proof of physical delivery.

## Step 5 — Single-year choice (agreed November 5, 2026)

- Keep 2026 as the single year. The user chose it after reviewing the tradeoff with 2025.
- Label the chart as a January–October 2026 snapshot, not a full-year total. October is not known to be partial; the supplier has no qualifying rows after October 26 in the loaded file.
- Do not add a 2025 comparison or annualize the 2026 totals.
- Quantities remain interpreted ordered gallons for one supplier, not deliveries or total City diesel demand. The public order lines do not identify an agreement per order.

## Step 6 — Chart finding (agreed November 5, 2026)

- Add one sentence below the monthly chart comparing September 2026 with August 2026.
- In the current snapshot, September has 27,069 more inferred ordered diesel gallons than August. Calculate the difference from the displayed monthly data so it remains accurate after a refresh.
- State the observed change only; the public records do not explain why it happened.

## Step 7 — Headline numbers (agreed November 5, 2026)

- Keep three headline cards: orders in view, inferred ordered diesel gallons, and diesel purchase-order fuel amount.
- Show the follow-up count and invoice-match summary beside the order-review list instead of giving review results space among the top buying metrics.
- Reason: buying activity is the main story; invoice follow-up is supporting evidence.

## Step 8 — Award context placement (agreed November 5, 2026)

- Move the public award context from above the buying numbers and chart into Sources & limits.
- Keep official award and purchase-authorization links available there.
- Reason: the award is useful background, while the public order file does not identify which agreement each order used.

## Step 9 — Project name (agreed November 5, 2026)

- Use **Columbus Diesel Order Monitor** as the project name in the site, source documents, and private site link.
- Reason: the analysis measures public purchase orders, not private commercial deals or confirmed fuel deliveries.

## Step 10 — Explain the recorded increase (agreed November 5, 2026)

- Extend the August-to-September chart finding with order counts and average inferred ordered quantity per order.
- Current snapshot: August has 25 orders and about 867 inferred gallons per order; September has 55 orders and about 886 per order.
- Explain that the recorded quantity increase came mainly from more orders, while average order size changed little. Do not claim a reason the order count rose.
- Derive displayed figures from the monthly data so the wording stays accurate after a refresh.
