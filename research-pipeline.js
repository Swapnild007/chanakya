/* AstroLens research pipeline state bridge.
   Status labels are derived from real actions/results in this browser session. */
(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const stages = {
    ingest: $('[data-stage="ingest"]'),
    quality: $('[data-stage="quality"]'),
    search: $('[data-stage="search"]'),
    review: $('[data-stage="review"]')
  };
  const state = { data:false, quality:false, search:false, review:false, dataLabel:"No dataset", qualityLabel:"Not run", searchLabel:"Not run", reviewLabel:"No report" };
  const labels = {
    ingest: $("#pipelineDataCount"),
    quality: $("#pipelineQualityCount"),
    search: $("#pipelineSearchCount"),
    review: $("#pipelineReviewCount")
  };
  function paint(key, done, active) {
    const el = stages[key]; if (!el) return;
    el.classList.toggle("is-complete", !!done);
    el.classList.toggle("is-active", !!active && !done);
    const badge = $(".pipeline-state", el);
    if (badge) badge.textContent = done ? "COMPLETE" : active ? "IN PROGRESS" : "WAITING";
  }
  function render() {
    if (labels.ingest) labels.ingest.textContent = state.dataLabel;
    if (labels.quality) labels.quality.textContent = state.qualityLabel;
    if (labels.search) labels.search.textContent = state.searchLabel;
    if (labels.review) labels.review.textContent = state.reviewLabel;
    paint("ingest", state.data, !state.data);
    paint("quality", state.quality, state.data && !state.quality);
    paint("search", state.search, state.quality && !state.search);
    paint("review", state.review, state.search && !state.review);
    const active = state.data || state.quality || state.search || state.review;
    const run = $("#pipelineRunState");
    if (run) {
      run.innerHTML = "<i></i> " + (state.review ? "REPORT READY FOR REVIEW" : state.search ? "ANALYSIS RESULT AVAILABLE" : state.quality ? "QUALITY CHECK COMPLETED" : state.data ? "DATASET LOADED" : "NO ACTIVE RUN");
      const dot = $("i", run);
      if (dot) dot.style.background = state.review ? "#8ce0b9" : active ? "#70e7df" : "#70849a";
    }
  }
  function go(key) {
    const link = $('.sidebar .nav-link[data-workspace-view="' + key + '"]');
    if (link) { link.click(); return; }
    const fallback = {discover:"#explorer",exoplanets:"#dataLab",analysis:"#fullAnalysis",reports:"#method"};
    if (fallback[key]) $(fallback[key])?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  document.querySelectorAll("[data-pipeline-go]").forEach(button => button.addEventListener("click", () => go(button.dataset.pipelineGo)));
  const file = $("#lightCurveFile");
  file?.addEventListener("change", () => {
    const f = file.files?.[0];
    if (!f) return;
    state.data = true; state.quality = false; state.search = false; state.review = false;
    state.dataLabel = f.name + " · selected";
    state.qualityLabel = "Awaiting scan"; state.searchLabel = "Awaiting BLS"; state.reviewLabel = "No report";
    render();
  });
  const live = $("#liveBtn");
  live?.addEventListener("click", () => {
    const status = $("#statusMessage");
    const observer = new MutationObserver(() => {
      const message = status?.textContent || "";
      if (/Loaded \d+ catalogue records from NASA Exoplanet Archive/i.test(message)) {
        state.data = true; state.dataLabel = $("#candidateCount")?.textContent + " catalogue records";
        render(); observer.disconnect();
      } else if (/Live query failed/i.test(message)) observer.disconnect();
    });
    if (status) observer.observe(status, {childList:true,subtree:true,characterData:true});
  });
  const scanStatus = $("#scanStatus");
  if (scanStatus) new MutationObserver(() => {
    const message = scanStatus.textContent || "";
    if (/Scanned \d+ measurements/i.test(message)) {
      state.data = true; state.quality = true;
      state.dataLabel = /Selected (.+?) \(/.exec($("#mastStatus")?.textContent || "")?.[1] || "Local observation";
      const m = /Scanned (\d+) measurements retained after ([^.]+)/i.exec(message);
      state.qualityLabel = m ? m[1] + " measurements · screened" : "Scan completed";
      state.search = false; state.review = false; state.searchLabel = "Awaiting BLS"; state.reviewLabel = "No report";
      render();
    }
  }).observe(scanStatus, {childList:true,subtree:true,characterData:true});
  const blsResults = $("#blsResults");
  if (blsResults) new MutationObserver(() => {
    if (blsResults.textContent.trim()) {
      state.data = true; state.quality = true; state.search = true;
      state.dataLabel = state.dataLabel === "No dataset" ? "Observation loaded" : state.dataLabel;
      state.searchLabel = "BLS result rendered";
      render();
    }
  }).observe(blsResults, {childList:true,subtree:true,characterData:true});
  const faResults = $("#faResults");
  if (faResults) new MutationObserver(() => {
    if (faResults.textContent.trim()) {
      state.data = true; state.quality = true; state.search = true; state.review = true;
      state.searchLabel = "Full analysis result";
      state.reviewLabel = "Report available · inspect caveats";
      render();
    }
  }).observe(faResults, {childList:true,subtree:true,characterData:true});
  render();
})();