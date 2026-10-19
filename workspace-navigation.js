/* AstroLens focused workspace router. Distinct exoplanet and analysis workspaces. */
(() => {
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const main=$(".main-content"), sidebar=$("#sidebar"), menu=$("#mobileMenu");
 const links=$$(".sidebar .nav-link, .bottom-dock a");
 const modules={
  sky:["Sky Explorer","Explore celestial coordinates and resolve named targets without leaving AstroLens.","INTERACTIVE SKY WORKSPACE",""],
  solar:["Solar System","Planetary bodies, moons, small bodies and mission observations.","IN DEVELOPMENT","A live ephemeris and mission-data module is not connected yet. No positions or orbital values are fabricated."],
  stars:["Stars & Galaxies","Resolve stellar and extragalactic targets with source-traceable catalogue records.","CATALOGUE WORKSPACE","This workspace is reserved for stellar and galaxy records. Use Discover for the current multi-archive resolver while dedicated target-class filters are being connected."],
  transients:["Transients","Explore time-domain events and follow-up observations.","IN DEVELOPMENT","A verified transient feed and event cross-match pipeline are not connected yet."],
  spectra:["Spectra","Inspect measured spectra, identify lines and calculate redshift with uncertainty.","IN DEVELOPMENT","Spectral analysis requires an uploaded spectrum or connected public spectral archive. No sample spectrum is presented as real data."],
  images:["Astronomy Images","Explore image products with telescope, instrument, filter and provenance metadata.","IN DEVELOPMENT","A searchable image archive viewer is not connected yet. The artwork on Home is decorative, not scientific observation data."]
 };
 const keys={
  home:{show:["#overview","#moduleSection",".metrics","#researchPipeline","#researchCockpit"],title:"Home"},
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
  if(key==="sky"){
   el.innerHTML='<div class="eyebrow"><span class="eyebrow-line"></span> ASTROLENS RESEARCH WORKSPACE</div><h1>Sky Explorer</h1><p class="workspace-lead">Search a target or enter coordinates. Results stay here, inside AstroLens.</p><section class="sky-workspace-panel"><div class="sky-query-row"><label>Object name<input id="skyTargetInput" type="search" placeholder="e.g. M31, Sirius, Vega" value="M31"></label><button type="button" class="primary" id="skyResolveBtn">Resolve target</button></div><div class="sky-query-row sky-coordinates"><label>Right ascension (degrees)<input id="skyRaInput" type="number" min="0" max="360" step="any" placeholder="10.6847"></label><label>Declination (degrees)<input id="skyDecInput" type="number" min="-90" max="90" step="any" placeholder="41.2688"></label><button type="button" class="secondary" id="skyPlotBtn">Plot coordinates</button></div><p id="skyStatus" class="status-message" role="status">Try M31 or enter RA/Dec in decimal degrees. Coordinate plotting works locally; name resolution uses a public astronomy service.</p><div id="skyResult" class="sky-result"><div class="sky-map" id="skyMap" role="img" aria-label="Sky coordinate plot waiting for target"><span class="sky-map-grid"></span><span class="sky-map-crosshair"></span><span class="sky-map-center">NO TARGET</span></div><div class="sky-result-meta"><span class="module-detail-status">WAITING FOR TARGET</span><h2 id="skyObjectName">No object selected</h2><p id="skyObjectCoords">Enter a name or coordinates to begin.</p><p class="sky-source-note" id="skySourceNote">No source has been queried yet.</p></div></div></section>';
   const target=el.querySelector("#skyTargetInput"),ra=el.querySelector("#skyRaInput"),dec=el.querySelector("#skyDecInput"),status=el.querySelector("#skyStatus");
   const paint=(name,r,d,source)=>{const map=el.querySelector("#skyMap");map.classList.add("has-target");map.style.setProperty("--target-x",(Number(r)/360*100)+"%");map.style.setProperty("--target-y",((90-Number(d))/180*100)+"%");el.querySelector("#skyMap .sky-map-center").textContent=Number(r).toFixed(4)+"°, "+Number(d).toFixed(4)+"°";el.querySelector("#skyObjectName").textContent=name;el.querySelector("#skyObjectCoords").textContent="RA "+Number(r).toFixed(6)+"° · Dec "+Number(d).toFixed(6)+"°";el.querySelector("#skySourceNote").textContent=source;el.querySelector(".sky-result-meta .module-detail-status").textContent="COORDINATES AVAILABLE";};
   const plot=()=>{const r=Number(ra.value),d=Number(dec.value);if(ra.value===""||dec.value===""||!Number.isFinite(r)||!Number.isFinite(d)||r<0||r>360||d< -90||d>90){status.textContent="Enter RA from 0 to 360° and Dec from −90 to +90°.";return;}paint(target.value.trim()||"User-supplied coordinate",r,d,"Source: user-entered coordinates. No catalogue identity is implied.");status.textContent="Coordinate plotted locally. The marker is a coordinate visualization, not an image of the sky.";};
   el.querySelector("#skyPlotBtn").addEventListener("click",plot);
   const resolve=async()=>{const q=target.value.trim();if(!q){status.textContent="Enter an object name first.";return;}const btn=el.querySelector("#skyResolveBtn");btn.disabled=true;status.textContent="Resolving "+q+" against CDS Sesame…";try{const url="https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?"+encodeURIComponent(q);const res=await fetch(url,{headers:{Accept:"text/plain"}});if(!res.ok)throw Error("Resolver returned HTTP "+res.status);const body=await res.text();const match=body.match(/%J\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);if(!match)throw Error("No decimal-degree coordinates were returned for this name.");const r=Number(match[1]),d=Number(match[2]);ra.value=r;dec.value=d;paint(q,r,d,"Source: CDS Sesame name resolver. Verify object identity against a source catalogue.");status.textContent="Target resolved by the public CDS Sesame service. The marker is a coordinate plot, not an observed image.";}catch(e){status.textContent="Could not resolve this name ("+e.message+"). You can still enter RA/Dec manually and plot locally.";}finally{btn.disabled=false;}};
   el.querySelector("#skyResolveBtn").addEventListener("click",resolve);target.addEventListener("keydown",e=>{if(e.key==="Enter")resolve();});ra.addEventListener("keydown",e=>{if(e.key==="Enter")plot();});dec.addEventListener("keydown",e=>{if(e.key==="Enter")plot();});
   return;
  }
  el.innerHTML='<div class="eyebrow"><span class="eyebrow-line"></span> ASTROLENS RESEARCH WORKSPACE</div><h1>'+d[0]+'</h1><p class="workspace-lead">'+d[1]+'</p><article class="module-detail-card"><span class="module-detail-status">'+d[2]+'</span><h2>'+d[0]+'</h2><p>'+d[3]+'</p><div class="module-detail-actions"><button type="button" class="primary" data-go-discover>Open Discover →</button><button type="button" class="secondary" data-go-home>Back to Home</button></div></article>';
  el.querySelector("[data-go-discover]")?.addEventListener("click",()=>show("discover"));
  el.querySelector("[data-go-home]")?.addEventListener("click",()=>show("home"));
 }
 function show(key,writeHash=true){
  if(!keys[key])key="home";
  ensureWorkspace();
  const cfg=keys[key], selectors=["#overview","#moduleSection",".metrics","#researchPipeline","#researchCockpit","#explorer",".analysis-grid","#exoplanetWorkspace","#analysisWorkspace","#method","footer","#moduleDetailView"];
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