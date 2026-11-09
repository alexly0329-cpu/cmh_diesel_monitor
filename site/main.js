/* Columbus Diesel Order Monitor — single-page site.
   Mechanics mirror the reference flow: Lenis + ScrollTrigger, 4-layer hero parallax (>991px),
   nav that fades in after 100px and swaps theme per section, Swiper carousel with draggable
   scrollbar, embedded tools in light panels, and a fixed reveal footer (CSS). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const usd = n => n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");
const usd2 = n => n == null ? "—" : "$" + n.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const num = n => n == null ? "—" : Math.round(n).toLocaleString("en-US");
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONFULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fdate = s => { const [y, m, d] = s.split("-"); return `${MON[+m - 1]} ${+d}, ${y}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const motion = !!(window.gsap && window.ScrollTrigger && window.Lenis) && !reduce;
if (!motion) document.documentElement.classList.remove("js");

let DATA = null, orders = [], filter = "all", query = "", page = 0, lenis = null;
const PER = 8;

/* ================= data ================= */
fetch("data.json").then(r => r.json()).then(d => {
  DATA = d;
  orders = [...d.orders].sort((a, b) => b.listed_date.localeCompare(a.listed_date) || b.po_id.localeCompare(a.po_id));
  boot();
}).catch(() => { $("#rows").innerHTML = '<li class="rows__empty">Could not load data.json. Serve this folder over http (not file://).</li>'; });

const isFlag = o => o.difference_class === "invoice_not_in_loaded_file";

function boot() {
  const s = DATA.summary;
  $$("[data-bind]").forEach(el => { const v = {matched: s.matched_orders, review: s.review_count, orders: s.orders_count}[el.dataset.bind]; if (v != null) el.textContent = v; });
  const asof = new Date(DATA.as_of);
  $$("[data-asof]").forEach(el => el.textContent = el.closest(".story") ? "Data as of " + fdate(DATA.as_of.slice(0, 10)) : fdate(DATA.as_of.slice(0, 10)));
  const age = Math.floor((Date.now() - asof) / 864e5);
  $$("[data-dot]").forEach(d => d.classList.toggle("is-old", age > 30));
  $("[data-fresh]").textContent = `Snapshot retrieved ${fdate(DATA.as_of.slice(0, 10))} · ${age} day${age === 1 ? "" : "s"} old`;
  drawRows(); buildCarousel(); drawBars(false);
  if (motion) ScrollTrigger.refresh();
}

/* ================= order explorer ================= */
function filtered() {
  const q = query.trim().toLowerCase();
  return orders.filter(o => (filter === "all" || isFlag(o)) &&
    (!q || `${o.po_id} ${o.listed_date} ${fdate(o.listed_date)} ${o.mode} ${MONFULL[+o.listed_date.slice(5, 7) - 1]}`.toLowerCase().includes(q)));
}
function drawRows() {
  const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
  page = Math.min(page, pages - 1);
  const slice = list.slice(page * PER, page * PER + PER);
  $("#rows").innerHTML = slice.length ? slice.map(o => `
    <li><button type="button" data-po="${o.po_id}">
      <b>${o.po_id}</b><span class="amt">${usd(o.po_total)}</span>
      <small>${fdate(o.listed_date)} · ${num(o.ordered_gallons)} gal · ${esc(o.mode)}</small>
      <span class="st ${isFlag(o) ? "is-flag" : ""}"><i></i>${isFlag(o) ? "No invoice found" : "Invoice matched"}</span>
    </button></li>`).join("") : '<li class="rows__empty">No orders match that search.</li>';
  $("#pageInfo").textContent = list.length ? `${page * PER + 1}–${page * PER + slice.length} of ${list.length}` : "0 results";
  $("#prev").disabled = page === 0; $("#next").disabled = page >= pages - 1;
}
$("#q").addEventListener("input", e => { query = e.target.value; page = 0; drawRows(); });
$("#prev").onclick = () => { page--; drawRows(); };
$("#next").onclick = () => { page++; drawRows(); };
function setFilter(f) {
  filter = f; page = 0;
  $$(".seg [data-f]").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === f));
  if (DATA) drawRows();
}
$$(".seg [data-f]").forEach(b => b.onclick = () => setFilter(b.dataset.f));
$$(".cat").forEach(c => c.addEventListener("click", () => setFilter(c.dataset.filter)));
$("#rows").addEventListener("click", e => { const b = e.target.closest("[data-po]"); if (b) openRecord(b.dataset.po); });

/* ================= record dialog ================= */
const dlg = $("#dlg");
function openRecord(id) {
  const o = DATA.orders.find(x => x.po_id === id); if (!o) return;
  const flag = isFlag(o);
  const lines = (o.po_lines || []).map(l => `<tr><td>${l.line_number}</td><td>${esc(l.description)}<br><small style="color:var(--muted)">${esc(l.kind)} · qty ${num(l.ordered_qty)}</small></td><td>${usd2(l.amount)}</td></tr>`).join("");
  $("#dlgBody").innerHTML = `<div class="dlg__b" id="dlgTitle">
    <h3>${o.po_id}</h3><div class="k">Listed ${fdate(o.listed_date)} · ${esc(o.mode)}</div>
    <div class="note ${flag ? "" : "ok"}">${flag ? esc((o.review_reasons || [])[0] || "No invoice found in the loaded 2026 journal.") : (o.review_reasons && o.review_reasons[0] ? esc(o.review_reasons[0]) : "Matched to a posted invoice journal; difference is below the $25 review threshold.")}</div>
    <dl class="sum">
      <div><dt>Ordered gallons</dt><dd>${num(o.ordered_gallons)}</dd></div>
      <div><dt>Diesel fuel lines</dt><dd>${usd2(o.po_fuel_amount)}</dd></div>
      <div><dt>Tax lines</dt><dd>${usd2(o.po_tax_amount)}</dd></div>
      <div><dt>Other lines</dt><dd>${usd2(o.po_other_amount)}</dd></div>
      <div><dt>PO total</dt><dd>${usd2(o.po_total)}</dd></div>
      <div><dt>Posted invoices</dt><dd>${o.invoice_total == null ? "—" : usd2(o.invoice_total)}</dd></div>
      ${o.difference == null ? "" : `<div><dt>Invoice − PO</dt><dd>${usd2(o.difference)}</dd></div>`}
      ${o.invoice_ids && o.invoice_ids.length ? `<div><dt>Invoice IDs</dt><dd>${o.invoice_ids.map(esc).join(", ")}</dd></div>` : ""}
    </dl>
    ${lines ? `<table><thead><tr><th>Line</th><th>Description</th><th>Amount</th></tr></thead><tbody>${lines}</tbody></table>` : ""}
    <div class="links">${(o.source_files || []).map(f => `<a href="${esc(f.url)}" rel="noopener">${esc(f.label)}</a>`).join("")}</div></div>`;
  dlg.showModal();
}
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener("close", () => { if (lenis) lenis.start(); });
dlg.addEventListener("cancel", () => { if (lenis) lenis.start(); });
const _show = dlg.showModal.bind(dlg); dlg.showModal = () => { if (lenis) lenis.stop(); _show(); };

/* ================= carousel (Swiper, same options as the reference) ================= */
function buildCarousel() {
  const top = [...DATA.orders].sort((a, b) => b.po_total - a.po_total).slice(0, 9);
  const art = i => `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><use href="#art-sky"/><use href="#${["art-far","art-mid"][i % 2]}"/><use href="#art-fore"/></svg>`;
  $("#slides").innerHTML = top.map((o, i) => `
    <div class="swiper-slide"><article class="bcard">
      <div class="bcard__art">${art(i)}<span class="bcard__tag ${isFlag(o) ? "is-flag" : ""}"><i></i>${isFlag(o) ? "No invoice found" : "Invoice matched"}</span></div>
      <div class="bcard__body"><small>${esc(o.mode)} · ${fdate(o.listed_date)}</small><h3>${o.po_id}</h3>
      <p>${num(o.ordered_gallons)} gallons ordered, ${usd(o.po_fuel_amount)} in diesel fuel lines. Full order total ${usd(o.po_total)}.</p>
      <button type="button" class="btn" data-po="${o.po_id}">View record <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6"/></svg></button></div>
    </article></div>`).join("");
  $("#slides").addEventListener("click", e => { const b = e.target.closest("[data-po]"); if (b) openRecord(b.dataset.po); });
  if (window.Swiper) new Swiper("#swiper", {
    slidesPerView: "auto", spaceBetween: 20, followFinger: true, speed: 600,
    mousewheel: {forceToAxis: true}, keyboard: {enabled: true, onlyInViewport: true},
    navigation: {nextEl: ".arrow.is-next", prevEl: ".arrow.is-prev"},
    scrollbar: {el: "#sbar", draggable: true, snapOnRelease: true},
  });
}

/* ================= monthly chart ================= */
const MKEY = {ordered_gallons: v => num(v) + " gal", po_fuel_amount: usd, orders_count: num};
const MSHORT = {ordered_gallons: v => Math.round(v / 1000) + "k", po_fuel_amount: v => "$" + Math.round(v / 1000) + "k", orders_count: v => v};
let metric = "ordered_gallons", sel = -1;
function drawBars(animate) {
  if (!DATA) return;
  const M = DATA.monthly; if (sel < 0) sel = M.length - 1;
  const max = Math.max(...M.map(d => d[metric]));
  $("#monthLabels").innerHTML = M.map(d => `<span>${MON[+d.month.slice(5) - 1]}</span>`).join("");
  $("#bars").innerHTML = M.map((d, i) => `<button class="bar" type="button" data-i="${i}" aria-pressed="${i === sel}" aria-label="${MONFULL[+d.month.slice(5) - 1]}: ${MKEY[metric](d[metric])}"><em>${MSHORT[metric](d[metric])}</em><i style="height:${(d[metric] / max * 84).toFixed(1)}%"></i></button>`).join("");
  if (animate && motion) gsap.from("#bars .bar i", {scaleY: 0, duration: .8, ease: "power3.out", stagger: .05});
  drawDetail();
}
function drawDetail() {
  const d = DATA.monthly[sel], ok = d.review_count === 0;
  $("#mdetail").innerHTML = `<h3>${MONFULL[+d.month.slice(5) - 1]} 2026</h3><div class="k">${d.orders_count} purchase orders</div>
    <dl><div><dt>Ordered gallons</dt><dd>${num(d.ordered_gallons)}</dd></div><div><dt>Diesel fuel lines</dt><dd>${usd(d.po_fuel_amount)}</dd></div><div><dt>Full PO total</dt><dd>${usd(d.po_total)}</dd></div><div><dt>Posted invoices</dt><dd>${usd(d.invoice_total)}</dd></div></dl>
    <div class="flag ${ok ? "ok" : ""}">${ok ? "No follow-up records this month." : d.review_count + " order" + (d.review_count > 1 ? "s" : "") + " with no invoice match in the loaded file."}</div>`;
}
$("#bars").addEventListener("click", e => { const b = e.target.closest(".bar"); if (!b) return; sel = +b.dataset.i; $$("#bars .bar").forEach((x, i) => x.setAttribute("aria-pressed", i === sel)); drawDetail(); });
$$("[data-m]").forEach(b => b.onclick = () => { metric = b.dataset.m; $$("[data-m]").forEach(x => x.setAttribute("aria-pressed", x === b)); drawBars(true); });

/* ================= mobile menu ================= */
const nav = $("#nav"), burger = $("#burger");
burger.onclick = () => { const o = nav.classList.toggle("open"); burger.setAttribute("aria-expanded", o); };
$("#navLinks").addEventListener("click", e => { if (e.target.closest("a")) { nav.classList.remove("open"); burger.setAttribute("aria-expanded", false); } });

/* ================= motion ================= */
if (motion) {
  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({duration: 1});
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const id = a.getAttribute("href");
    if (id.length > 1 && $(id)) { e.preventDefault(); lenis.scrollTo(id, {offset: id === "#top" ? 0 : -60, duration: 1.4}); }
  }));

  // hero intro
  gsap.timeline({defaults: {ease: "power4.out"}})
    .from(".hero h1 .ln>span", {yPercent: 110, duration: 1.1, stagger: .14})
    .from("[data-hero]:not(h1)", {y: 30, opacity: 0, duration: .9, stagger: .1}, "-=.8");

  // nav: bg fades in after 100px (reversible), theme follows the section under it
  gsap.to(".nav__bg", {opacity: 1, ease: "none", scrollTrigger: {trigger: "body", start: "top top", end: "100px top", scrub: true}});
  $$("[data-theme]").forEach(sec => {
    if (sec === nav || sec.classList.contains("foot")) return;
    ScrollTrigger.create({trigger: sec, start: "top 60px", end: "bottom 60px", onToggle: s => { if (s.isActive) nav.dataset.theme = sec.dataset.theme; }});
  });

  // 4-layer hero parallax, >991px only (same yPercent values as the reference)
  ScrollTrigger.matchMedia({"(min-width: 992px)": () => {
    const header = $(".parallax__header");
    const tl = gsap.timeline({scrollTrigger: {trigger: header, start: "0% 0%", end: "100% 0%", scrub: 0}});
    [["1", 40], ["2", 30], ["3", 80], ["4", 20]].forEach(([l, y], i) =>
      tl.to(header.querySelectorAll(`[data-parallax-layer="${l}"]`), {yPercent: y, ease: "none"}, i ? "<" : undefined));
    gsap.to(".hero__copy", {yPercent: -30, opacity: 0, ease: "none", scrollTrigger: {trigger: header, start: "5% top", end: "55% top", scrub: true}});
    gsap.to(".story", {opacity: 0, ease: "none", scrollTrigger: {trigger: header, start: "5% top", end: "30% top", scrub: true}});
  }});

  // snapshot band: slow image drift
  gsap.fromTo(".snap__art", {yPercent: -6}, {yPercent: 6, ease: "none", scrollTrigger: {trigger: ".snap", start: "top bottom", end: "bottom top", scrub: true}});

  // reveals
  ScrollTrigger.batch("[data-r]", {start: "top 90%", once: true, onEnter: els => gsap.to(els, {opacity: 1, y: 0, duration: .9, ease: "power3.out", stagger: .12})});

  // count-ups
  $$("[data-count]").forEach(el => {
    const end = +el.dataset.count, dec = +(el.dataset.dec || 0), o = {v: 0};
    ScrollTrigger.create({trigger: el, start: "top 90%", once: true, onEnter: () =>
      gsap.to(o, {v: end, duration: 1.8, ease: "power2.out", onUpdate: () => el.textContent = dec ? o.v.toFixed(dec) : num(o.v)})});
  });
  ScrollTrigger.create({trigger: ".tool--chart", start: "top 80%", once: true, onEnter: () => { if (DATA) gsap.from("#bars .bar i", {scaleY: 0, duration: .9, ease: "power3.out", stagger: .06}); }});
}
