const PAGE_SIZE = 12;
const state = { data: null, orders: [], allPage: 1 };

const byId = (id) => document.getElementById(id);
const number = (value) => value === null || value === undefined || value === "" ? null : Number(value);
const hasValue = (value) => number(value) !== null && Number.isFinite(number(value));
const amount = (value, compact = false) => {
  if (!hasValue(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", notation: compact ? "compact" : "standard",
    maximumFractionDigits: 2, minimumFractionDigits: compact ? 0 : 2
  }).format(number(value));
};
const count = (value, compact = false) => {
  if (!hasValue(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0
  }).format(number(value));
};
const dateLabel = (value, options = { month: "short", day: "numeric", year: "numeric" }) => {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return String(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1), 12);
  return new Intl.DateTimeFormat("en-US", options).format(date);
};
const textNode = (tag, className, value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value === null || value === undefined ? "—" : String(value);
  return node;
};
const orderCell = (label, className, value) => {
  const cell = textNode("td", className, value);
  cell.dataset.label = label;
  return cell;
};
const safeUrl = (value) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
};
const asArray = (value) => Array.isArray(value) ? value : [];
const reasonsFor = (order) => asArray(order.review_reasons).filter(Boolean).map(String);
const needsReview = (order) => reasonsFor(order).length > 0 || order.invoice_total === null;

function sourceItems(value) {
  const entries = Array.isArray(value) ? value : value && typeof value === "object" ? Object.entries(value).map(([label, url]) => ({ label, url })) : [];
  return entries.map((item, index) => {
    if (typeof item === "string") return { label: `Source file ${index + 1}`, url: safeUrl(item) };
    if (!item || typeof item !== "object") return null;
    const label = item.label || item.title || item.name || item.file || `Source file ${index + 1}`;
    return { label: String(label), url: safeUrl(item.url || item.href || item.source_url || item.link) };
  }).filter(Boolean);
}

function renderHeader(data) {
  const years = [...new Set(asArray(data.orders).map((order) => String(order.listed_date || "").slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))];
  byId("hero-year").textContent = years.length === 1 ? years[0] : years.length > 1 ? `${years[0]}–${years.at(-1)}` : "—";
  byId("hero-as-of").textContent = dateLabel(data.as_of);

  const contract = data.contract || {};
  byId("contract-name").textContent = contract.name || contract.title || "City of Columbus diesel and biodiesel purchasing";
  byId("contract-description").textContent = contract.awarded_vendor
    ? `The 2025 award names ${contract.awarded_vendor} for diesel, biodiesel, and non-road diesel. The 2026 authorization names agreement ${contract.agreement || "PA008056"}. Related orders match vendor account ${contract.vendor_account || "in the public file"} and product; the PO export does not identify an agreement per order.`
    : contract.description || "The 2025 award names the supplier; the 2026 authorization names agreement PA008056. Public PO rows do not identify an agreement per order.";
  byId("contract-id").textContent = contract.agreement || contract.contract_id || contract.id || "PA008056";
  byId("contract-end").textContent = dateLabel(contract.end_date || contract.term_end || contract.expiration_date || "2027-09-30");
  const awardUrl = safeUrl(contract.award_url || contract.url);
  if (awardUrl) byId("contract-link").href = awardUrl;
  const authorizationUrl = safeUrl(contract.authorization_url);
  if (authorizationUrl) byId("contract-authorization-link").href = authorizationUrl;
}

function renderMetrics(data) {
  const summary = data.summary || {};
  const orders = asArray(data.orders);
  const sum = (key) => orders.reduce((total, order) => total + (hasValue(order[key]) ? number(order[key]) : 0), 0);
  byId("metric-orders").textContent = count(summary.orders_count ?? orders.length);
  byId("metric-gallons").textContent = count(summary.ordered_gallons ?? sum("ordered_gallons"));
  byId("metric-fuel").textContent = amount(summary.po_fuel_amount ?? sum("po_fuel_amount"), true);
  byId("metric-fuel").title = `Exact diesel PO amount: ${amount(summary.po_fuel_amount ?? sum("po_fuel_amount"))}`;
  const matched = orders.filter((order) => order.invoice_total !== null && order.invoice_total !== undefined);
  const differences = matched.map((order) => number(order.difference)).filter((value) => value !== null && Number.isFinite(value));
  const maxDifference = differences.length ? Math.max(...differences.map(Math.abs)) : null;
  const note = byId("match-note");
  if (matched.length && maxDifference !== null && maxDifference < 1 && differences.length === matched.length) {
    const unmatched = hasValue(summary.unmatched_orders) ? number(summary.unmatched_orders) : orders.length - matched.length;
    note.textContent = `${count(matched.length)} posted invoice journal matches; each differs from the full PO total by less than $1. ${count(unmatched)} orders have no match in the loaded 2026 file.`;
  } else if (matched.length) {
    note.textContent = `${count(matched.length)} orders have posted invoice matches. Open the records below to compare each invoice with the full PO.`;
  } else {
    note.textContent = "No posted invoice matches appear in the loaded files.";
  }
}

function renderTrend(data) {
  const chart = byId("monthly-chart");
  const insight = byId("monthly-insight");
  const chartNote = byId("chart-note");
  chart.replaceChildren();
  insight.hidden = true;
  insight.textContent = "";
  chartNote.textContent = "Grouped by the PO line’s listed DeliveryDate, not an actual delivery date or invoice posting month.";
  const monthly = asArray(data.monthly).filter((row) => row && row.month).sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (!monthly.length) {
    chart.append(textNode("p", "chart-empty", "No monthly order data available."));
    chart.setAttribute("aria-label", "No monthly ordered fuel data available");
    return;
  }
  const firstMonth = String(monthly[0].month);
  const lastMonth = String(monthly.at(-1).month);
  const start = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(firstMonth);
  const end = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(lastMonth);
  if (start && end) {
    const sameYear = start[1] === end[1];
    const period = firstMonth === lastMonth
      ? `${dateLabel(firstMonth, { month: "long" })} ${start[1]}`
      : sameYear
        ? `${dateLabel(firstMonth, { month: "long" })}–${dateLabel(lastMonth, { month: "long" })} ${start[1]}`
        : `${dateLabel(firstMonth, { month: "long", year: "numeric" })}–${dateLabel(lastMonth, { month: "long", year: "numeric" })}`;
    const incompleteYear = sameYear && (start[2] !== "01" || end[2] !== "12");
    chartNote.textContent = `${period} snapshot${incompleteYear ? ", not a full-year total" : ""}. Grouped by the PO line’s listed DeliveryDate, not an actual delivery date or invoice posting month.`;
  }
  const max = Math.max(0, ...monthly.map((row) => number(row.ordered_gallons) || 0));
  const accessible = [];
  for (const row of monthly) {
    const gallons = Math.max(0, number(row.ordered_gallons) || 0);
    const month = dateLabel(row.month, { month: "short", year: "numeric" });
    accessible.push(`${month}: ${count(gallons)} gallons`);
    const group = document.createElement("div");
    group.className = "bar-group";
    group.title = `${month} listed PO line DeliveryDate: ${count(gallons)} diesel gallons inferred from ordered quantity`;
    group.append(textNode("span", "bar-value", count(gallons, true)));
    const track = document.createElement("span");
    track.className = "bar-track";
    const fill = document.createElement("span");
    fill.className = "bar-fill";
    fill.style.height = `${max ? Math.max(2, (gallons / max) * 100) : 2}%`;
    track.append(fill);
    group.append(track);
    group.append(textNode("span", "bar-label", dateLabel(row.month, { month: "short" })));
    chart.append(group);
  }
  chart.setAttribute("aria-label", `Monthly diesel ordered quantity, interpreted as gallons and grouped by listed PO line DeliveryDate: ${accessible.join("; ")}`);
  const august = monthly.find((row) => row.month === "2026-08");
  const september = monthly.find((row) => row.month === "2026-09");
  if (august && september && hasValue(august.ordered_gallons) && hasValue(september.ordered_gallons)) {
    const augustQuantity = number(august.ordered_gallons);
    const septemberQuantity = number(september.ordered_gallons);
    const difference = septemberQuantity - augustQuantity;
    const headline = difference === 0
      ? `September’s ordered diesel quantity was the same as August’s at ${count(september.ordered_gallons)} inferred gallons.`
      : `September’s ordered diesel quantity was ${count(Math.abs(difference))} inferred gallons ${difference > 0 ? "higher" : "lower"} than August’s.`;
    let detail = "";
    const augustOrders = number(august.orders_count);
    const septemberOrders = number(september.orders_count);
    if (hasValue(august.orders_count) && hasValue(september.orders_count) && augustOrders > 0 && septemberOrders > 0) {
      const augustAverage = augustQuantity / augustOrders;
      const septemberAverage = septemberQuantity / septemberOrders;
      detail = ` August had ${count(augustOrders)} orders (about ${count(augustAverage)} inferred gallons each); September had ${count(septemberOrders)} (about ${count(septemberAverage)} each).`;
      // Extra orders at August's average size isolate the order-count part of the change.
      const countEffect = (septemberOrders - augustOrders) * augustAverage;
      const averageChangedLittle = augustAverage > 0 && Math.abs(septemberAverage - augustAverage) / augustAverage <= 0.05;
      if (averageChangedLittle && difference > 0 && countEffect > difference / 2) {
        detail += " Most of the recorded increase reflects more orders; the records do not explain why.";
      } else if (averageChangedLittle && difference < 0 && countEffect < difference / 2) {
        detail += " Most of the recorded decrease reflects fewer orders; the records do not explain why.";
      }
    }
    insight.append(textNode("strong", "", headline));
    if (detail) insight.append(textNode("span", "", detail));
    insight.hidden = false;
  }
}

function renderSources(data) {
  const contract = data.contract || {};
  const items = [
    ...sourceItems(data.sources),
    { label: "City Council award record", url: safeUrl(contract.award_url) },
    { label: "Published fuel bid notice", url: safeUrl(contract.bid_url) },
    { label: "City Council authorization record", url: safeUrl(contract.authorization_url) },
    { label: "City Auditor Data Hub", url: "https://www.columbusauditor.org/Data-Hub/" }
  ].filter((item) => item.url);
  if (!items.length) return;
  const list = byId("source-list");
  list.replaceChildren();
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${item.label} ↗`;
    li.append(link);
    list.append(li);
  }
}

function filteredAllOrders() {
  const query = byId("all-order-search").value.trim().toLowerCase();
  const filter = byId("all-review-filter").value;
  return state.orders.filter((order) => {
    if (filter === "review" && !needsReview(order)) return false;
    if (filter === "clear" && needsReview(order)) return false;
    if (!query) return true;
    return [order.po_id, ...asArray(order.invoice_ids)].some((value) => String(value || "").toLowerCase().includes(query));
  });
}

function orderRow(order) {
  const tr = document.createElement("tr");
  const poTd = document.createElement("td");
  poTd.className = "po-cell";
  poTd.dataset.label = "Purchase order";
  poTd.append(textNode("span", "", order.po_id || "—"));
  if (order.mode) poTd.append(textNode("span", "cell-sub", order.mode));
  tr.append(poTd);
  tr.append(orderCell("Listed line date", "", dateLabel(order.listed_date)));
  tr.append(orderCell("Diesel qty (gal inferred)", "numeric", count(order.ordered_gallons)));
  tr.append(orderCell("Diesel PO amount", "numeric", amount(order.po_fuel_amount)));
  tr.append(orderCell("Posted invoice total", "numeric", amount(order.invoice_total)));
  const status = document.createElement("td");
  status.dataset.label = "Review status";
  status.append(textNode("span", `status-badge ${needsReview(order) ? "status-review" : "status-clear"}`, needsReview(order) ? "Review candidate" : "No flag"));
  tr.append(status);
  const action = document.createElement("td");
  action.dataset.label = "Action";
  const button = textNode("button", "inspect-button", "Inspect ↗");
  button.type = "button";
  button.setAttribute("aria-label", `Inspect purchase order ${order.po_id || "record"}`);
  button.addEventListener("click", () => openOrder(order));
  action.append(button);
  tr.append(action);
  return tr;
}

function populateRows(tbody, orders, emptyMessage) {
  tbody.replaceChildren();
  if (!orders.length) {
    const tr = document.createElement("tr");
    const td = textNode("td", "table-message", emptyMessage);
    td.colSpan = 7;
    tr.append(td);
    tbody.append(tr);
    return;
  }
  tbody.append(...orders.map(orderRow));
}

function renderReviewRows() {
  const reviews = state.orders.filter(needsReview);
  populateRows(byId("review-rows"), reviews, "No review candidates in the loaded files.");
  byId("review-summary").textContent = `${count(reviews.length)} orders need follow-up`;
  byId("all-order-count").textContent = count(state.orders.length);
  byId("open-all-orders").disabled = false;
  byId("all-dialog-title").textContent = `All ${count(state.orders.length)} selected orders`;
}

function renderAllOrders() {
  const matches = filteredAllOrders();
  const pageCount = Math.ceil(matches.length / PAGE_SIZE);
  state.allPage = Math.min(Math.max(state.allPage, 1), Math.max(pageCount, 1));
  const start = (state.allPage - 1) * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  const range = visible.length === 1 ? count(start + 1) : `${count(start + 1)}–${count(start + visible.length)}`;
  byId("all-result-count").textContent = visible.length
    ? `Showing ${range} of ${count(matches.length)} matching ${matches.length === 1 ? "order" : "orders"}`
    : "Showing 0 of 0 matching orders";
  byId("all-page-count").textContent = `Page ${pageCount ? count(state.allPage) : 0} of ${count(pageCount)}`;
  byId("all-prev-page").disabled = pageCount === 0 || state.allPage === 1;
  byId("all-next-page").disabled = pageCount === 0 || state.allPage === pageCount;
  populateRows(byId("all-order-rows"), visible, "No records match this search.");
}

function changeAllPage(direction) {
  const clickedButton = byId(direction < 0 ? "all-prev-page" : "all-next-page");
  state.allPage += direction;
  renderAllOrders();
  byId("all-orders-dialog").scrollTop = 0;
  if (clickedButton.disabled) byId(direction < 0 ? "all-next-page" : "all-prev-page").focus();
}

function detailStat(label, value) {
  const node = document.createElement("div");
  node.className = "detail-stat";
  node.append(textNode("span", "", label), textNode("strong", "", value));
  return node;
}

function detailPanel(title) {
  const node = document.createElement("section");
  node.className = "detail-panel";
  node.append(textNode("h4", "", title));
  return node;
}

function definitionList(rows) {
  const dl = document.createElement("dl");
  dl.className = "detail-dl";
  for (const [label, value] of rows) {
    dl.append(textNode("dt", "", label), textNode("dd", "", value));
  }
  return dl;
}

function listItem(title, subtitle, value) {
  const li = document.createElement("li");
  const left = document.createElement("span");
  left.className = "detail-list-main";
  left.append(textNode("strong", "", title));
  if (subtitle) left.append(textNode("small", "", subtitle));
  li.append(left, textNode("span", "detail-list-amount", value));
  return li;
}

function openOrder(order) {
  const dialog = byId("order-dialog");
  const content = byId("dialog-content");
  content.replaceChildren();

  const titleRow = document.createElement("div");
  titleRow.className = "dialog-title-row";
  const titleBlock = document.createElement("div");
  const title = textNode("h2", "", order.po_id || "Purchase order");
  title.id = "dialog-title";
  titleBlock.append(title, textNode("p", "dialog-subtitle", `Listed line date ${dateLabel(order.listed_date)}${order.mode ? ` · ${order.mode}` : ""}`));
  titleRow.append(titleBlock, textNode("span", `status-badge ${needsReview(order) ? "status-review" : "status-clear"}`, needsReview(order) ? "Review candidate" : "No flag"));
  content.append(titleRow);

  const summary = document.createElement("div");
  summary.className = "detail-summary";
  summary.append(
    detailStat("Diesel qty (gal inferred)", count(order.ordered_gallons)),
    detailStat("Diesel PO amount", amount(order.po_fuel_amount)),
    detailStat("Whole PO total", amount(order.po_total)),
    detailStat("Posted invoice total", amount(order.invoice_total))
  );
  content.append(summary);

  const notes = reasonsFor(order);
  const note = textNode("div", `detail-note${needsReview(order) ? " is-review" : ""}`,
    notes.length ? notes.join(" · ") : order.invoice_total === null ? "No matching posted invoice appears in the files loaded for this analysis." : "No rule-based review flag in the loaded files. Full PO components closely match the posted invoice total.");
  content.append(note);

  const comparison = document.createElement("section");
  comparison.className = "detail-section";
  comparison.append(textNode("h3", "", "Compare amounts"));
  const comparisonGrid = document.createElement("div");
  comparisonGrid.className = "detail-grid";
  const poPanel = detailPanel("Purchase order components");
  poPanel.append(definitionList([
    ["Main diesel fuel", amount(order.po_fuel_amount)],
    ["Tax lines", amount(order.po_tax_amount)],
    ["Other fuel / charges", amount(order.po_other_amount)],
    ["Whole PO total", amount(order.po_total)]
  ]));
  const invoicePanel = detailPanel("Posted invoice journal");
  invoicePanel.append(definitionList([
    ["Invoice ID(s)", asArray(order.invoice_ids).length ? asArray(order.invoice_ids).join(", ") : "No match in loaded files"],
    ["Invoice date", dateLabel(order.invoice_date)],
    ["Posted total", amount(order.invoice_total)],
    ["Invoice − whole PO", amount(order.difference)]
  ]));
  comparisonGrid.append(poPanel, invoicePanel);
  comparison.append(comparisonGrid);
  comparison.append(textNode("p", "detail-disclaimer", "The comparison uses the full purchase order, including tax and other-fuel lines. A small difference can reflect routine accounting adjustments. The posted journal is not the original supplier invoice."));
  content.append(comparison);

  const lines = asArray(order.po_lines);
  const linesSection = document.createElement("section");
  linesSection.className = "detail-section";
  linesSection.append(textNode("h3", "", `Purchase order lines${lines.length ? ` (${lines.length})` : ""}`));
  if (lines.length) {
    const list = document.createElement("ul");
    list.className = "detail-list";
    for (const line of lines) {
      const subtype = [line.kind, line.category, line.kind === "diesel_fuel" && hasValue(line.ordered_qty) ? `PO quantity ${count(line.ordered_qty)} (gal inferred)` : null, line.source_document_line ? `Document line ${line.source_document_line}` : null].filter(Boolean).join(" · ");
      list.append(listItem(line.description || `Line ${line.line_number || ""}`, subtype, amount(line.amount)));
    }
    linesSection.append(list);
  } else linesSection.append(textNode("p", "detail-empty", "No order-line detail in this published extract."));
  content.append(linesSection);

  const invoices = asArray(order.invoices);
  const invoiceSection = document.createElement("section");
  invoiceSection.className = "detail-section";
  invoiceSection.append(textNode("h3", "", `Matched invoice journal entries${invoices.length ? ` (${invoices.length})` : ""}`));
  if (invoices.length) {
    const list = document.createElement("ul");
    list.className = "detail-list";
    for (const invoice of invoices) {
      const subtitle = [dateLabel(invoice.invoice_date), invoice.ledger_voucher ? `Voucher ${invoice.ledger_voucher}` : null, invoice.source_document_header ? `Document header ${invoice.source_document_header}` : null].filter(Boolean).join(" · ");
      list.append(listItem(invoice.invoice_id || "Invoice entry", subtitle, amount(invoice.amount)));
    }
    invoiceSection.append(list);
  } else invoiceSection.append(textNode("p", "detail-empty", "No corresponding invoice journal entry appears in the loaded files. This does not prove an invoice was never issued."));
  content.append(invoiceSection);

  const components = asArray(order.accounting_components);
  if (components.length) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.append(textNode("h3", "", `Accounting distribution${components.length ? ` (${components.length})` : ""}`));
    const list = document.createElement("ul");
    list.className = "detail-list";
    for (const component of components) {
      const title = [component.department, component.division].filter(Boolean).join(" / ") || "Accounting component";
      const subtitle = [component.object_class ? `Class ${component.object_class}` : null, component.source_document_header ? `Document header ${component.source_document_header}` : null, component.source_document_line ? `Line ${component.source_document_line}` : null].filter(Boolean).join(" · ");
      list.append(listItem(title, subtitle, amount(component.amount)));
    }
    section.append(list);
    content.append(section);
  }

  const links = sourceItems(order.source_files).filter((source) => source.url);
  if (links.length) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.append(textNode("h3", "", "Public source files"));
    const wrap = document.createElement("div");
    wrap.className = "detail-links";
    for (const source of links) {
      const link = textNode("a", "", `${source.label} ↗`);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      wrap.append(link);
    }
    section.append(wrap);
    section.append(textNode("p", "detail-disclaimer", "These links open full public CSV files. Search the PO ID in the order and invoice files; use document header and line IDs to trace accounting rows."));
    content.append(section);
  }
  content.append(textNode("p", "detail-disclaimer", "Listed line dates and inferred gallons describe order records, not confirmed delivery. Review candidates identify questions in the published files; they are not findings of wrongdoing or recovered savings."));
  dialog.showModal();
}

async function loadData() {
  try {
    const response = await fetch("./data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request returned ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.orders)) throw new Error("Data file has no order list");
    state.data = data;
    state.orders = [...data.orders].sort((a, b) =>
      String(b.listed_date || "").localeCompare(String(a.listed_date || "")) ||
      String(b.po_id || "").localeCompare(String(a.po_id || ""))
    );
    renderHeader(data);
    renderMetrics(data);
    renderTrend(data);
    renderSources(data);
    renderReviewRows();
    renderAllOrders();
  } catch (error) {
    populateRows(byId("review-rows"), [], "The public data file is unavailable. Please try again later.");
    populateRows(byId("all-order-rows"), [], "The public data file is unavailable. Please try again later.");
    byId("review-summary").textContent = "Data unavailable";
    byId("all-result-count").textContent = "Data unavailable";
    byId("all-page-count").textContent = "Page 0 of 0";
    byId("match-note").textContent = "Record match status is unavailable.";
    byId("monthly-chart").setAttribute("aria-label", "Monthly chart unavailable");
    byId("monthly-chart").append(textNode("p", "chart-empty", "Monthly data unavailable."));
    console.error("Could not load public records:", error);
  }
}

byId("open-all-orders").addEventListener("click", () => {
  byId("all-order-search").value = "";
  byId("all-review-filter").value = "all";
  state.allPage = 1;
  renderAllOrders();
  byId("all-orders-dialog").showModal();
});
byId("all-order-search").addEventListener("input", () => { state.allPage = 1; renderAllOrders(); byId("all-orders-dialog").scrollTop = 0; });
byId("all-review-filter").addEventListener("change", () => { state.allPage = 1; renderAllOrders(); byId("all-orders-dialog").scrollTop = 0; });
byId("all-prev-page").addEventListener("click", () => changeAllPage(-1));
byId("all-next-page").addEventListener("click", () => changeAllPage(1));
byId("all-dialog-close").addEventListener("click", () => byId("all-orders-dialog").close());
byId("all-orders-dialog").addEventListener("click", (event) => {
  if (event.target === byId("all-orders-dialog")) byId("all-orders-dialog").close();
});
byId("all-orders-dialog").addEventListener("close", () => {
  window.setTimeout(() => byId("open-all-orders").focus(), 0);
});
byId("dialog-close").addEventListener("click", () => byId("order-dialog").close());
byId("order-dialog").addEventListener("click", (event) => {
  if (event.target === byId("order-dialog")) byId("order-dialog").close();
});
loadData();
