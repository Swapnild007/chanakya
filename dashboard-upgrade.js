/* Evidence report panel. No synthetic sky positions or decorative candidate imagery. */
(() => {
  const $=s=>document.querySelector(s);
  const style=document.createElement("link");style.rel="stylesheet";style.href="dashboard-upgrade.css?v=command-center-6";document.head.appendChild(style);
  const nav=document.querySelector(".sidebar");
  if(nav&&!document.querySelector('[data-nav-extra="reports"]')){
    const item=document.createElement("a");item.className="nav-link";item.href="#commandPanels";item.dataset.navExtra="reports";item.innerHTML="<span>▦</span> Reports & Validation";
    const anchor=nav.querySelector(".sidebar-bottom");if(anchor)nav.insertBefore(item,anchor);
  }
  const section=document.createElement("section");section.id="commandPanels";section.className="command-panels command-reports";
  section.innerHTML=`
    <article class="command-panel">
      <div class="command-panel-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> RESEARCH DESK</div><h2>Reports & validation queue</h2><p>Only evidence computed from the current dataset is reported here. Unavailable checks stay marked unavailable.</p></div><span class="panel-tag">EVIDENCE LOG</span></div>
      <div class="report-list" id="reportList">
        <div class="report-row"><span class="report-bullet">↗</span><div><b>Source provenance</b><small>Archive records retain their source; no synthetic candidate detections are preloaded.</small></div><span class="report-status">READY</span></div>
        <div class="report-row"><span class="report-bullet">⌁</span><div><b>Period search</b><small>Run analysis on a real FITS or CSV light curve.</small></div><span class="report-status">READY</span></div>
        <div class="report-row"><span class="report-bullet">◇</span><div><b>Centroid / pixel vetting</b><small>Requires target-pixel files; unavailable from light-curve-only CSV.</small></div><span class="report-status">UNAVAILABLE</span></div>
        <div class="report-row"><span class="report-bullet">✓</span><div><b>Planet confirmation</b><small>Requires independent validation and supporting observations.</small></div><span class="report-status">NOT CLAIMED</span></div>
      </div>
      <div class="command-actions"><button id="openFullAnalysis">Open full analysis</button><button id="exportCurrentResults">Export catalogue list</button></div>
    </article>`;
  const main=$(".main-content"),grid=$(".analysis-grid");if(main&&grid)main.insertBefore(section,grid.nextSibling);
  $("#openFullAnalysis")?.addEventListener("click",()=>$("#fullAnalysis")?.scrollIntoView({behavior:"smooth",block:"start"}));
  $("#exportCurrentResults")?.addEventListener("click",()=>{const data={note:"Export contains catalogue records currently displayed. It does not represent newly discovered planets.",generatedAt:new Date().toISOString(),candidates:(typeof candidates!=="undefined"?candidates:[]).map(c=>({id:c.id,name:c.name,source:c.sourceLabel||"Catalogue",period:c.period,score:c.score,reason:c.reason,sourceUrl:c.sourceUrl||null}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="astrolens-catalogue-list.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const live=$("#liveBtn");if(live)live.addEventListener("click",()=>setTimeout(()=>{const rows=document.querySelectorAll("#candidateList .candidate"),list=$("#reportList");if(list&&rows.length){const row=document.createElement("div");row.className="report-row";row.innerHTML='<span class="report-bullet">↻</span><div><b>Live NASA TOI catalogue</b><small>'+rows.length+' catalogue records are currently displayed. TOIs are candidates, not confirmations.</small></div><span class="report-status">LOADED</span>';list.prepend(row);}},1500));
})();
/* Final interaction pass: mobile search, compact dock, accessible nav state, and image fallbacks. */
(() => {
 const $ = s => document.querySelector(s);
 const menu = $("#mobileMenu"), sidebar = $("#sidebar");
 if (menu && sidebar) {
   const syncMenu = () => menu.setAttribute("aria-expanded", String(sidebar.classList.contains("open")));
   syncMenu();
   menu.addEventListener("click", syncMenu);
   document.querySelectorAll(".sidebar .nav-link").forEach(link => link.addEventListener("click", () => {
     sidebar.classList.remove("open"); syncMenu();
   }));
   document.addEventListener("click", e => {
     if (window.innerWidth <= 1050 && sidebar.classList.contains("open") && !sidebar.contains(e.target) && !menu.contains(e.target)) {
       sidebar.classList.remove("open"); syncMenu();
     }
   });
 }
 const search = $(".top-search"), input = $("#searchInput");
 if (search && input) {
   search.addEventListener("click", e => {
     if (window.innerWidth > 1050 || e.target === input) return;
     e.preventDefault();
     search.classList.add("search-open");
     input.style.display = "block";
     input.focus();
   });
   input.addEventListener("blur", () => {
     if (window.innerWidth <= 1050 && !input.value.trim()) {
       search.classList.remove("search-open");
       input.style.display = "";
     }
   });
   document.addEventListener("keydown", e => {
     if (e.key === "Escape") {
       search.classList.remove("search-open");
       input.style.display = "";
       input.blur();
     }
   });
 }
 const main = $(".main-content");
 if (main && !$(".mobile-dock")) {
   const dock = document.createElement("nav");
   dock.className = "mobile-dock";
   dock.setAttribute("aria-label", "Quick navigation");
   dock.innerHTML = '<span class="liquid-indicator" aria-hidden="true"></span><a href="#overview" data-workspace-view="overview" class="active" aria-label="Overview"><span>⌂</span>Home</a><a href="#discover" data-workspace-view="discover" aria-label="Discover"><span>⌕</span>Discover</a><a href="#lightcurve" data-workspace-view="lightcurve" aria-label="Light Curve Lab"><span>⌁</span>Light curve</a><a href="#reports" data-workspace-view="reports" aria-label="Reports and Methods"><span>▦</span>Reports</a>';
   document.body.appendChild(dock);
   dock.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
     dock.querySelectorAll("a").forEach(item => item.classList.toggle("active", item === link));
   }));
 }
})();
