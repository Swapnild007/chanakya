/* AstroLens focused workspace router. Distinct exoplanet and analysis workspaces. */
(() => {
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const main=$(".main-content"), sidebar=$("#sidebar"), menu=$("#mobileMenu");
 const links=$$(".sidebar .nav-link, .bottom-dock a");
 const modules={
  sky:["Sky Explorer","Browse the sky by coordinates, constellation or object name.","CATALOGUE VIEW","A live sky-position renderer is not connected yet. Use Discover to resolve named targets against public catalogues."],
  solar:["Solar System","Planetary bodies, moons, small bodies and mission observations.","IN DEVELOPMENT","A live ephemeris and mission-data module is not connected yet. No positions or orbital values are fabricated."],
  stars:["Stars & Galaxies","Resolve stellar and extragalactic targets with source-traceable catalogue records.","CATALOGUE WORKSPACE","This workspace is reserved for stellar and galaxy records. Use Discover for the current multi-archive resolver while dedicated target-class filters are being connected."],
  transients:["Transients","Explore time-domain events and follow-up observations.","IN DEVELOPMENT","A verified transient feed and event cross-match pipeline are not connected yet."],
  spectra:["Spectra","Inspect measured spectra, identify lines and calculate redshift with uncertainty.","IN DEVELOPMENT","Spectral analysis requires an uploaded spectrum or connected public spectral archive. No sample spectrum is presented as real data."],
  images:["Astronomy Images","Explore image products with telescope, instrument, filter and provenance metadata.","IN DEVELOPMENT","A searchable image archive viewer is not connected yet. The artwork on Home is decorative, not scientific observation data."]
 };
 const keys={
  home:{show:["#overview","#moduleSection",".metrics","#researchCockpit"],title:"Home"},
  discover:{show:["#explorer"],title:"Discover"},
  sky:{show:["#moduleDetailView"],title:"Sky Explorer",module:"sky"},
  solar:{show:["#moduleDetailView"],title:"Solar System",module:"solar"},
  exoplanets:{show:["#exoplanetWorkspace"],title:"Exoplanets"},
  stars:{show:["#moduleDetailView"],title:"Stars & Galaxies",module:"stars"},
  transients:{show:["#moduleDetailView"],title:"Transients",module:"transients"},
  spectra:{show:["#moduleDetailView"],title:"Spectra",module:"spectra"},
  images:{show:["#moduleDetailView"],title:"Images",module:"images"},
  analysis:{show:["#analysisWorkspace"],title:"Analysis Lab"},
  reports:{show:["#method"],title:"Reports & Methods"}
 };
 function keyFor(a){
  const t=(a.textContent||"").trim().toLowerCase();
  if(t.includes("home"))return "home";
  if(t.includes("discover"))return "discover";
  if(t.includes("sky"))return "sky";
  if(t.includes("solar"))return "solar";
  if(t.includes("exoplanet"))return "exoplanets";
  if(t.includes("stars"))return "stars";
  if(t.includes("transient"))return "transients";
  if(t.includes("spectra"))return "spectra";
  if(t.includes("image"))return "images";
  if(t.includes("analysis")||t.includes("lab"))return "analysis";
  if(t.includes("report")||t.includes("method"))return "reports";
  return "home";
 }
 function ensureWorkspace(){
  if(!main)return;
  let exo=$("#exoplanetWorkspace");
  if(!exo){exo=document.createElement("section");exo.id="exoplanetWorkspace";exo.className="dedicated-workspace";exo.innerHTML='<div class="eyebrow"><span class="eyebrow-line"></span> EXOPLANET OBSERVATIONS</div><h1>Exoplanet Lab</h1><p class="workspace-lead">Retrieve a real TESS light curve, inspect measured flux and screen for periodic transit-like signals. Screening is not planet confirmation.</p>';const grid=$(".analysis-grid");if(grid){grid.parentNode.insertBefore(exo,grid);const lab=$("#dataLab");if(lab)exo.appendChild(lab);}}
  let analysis=$("#analysisWorkspace");
  if(!analysis){analysis=document.createElement("section");analysis.id="analysisWorkspace";analysis.className="dedicated-workspace";analysis.innerHTML='<div class="eyebrow"><span class="eyebrow-line"></span> REPRODUCIBLE ANALYSIS</div><h1>Analysis Lab</h1><p class="workspace-lead">Run the integrated checks on the observation loaded in Exoplanet Lab. The uploaded dataset stays in this browser session; analysis output is a screening report, not a discovery claim.</p><div id="analysisWorkspaceBody"></div>';const method=$("#method");if(method)main.insertBefore(analysis,method);else main.appendChild(analysis);}
  const full=$("#fullAnalysis"), body=$("#analysisWorkspaceBody");if(full&&body&&full.parentElement!==body)body.appendChild(full);
  let detail=$("#moduleDetailView");if(!detail){detail=document.createElement("section");detail.id="moduleDetailView";detail.className="dedicated-workspace";main.appendChild(detail);}
 }
 ensureWorkspace();
 function renderModule(key){
  const el=$("#moduleDetailView"),d=modules[key];if(!el)return;
  if(!d){el.classList.add("workspace-view-hidden");el.innerHTML="";return;}
  el.innerHTML='<div class="eyebrow"><span class="eyebrow-line"></span> ASTROLENS RESEARCH WORKSPACE</div><h1>'+d[0]+'</h1><p class="workspace-lead">'+d[1]+'</p><article class="module-detail-card"><span class="module-detail-status">'+d[2]+'</span><h2>'+d[0]+'</h2><p>'+d[3]+'</p><div class="module-detail-actions"><button type="button" class="primary" data-go-discover>Open Discover →</button><button type="button" class="secondary" data-go-home>Back to Home</button></div></article>';
  el.querySelector("[data-go-discover]")?.addEventListener("click",()=>show("discover"));
  el.querySelector("[data-go-home]")?.addEventListener("click",()=>show("home"));
 }
 function show(key,writeHash=true){
  if(!keys[key])key="home";
  ensureWorkspace();
  const cfg=keys[key], selectors=["#overview","#moduleSection",".metrics","#researchCockpit","#explorer",".analysis-grid","#exoplanetWorkspace","#analysisWorkspace","#method","footer","#moduleDetailView"];
  selectors.forEach(sel=>{const el=$(sel);if(el)el.classList.toggle("workspace-view-hidden",!cfg.show.includes(sel));});
  renderModule(cfg.module);
  links.forEach(a=>{const active=keyFor(a)===key;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  document.body.dataset.workspaceView=key;
  if(writeHash)history.replaceState(null,"","#"+key);
  sidebar?.classList.remove("open");
  if(menu){menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-label","Open navigation");menu.textContent="☰";}
  window.scrollTo({top:0,behavior:"auto"});
 }
 links.forEach(a=>{a.dataset.workspaceView=keyFor(a);a.href="#"+a.dataset.workspaceView;a.addEventListener("click",e=>{e.preventDefault();show(a.dataset.workspaceView);});});
 $$(".module-card").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();show(keyFor(a));}));
 $("[data-open-workspace]").forEach(button=>button.addEventListener("click",()=>show(button.dataset.openWorkspace)));
 $(".brand")?.addEventListener("click",e=>{e.preventDefault();show("home");});
 $("#exploreBtn")?.addEventListener("click",e=>{e.preventDefault();show("discover");});
 $("#uploadDataBtn")?.addEventListener("click",e=>{e.preventDefault();show("exoplanets");});
 const initial=location.hash.slice(1);show(keys[initial]?initial:"home",false);
})();