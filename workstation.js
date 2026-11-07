"use strict";
const $ = id => document.getElementById(id);
const storageKey = "astrolens.transit.sessions.v1";
let report = null;
let selectedCandidate = 0;
let searchTarget = "";
let sessions = [];
try { sessions = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { /* Storage is optional. */ }
if (!Array.isArray(sessions)) sessions = [];

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function status(id, message, error = false) {
  $(id).textContent = message;
  $(id).classList.toggle("error", error);
}

function view() {
  const route = location.hash.slice(1);
  if (route === "main") return;
  const active = [...document.querySelectorAll(".view")].some(node => node.id === route) ? route : "mission";
  document.querySelectorAll(".view").forEach(node => { node.hidden = node.id !== active; });
  document.querySelectorAll("nav a").forEach(node => {
    if (node.hash === "#" + active) node.setAttribute("aria-current", "page");
    else node.removeAttribute("aria-current");
  });
  requestAnimationFrame(drawCharts);
}
window.addEventListener("hashchange", view);
window.addEventListener("resize", drawCharts);

async function api(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Start the AstroLens analysis server with python -m astronomy.server.");
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}
api("/api/health").then(() => status("service", "Analysis service available"))
  .catch(() => status("service", "Analysis service unavailable", true));

$("search").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $("product").replaceChildren(new Option("Searching…", ""));
  $("product").disabled = true;
  searchTarget = $("target").value.trim();
  status("search-status", "Querying NASA MAST for public observation products…");
  try {
    const { products } = await api("/api/products?" + new URLSearchParams({ target: searchTarget }));
    $("product").replaceChildren(new Option(products.length ? "Select an observation" : "No matching products", ""));
    for (const item of products) $("product").add(new Option(item.file, item.uri));
    $("product").disabled = !products.length;
    status("search-status", products.length + " selectable light-curve product(s).");
    status("archive-status", "MAST responded with " + products.length + " selectable product(s).");
  } catch (error) {
    $("product").replaceChildren(new Option("Archive unavailable", ""));
    status("search-status", error.message, true);
    status("archive-status", "MAST request failed.", true);
  } finally { button.disabled = false; }
});

$("product").addEventListener("change", () => { if ($("product").value) $("file").value = ""; });
$("file").addEventListener("change", () => { if ($("file").files.length) $("product").value = ""; });
$("analysis").addEventListener("submit", async event => {
  event.preventDefault();
  const file = $("file").files[0], uri = $("product").value;
  if (!file && !uri) return status("analysis-status", "Choose a file or a MAST product.", true);
  if (file?.size > 25 * 1024 * 1024) return status("analysis-status", "The file exceeds 25 MiB.", true);
  const query = new URLSearchParams();
  for (const key of ["minimum_period", "maximum_period", "trend_days"]) query.set(key, $(key).value);
  if (file) query.set("filename", file.name);
  $("run").disabled = true;
  $("open-results").hidden = true;
  status("analysis-status", file ? "Validating and analyzing the uploaded observation…" :
    "Retrieving the selected MAST product, then analyzing the light curve…");
  try {
    const next = await api("/api/analyze?" + query, { method: "POST",
      headers: { "Content-Type": file ? "application/octet-stream" : "application/json" },
      body: file || JSON.stringify({ target: searchTarget, uri }) });
    render(next);
    status("analysis-status", "Analysis complete. " + next.candidates.length + " hypothesis/hypotheses returned.");
    $("open-results").hidden = false;
  } catch (error) {
    status("analysis-status", error.message + (report ? " The previous report is still available." : ""), true);
  } finally { $("run").disabled = false; }
});

function render(next, index = 0) {
  report = next;
  selectedCandidate = index;
  const { observation, preprocessing, candidates, catalogue_coverage, limitations } = report;
  const title = observation.target || observation.file;
  status("coverage", `${preprocessing.used} cadences · ${preprocessing.coverage_days.toFixed(2)} days · ${preprocessing.gap_count} gaps`);
  status("signal-count", String(candidates.length));
  status("archive-status", "Catalogue comparison: " + catalogue_coverage.status);
  status("curve-description", title + " · " + observation.provenance);
  $("curve-tools").hidden = false;
  $("save").disabled = $("export").disabled = false;
  $("fold-panel").hidden = !candidates.length;
  status("candidate-description", candidates.length ? title + " · catalogue comparison " + catalogue_coverage.status :
    "No hypothesis passed the configured detection threshold.");
  const items = candidates.map((candidate, i) => {
    const card = text("article", "", "panel");
    card.append(text("p", "REVIEW RANK " + candidate.review_rank, "eyebrow"), text("h2", candidate.classification));
    const details = text("dl", "", "detail-grid");
    for (const [label, value] of Object.entries({
      "Period (days)": candidate.period_days.toFixed(5), "Epoch (observation days)": candidate.epoch_days.toFixed(5),
      "Duration (hours)": (candidate.duration_days * 24).toFixed(2), "Depth (ppm)": (candidate.depth * 1e6).toFixed(0),
      "White-noise SNR": candidate.snr.toFixed(1), "Supported events": candidate.observed_transits,
      "Odd/even (σ)": candidate.odd_even_sigma?.toFixed(1) ?? "Unavailable",
      "Secondary SNR": candidate.secondary_snr?.toFixed(1) ?? "Unavailable"
    })) details.append(text("dt", label), text("dd", value));
    const fold = text("button", "Show folded curve");
    fold.addEventListener("click", () => {
      selectedCandidate = i; drawCharts(); $("fold-panel").scrollIntoView({ block: "nearest" });
    });
    card.append(details, text("p", candidate.ranking_basis),
      text("p", candidate.warnings.join(" · ") || "No tested veto triggered."), fold);
    for (const match of candidate.catalogue_matches) card.append(text("p", match.id + " · " + match.classification + " · period ratio " + match.ratio.toFixed(2)));
    return card;
  });
  const context = text("article", "", "panel");
  context.append(text("h2", "Observation & analysis notes"), text("p", "Input: " + observation.file),
    text("p", "SHA-256: " + observation.sha256, "record"),
    text("p", "Time system: " + observation.time_system + " · BJD reference: " + (observation.bjd_reference ?? "unavailable")));
  if (observation.source_url) {
    const source = text("a", "Download source from NASA MAST");
    source.href = observation.source_url; context.append(source);
  }
  for (const note of limitations) context.append(text("p", note));
  for (const [table, detail] of Object.entries(catalogue_coverage.failures || {})) context.append(text("p", table + " · " + detail));
  if (catalogue_coverage.reason) context.append(text("p", catalogue_coverage.reason));
  $("evidence").replaceChildren(...items, context);
  renderRecords();
  drawCharts();
}

function plot(canvas, points, axis, output) {
  if (!points.length || !canvas.clientWidth) return;
  const width = canvas.clientWidth, height = canvas.clientHeight, ratio = Math.min(devicePixelRatio, 2);
  canvas.width = width * ratio; canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const [x, y] of points) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  const left = 62, top = 15, plotW = width - left - 15, plotH = height - top - 30;
  ctx.font = "11px system-ui";
  for (let i = 0; i <= 4; i++) {
    const y = top + plotH * i / 4;
    ctx.strokeStyle = "#26374e"; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - 15, y); ctx.stroke();
    ctx.fillStyle = "#a7bad0"; ctx.fillText((ymax - (ymax - ymin) * i / 4).toFixed(5), 5, y + 4);
  }
  for (const [x, y, transit] of points) {
    ctx.fillStyle = transit ? "#ffce86" : "#8ef1d7";
    ctx.globalAlpha = transit ? .9 : .45;
    ctx.fillRect(left + (x - xmin) / (xmax - xmin || 1) * plotW,
      top + (ymax - y) / (ymax - ymin || 1) * plotH, transit ? 2 : 1.5, 2);
  }
  status(output, `${axis} ${xmin.toFixed(4)} to ${xmax.toFixed(4)} · Relative flux ${ymin.toFixed(5)} to ${ymax.toFixed(5)} · ${points.length} cadences · Amber marks the transit window`);
}

function drawCharts() {
  if (!report) return;
  const { time, flux, raw } = report.curve;
  const candidate = report.candidates[selectedCandidate];
  const phase = t => ((t - candidate.epoch_days) / candidate.period_days + .5) % 1;
  const fold = t => (phase(t) + 1) % 1 - .5;
  const inTransit = t => candidate && Math.abs(fold(t)) < candidate.duration_days / (2 * candidate.period_days);
  if (!$("laboratory").hidden) {
    const fraction = Number($("zoom").value), center = Number($("pan").value) / 100;
    const size = (time.at(-1) - time[0]) * fraction;
    const start = time[0] + (time.at(-1) - time[0] - size) * center;
    const values = $("flux-mode").value === "raw" ? raw : flux;
    const points = time.flatMap((t, i) => t >= start - 1e-8 && t <= start + size + 1e-8 ? [[t, values[i], inTransit(t)]] : []);
    if (points.length) plot($("curve"), points, "Observation days", "curve-range");
    else {
      const canvas = $("curve");
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      status("curve-range", "No cadences in this window. Change position or zoom.");
    }
  }
  if (candidate && !$("investigation").hidden) {
    plot($("fold"), time.map((t, i) => [fold(t), flux[i], inTransit(t)]),
      "Orbital phase · review rank " + candidate.review_rank + " ·", "fold-range");
  }
}
for (const id of ["flux-mode", "zoom", "pan"]) $(id).addEventListener("input", drawCharts);

function renderRecords() {
  const filter = $("filter").value.toLowerCase();
  const reports = [...(report ? [report] : []), ...sessions.map(s => s.report).filter(r => r !== report)];
  const rows = reports.flatMap(r => r.candidates.flatMap((c, i) => {
    const label = (r.observation.target || r.observation.file) + " · " + c.classification;
    if (!label.toLowerCase().includes(filter)) return [];
    const row = text("div", "", "record"), button = text("button", "Inspect");
    button.addEventListener("click", () => { render(r, i); location.hash = "investigation"; });
    row.append(text("p", label + " · " + c.period_days.toFixed(5) + " days"), button);
    return [row];
  }));
  $("records").replaceChildren(...(rows.length ? rows : [text("p", "No candidate records match.")]));
}

function renderSessions() {
  const rows = sessions.map(session => {
    const row = text("div", "", "record"), open = text("button", "Restore");
    open.addEventListener("click", () => {
      render(session.report); status("workspace-status", "Restored " + session.report.observation.file + ".");
    });
    row.append(text("p", session.report.observation.file + " · " + new Date(session.saved).toLocaleString()), open);
    return row;
  });
  $("sessions").replaceChildren(...(rows.length ? rows : [text("p", "No saved sessions.")]));
  renderRecords();
}
$("filter").addEventListener("input", renderRecords);
$("save").addEventListener("click", () => {
  const next = [{ saved: new Date().toISOString(), report }, ...sessions.filter(s => s.report !== report)].slice(0, 5);
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    sessions = next; renderSessions(); status("workspace-status", "Analysis saved.");
  } catch { status("workspace-status", "Browser storage is full or unavailable. Export the report instead.", true); }
});
$("export").addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  link.download = "astrolens-analysis.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
renderSessions();
view();
