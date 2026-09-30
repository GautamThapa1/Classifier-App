const $ = id => document.getElementById(id);
const RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const BADGE = {
  Critical: "bg-red-100 text-red-700", High: "bg-orange-100 text-orange-700",
  Medium: "bg-yellow-100 text-yellow-700", Low: "bg-green-100 text-green-700",
  Angry: "bg-red-100 text-red-700", Frustrated: "bg-orange-100 text-orange-700",
  Anxious: "bg-purple-100 text-purple-700", Neutral: "bg-slate-100 text-slate-700",
  Happy: "bg-green-100 text-green-700",
};
const HEX = {
  Critical: "#dc2626", High: "#f97316", Medium: "#eab308", Low: "#22c55e",
  Angry: "#dc2626", Frustrated: "#f97316", Anxious: "#a855f7", Neutral: "#94a3b8", Happy: "#22c55e",
};
let data = { tickets: [], stats: null };
const PAGE = 15;
let page = 1;
const charts = {};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const badge = v => `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[v] || "bg-slate-100 text-slate-600"}">${esc(v)}</span>`;
const show = t => { $("msg").textContent = t; $("msg").classList.toggle("hidden", !t); };

function chart(id, type, counts) {
  charts[id]?.destroy();
  const labels = Object.keys(counts);
  charts[id] = new Chart($(id), {
    type,
    data: { labels, datasets: [{ data: Object.values(counts), backgroundColor: labels.map(l => HEX[l] || "#6366f1") }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: type !== "bar", position: "bottom" } }, scales: type === "bar" ? { y: { ticks: { precision: 0 } } } : {} },
  });
}

function kpi(label, value, sub = "") {
  return `<div class="bg-white border rounded-xl p-4"><p class="text-xs text-slate-500">${label}</p><p class="text-2xl font-semibold">${value}</p><p class="text-xs text-slate-400">${sub}</p></div>`;
}

function render() {
  page = 1;
  const s = data.stats, has = data.tickets.length > 0;
  $("empty").classList.toggle("hidden", has);
  $("dash").classList.toggle("hidden", !has);
  $("ver").textContent = data.version ? `${data.version} · ${data.model}` : "";
  if (!has || !s) return;

  const u = s.urgency, se = s.sentiment;
  const urgent = (u.Critical || 0) + (u.High || 0);
  const upset = (se.Angry || 0) + (se.Frustrated || 0) + (se.Anxious || 0);
  $("kpis").innerHTML =
    kpi("Total tickets", s.total, s.failed ? `${s.failed} failed` : "all triaged") +
    kpi("Critical", u.Critical || 0, "needs immediate action") +
    kpi("Critical + High", `${Math.round(100 * urgent / s.total)}%`, `${urgent} tickets`) +
    kpi("Negative sentiment", `${Math.round(100 * upset / s.total)}%`);

  chart("cUrg", "doughnut", u);
  chart("cCat", "bar", s.category);
  chart("cSen", "doughnut", se);

  const cur = $("fCat").value;
  $("fCat").innerHTML = `<option value="">All categories</option>` + Object.keys(s.category).map(c => `<option>${c}</option>`).join("");
  $("fCat").value = cur;
  renderRows();
}

function renderRows() {
  const f = { u: $("fUrg").value, c: $("fCat").value, s: $("fSen").value, q: $("fQ").value.toLowerCase(), sort: $("fSort").value };
  let r = data.tickets.filter(t => {
    const x = t.triage || {};
    return (!f.u || x.urgency === f.u) && (!f.c || x.category === f.c) && (!f.s || x.sentiment === f.s) && t.message.toLowerCase().includes(f.q);
  });
  r.sort((a, b) => f.sort === "id"
    ? String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    : (RANK[a.triage?.urgency] ?? 9) - (RANK[b.triage?.urgency] ?? 9));

  $("none").classList.toggle("hidden", r.length > 0);
  const pages = Math.max(1, Math.ceil(r.length / PAGE));
  page = Math.min(page, pages);
  const start = (page - 1) * PAGE;
  const shown = r.slice(start, start + PAGE);
  $("rows").innerHTML = shown.map(t => {
    const x = t.triage;
    return `<tr class="border-t hover:bg-slate-50 cursor-pointer" data-id="${esc(t.id)}">
      <td class="p-3 text-slate-500">${esc(t.id)}</td>
      <td class="p-3 max-w-md truncate">${esc(t.message)}</td>
      <td class="p-3">${x ? badge(x.urgency) : badge("Failed")}</td>
      <td class="p-3">${x ? esc(x.category) : "—"}</td>
      <td class="p-3">${x ? badge(x.sentiment) : "—"}</td></tr>`;
  }).join("");
  renderPager(r.length, start, shown.length);
}

function renderPager(total, start, shown) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const btn = "px-3 py-1.5 border rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed";
  $("pager").classList.toggle("hidden", total === 0);
  $("pager").innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <span>Showing ${start + 1}–${start + shown} of ${total}</span>
    ${pages > 1 ? `<div class="flex items-center gap-2">
      <button id="prev" class="${btn}" ${page === 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${page} of ${pages}</span>
      <button id="next" class="${btn}" ${page === pages ? "disabled" : ""}>Next</button>
    </div>` : ""}
  </div>`;
  const go = n => { page = n; renderRows(); $("pager").closest("section").scrollIntoView({ behavior: "smooth", block: "start" }); };
  if ($("prev")) $("prev").onclick = () => go(page - 1);
  if ($("next")) $("next").onclick = () => go(page + 1);
}

function openDetail(id) {
  const t = data.tickets.find(t => String(t.id) === id), x = t.triage;
  $("drawer").innerHTML = `
    <button id="close" class="text-sm text-slate-500 mb-4">✕ Close</button>
    <h2 class="font-semibold mb-2">Ticket #${esc(t.id)}</h2>
    <p class="text-sm bg-slate-50 border rounded-lg p-3 mb-4">${esc(t.message)}</p>
    ${x ? `
      <div class="flex flex-wrap gap-2 mb-3">${badge(x.urgency)} ${badge(x.sentiment)}
        <span class="px-2 py-0.5 rounded-full text-xs bg-slate-100">${esc(x.category)}</span></div>
      <p class="text-xs text-slate-500 mb-1">Why: ${esc(x.reasoning)}</p>
      <p class="text-xs text-slate-500 mb-1">Unverified: ${esc(x.uncertainty || "—")}</p>
      <p class="text-xs text-slate-500 mb-4">AI confidence: <b>${esc(x.confidence)}</b>${x.confidence === "Low" ? " — please review" : ""}</p>
      <h3 class="text-sm font-medium mb-1">Suggested reply</h3>
      <textarea id="reply" rows="9" class="w-full border rounded-lg p-3 text-sm">${esc(x.suggested_reply)}</textarea>
      <button id="copy" class="mt-2 px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white">Copy reply</button>`
    : `<p class="text-sm text-red-600">Triage failed: ${esc(t.error || "unknown error")}. Re-run the batch.</p>`}`;
  $("drawer").classList.remove("translate-x-full");
  $("overlay").classList.remove("hidden");
  $("close").onclick = closeDetail;
  if ($("copy")) $("copy").onclick = async e => {
    await navigator.clipboard.writeText($("reply").value);
    e.target.textContent = "Copied ✓";
  };
}
function closeDetail() {
  $("drawer").classList.add("translate-x-full");
  $("overlay").classList.add("hidden");
}

async function run(body) {
  $("runBtn").disabled = true;
  $("runBtn").textContent = "Triaging…";
  show("");
  try {
    const r = await fetch("/api/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Request failed");
    data = j;
    render();
  } catch (e) {
    show(e.message);
  } finally {
    $("runBtn").disabled = false;
    $("runBtn").textContent = "Run sample batch";
  }
}

$("runBtn").onclick = () => run();
$("fileIn").onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try { run(JSON.parse(await f.text())); } catch { show("That file isn't valid JSON."); }
  e.target.value = "";
};
["fQ", "fUrg", "fCat", "fSen", "fSort"].forEach(id => $(id).addEventListener("input", () => { page = 1; renderRows(); }));
$("rows").onclick = e => { const tr = e.target.closest("tr"); if (tr) openDetail(tr.dataset.id); };
$("overlay").onclick = closeDetail;

fetch("/api/results").then(r => r.json()).then(j => { data = j; render(); });