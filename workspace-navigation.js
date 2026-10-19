/* AstroLens navigation: unique destinations, one active item, no reused home-grid views. */
(() => {
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const main=$(".main-content"), sidebar=$("#sidebar"), menu=$("#mobileMenu");
 const linkEls=$$(".sidebar .nav-link, .bottom-dock a");
 const copy={
  sky:["Sky Explorer","Browse the sky by coordinates, constellation or object name.","CATALOGUE VIEW","Use Discover to resolve a named target against public catalogues. Sky-position plotting is not yet connected to a live astrometric renderer."],
  solar:["Solar System","Planetary bodies, moons, small bodies and mission observations.","IN DEVELOPMENT","A live ephemeris and mission-data module is not connected yet. No positions or orbital values are fabricated."],
  stars:["Stars & Galaxies","Resolve stellar and extragalactic targets with source-traceable catalogue records.","CATALOGUE WORKSPACE","Use the live multi-archive resolver to search SIMBAD, Gaia, VizieR and ESO observation metadata."],
  transients:["Transients","Explore time-domain events and follow-up observations.","IN DEVELOPMENT","A verified transient feed and event cross-match pipeline are not connected yet."],
  spectra:["Spectra","Inspect measured spectra, identify lines and calculate redshift with uncertainty.","IN DEVELOPMENT","Spectral analysis needs an uploaded spectrum or a connected public spectral archive. No sample spectrum is presented as real data."],
  images:["Astronomy Images","Explore image products with telescope, instrument, filter and provenance metadata.","IN DEVELOPMENT","A searchable image archive viewer is not connected yet. The decorative artwork on Home is not scientific observation data."]
 };
 let current="home";
 const keys={
  home:{show:["#overview","#moduleSection",".metrics"],title:"Home"},
  discover:{show:["#explorer"],title:"Discover"},
  sky:{show:[],title:copy.sky[0],panel:"sky"},
  solar:{show:[],title:copy.solar[0],panel:"solar"},
  exoplanets:{show:[".analysis-grid"],title:"Exoplanets"},
  stars:{show:["#explorer"],title:copy.stars[0]},
  transients:{show:[],title:copy.transients[0],panel:"transients"},
  spectra:{show:[],title:copy.spectra[0],panel:"spectra"},
  images:{show:[],title:copy.images[0],panel:"images"},
  analysis:{show:[".analysis-grid"],title:"Analysis Lab"},
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
 let panel=$("#moduleDetailView");
 if(!panel&&main){panel=document.createElement("section");panel.id="moduleDetailView";panel.className="module-detail-view workspace-view-hidden";main.appendChild(panel);}
 function renderPanel(key){
  if(!panel)return;
  const d=copy[key]; if(!d){panel.classList.add("workspace-view-hidden");panel.innerHTML="";return;}
  const isDev=d[2]==="IN DEVELOPMENT";
  panel.innerHTML='<div class="eyebrow"><span class="eyebrow-line"></span> ASTROLENS RESEARCH WORKSPACE</div><h1>'+d[0]+'</h1><p class="module-detail-lead">'+d[1]+'</p><div class="module-detail-card"><span class="module-detail-status">'+d[2]+'</span><h2>'+d[0]+'</h2><p>'+d[3]+'</p><div class="module-detail-actions"><button type="button" class="primary" data-go-discover>Open Discover <span>→</span></button><button type="button" class="secondary" data-go-home>Back to Home</button></div></div>';
  panel.querySelector("[data-go-discover]")?.addEventListener("click",()=>show("discover"));
  panel.querySelector("[data-go-home]")?.addEventListener("click",()=>show("home"));
  panel.classList.remove("workspace-view-hidden");
 }
 function show(key,writeHash=true){
  if(!keys[key])key="home";current=key;
  const selectors=["#overview","#moduleSection",".metrics","#explorer",".analysis-grid","#method","footer","#moduleDetailView"];
  selectors.forEach(sel=>{const el=$(sel);if(el)el.classList.toggle("workspace-view-hidden",!keys[key].show.includes(sel)&&!(sel==="#moduleDetailView"&&!!keys[key].panel));});
  renderPanel(keys[key].panel);
  linkEls.forEach(a=>{const active=keyFor(a)===key;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  document.body.dataset.workspaceView=key;
  if(writeHash)history.replaceState(null,"","#"+key);
  sidebar?.classList.remove("open");
  if(menu){menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-label","Open navigation");menu.textContent="☰";}
  window.scrollTo({top:0,behavior:"auto"});
 }
 linkEls.forEach(a=>{a.dataset.workspaceView=keyFor(a);a.href="#"+a.dataset.workspaceView;a.addEventListener("click",e=>{e.preventDefault();show(a.dataset.workspaceView);});});
 $$(".module-card").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();show(keyFor(a));}));
 $(".brand")?.addEventListener("click",e=>{e.preventDefault();show("home");});
 $("#exploreBtn")?.addEventListener("click",e=>{e.preventDefault();show("discover");});
 $("#uploadDataBtn")?.addEventListener("click",e=>{e.preventDefault();show("exoplanets");});
 const observer=new MutationObserver(()=>{const active=linkEls.filter(a=>a.classList.contains("active"));const expected=linkEls.filter(a=>keyFor(a)===current);const keep=expected[0];if(!keep)return;active.forEach(a=>{if(a!==keep)a.classList.remove("active")});if(!keep.classList.contains("active"))keep.classList.add("active");});
 linkEls.forEach(a=>new MutationObserver(()=>{const expected=linkEls.filter(x=>keyFor(x)===current)[0];if(expected&&a!==expected&&a.classList.contains("active"))a.classList.remove("active")}).observe(a,{attributes:true,attributeFilter:["class"]}));
 const initial=location.hash.slice(1);show(keys[initial]?initial:"home",false);
})();