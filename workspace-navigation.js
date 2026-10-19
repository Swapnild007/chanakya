/* AstroLens focused workspace navigation. One selected destination and one focused view. */
(() => {
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const views={
  home:{show:["#overview","#moduleSection",".metrics"],label:"Home"},
  discover:{show:["#explorer"],label:"Discover"},
  sky:{show:["#explorer"],label:"Sky Explorer"},
  solar:{show:["#moduleSection"],label:"Solar System"},
  exoplanets:{show:[".analysis-grid"],label:"Exoplanets"},
  stars:{show:["#explorer"],label:"Stars & Galaxies"},
  transients:{show:["#moduleSection"],label:"Transients"},
  spectra:{show:["#moduleSection"],label:"Spectra"},
  images:{show:["#moduleSection"],label:"Images"},
  analysis:{show:[".analysis-grid"],label:"Analysis Lab"},
  reports:{show:["#method"],label:"Reports & Methods"}
 };
 const links=$$(".sidebar .nav-link, .bottom-dock a");
 function keyFor(a){
  if(a.dataset.workspaceView)return a.dataset.workspaceView;
  const t=a.textContent.toLowerCase();
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
 function show(key){
  const cfg=views[key]||views.home;
  const sections=["#overview","#moduleSection",".metrics","#explorer",".analysis-grid","#method","footer"];
  sections.forEach(sel=>{const el=$(sel);if(el)el.classList.toggle("workspace-view-hidden",!cfg.show.includes(sel));});
  links.forEach(a=>{const active=keyFor(a)===key;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  document.body.dataset.workspaceView=key;
  history.replaceState(null,"","#"+key);
  const sidebar=$("#sidebar"),menu=$("#mobileMenu");sidebar?.classList.remove("open");if(menu){menu.setAttribute("aria-expanded","false");menu.textContent="☰";}
  window.scrollTo({top:0,behavior:"auto"});
 }
 links.forEach(a=>{a.dataset.workspaceView=keyFor(a);a.addEventListener("click",e=>{e.preventDefault();show(a.dataset.workspaceView);});});
 $$(".module-card").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();const t=a.textContent.toLowerCase();show(t.includes("exoplanet")?"exoplanets":t.includes("discover")||t.includes("galax")?"discover":t.includes("sky")?"sky":t.includes("solar")?"solar":t.includes("transient")?"transients":t.includes("spectra")?"spectra":t.includes("image")?"images":"reports");}));
 const brand=$(".brand");brand?.addEventListener("click",e=>{e.preventDefault();show("home");});
 const explore=$("#exploreBtn");explore?.addEventListener("click",e=>{e.preventDefault();show("discover");});
 $("#uploadDataBtn")?.addEventListener("click",e=>{e.preventDefault();show("exoplanets");});
 const initial=location.hash.slice(1);show(views[initial]?initial:"home");
})();