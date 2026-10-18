/* AstroLens workspace navigation: each menu item opens a focused tool view. */
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const views = {
    overview: {title:"Overview", show:[".hero",".metrics",".workspace"]},
    discover: {title:"Discover", show:[".workspace"]},
    explorer: {title:"Data Explorer", show:[".analysis-grid"], mode:"data"},
    lightcurve: {title:"Light Curve Lab", show:[".analysis-grid"], mode:"lightcurve"},
    analysis: {title:"AI Analysis", show:[".analysis-grid"], mode:"analysis"},
    known: {title:"Known Objects", show:[".workspace"], mode:"known"},
    reports: {title:"Reports & Methods", show:["#method","#commandPanels"], mode:"reports"},
    sky: {title:"Sky Map & Reports", show:[".analysis-grid"], mode:"sky"}
  };
  let current="overview";
  const main=$(".main-content");
  const allTop=[".hero",".metrics",".workspace",".analysis-grid","#commandPanels","#method","footer"];
  function visible(el,on){if(el)el.classList.toggle("workspace-view-hidden",!on)}
  function infer(label){
    const t=label.toLowerCase();
    if(t.includes("overview")||t.includes("home"))return "overview";
    if(t.includes("discover"))return "discover";
    if(t.includes("data explorer"))return "explorer";
    if(t.includes("light curve"))return "lightcurve";
    if(t.includes("ai analysis")||t.includes("analysis"))return "analysis";
    if(t.includes("known"))return "known";
    if(t.includes("sky map"))return "sky";
    if(t.includes("report")||t.includes("method"))return "reports";
    return "overview";
  }
  function setView(key,updateHash=true){
    if(!views[key])key="overview";
    current=key;
    document.body.dataset.workspaceView=key;
    const cfg=views[key];
    allTop.forEach(sel=>visible($(sel),cfg.show.includes(sel)));
    const lab=$("#dataLab"), curve=lab?.querySelector(".curve-visual"), mast=lab?.querySelector(".mast-import"),
      upload=lab?.querySelector(".upload-row"), scan=lab?.querySelector("#scanStatus"),
      scanResults=lab?.querySelector("#scanResults"), bls=lab?.querySelector(".bls-tools"),
      full=lab?.querySelector("#fullAnalysis"), panelHead=lab?.querySelector(".panel-head"),
      dossier=lab?.querySelector(".detail-panel"), skyPanel=$(".analysis-grid > .command-panel");
    [curve,mast,upload,scan,scanResults,bls,full,panelHead,dossier].forEach(el=>visible(el,true));
    visible(skyPanel,cfg.mode==="sky");
    if(cfg.mode==="data"){
      [curve,upload,scan,scanResults,bls,full,dossier].forEach(el=>visible(el,false));
      const h=panelHead?.querySelector("h2");if(h)h.textContent="Data Explorer";
    }else if(cfg.mode==="lightcurve"){
      visible(full,false);
      const h=panelHead?.querySelector("h2");if(h)h.textContent="Light Curve Lab";
    }else if(cfg.mode==="analysis"){
      [curve,mast,upload,scan,scanResults,bls,dossier].forEach(el=>visible(el,false));
      const h=panelHead?.querySelector("h2");if(h)h.textContent="AI Analysis";
      visible(full,true);
    }else if(cfg.mode==="sky"){
      [curve,mast,upload,scan,scanResults,bls,full,panelHead,dossier].forEach(el=>visible(el,false));
    }else{
      const h=panelHead?.querySelector("h2");if(h)h.textContent="Light Curve Lab";
    }
    const command=$("#commandPanels");
    if(command){
      const cards=$(".command-panel",command);
      cards.forEach(el=>visible(el,cfg.mode==="reports"));
    }
    $$(".sidebar .nav-link").forEach(a=>{
      const k=a.dataset.workspaceView||infer(a.textContent);
      a.classList.toggle("active",k===key);
      if(k===key)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");
    });
    $(".mobile-dock a").forEach(a=>{
      const k=a.dataset.workspaceView||infer(a.textContent);
      a.classList.toggle("active",k===key);
    });
    requestAnimationFrame(positionLiquid);
    const title=$("#workspaceViewTitle");if(title)title.textContent=cfg.title;
    if(updateHash)history.replaceState(null,"","#"+key);
    const side=$("#sidebar"),menu=$("#mobileMenu");
    side?.classList.remove("open");if(menu)menu.setAttribute("aria-expanded","false");
    window.scrollTo({top:0,behavior:"auto"});
  }
  function positionLiquid(){
    const dock=$(".mobile-dock"), indicator=$(".mobile-dock .liquid-indicator");
    if(!dock||!indicator)return;
    const active=$(".mobile-dock a.active",dock);
    if(!active)return;
    const dr=dock.getBoundingClientRect(), ar=active.getBoundingClientRect();
    indicator.style.width=ar.width+"px";
    indicator.style.transform="translateX("+(ar.left-dr.left-6)+"px)";
    dock.classList.add("ready");
  }
  function bindNav(){
    $(".sidebar .nav-link, .mobile-dock a").forEach(a=>{
      if(a.dataset.navBound==="true")return;
      a.dataset.navBound="true";
      const key=a.dataset.workspaceView||infer(a.textContent);a.dataset.workspaceView=key;a.href="#"+key;
      a.addEventListener("click",e=>{e.preventDefault();setView(key)});
    });
    const brand=$(".brand");if(brand)brand.addEventListener("click",e=>{e.preventDefault();setView("overview")});
    const demo=$("#demoBtn");if(demo)demo.addEventListener("click",e=>{e.preventDefault();setView("lightcurve")});
    const explore=$("#exploreBtn");if(explore)explore.addEventListener("click",()=>setView("known"));
    const openAnalysis=$("#openFullAnalysis");if(openAnalysis)openAnalysis.addEventListener("click",()=>setView("analysis"));
  }
  function boot(){
    if(!main)return;
    const title=document.createElement("div");title.id="workspaceViewTitle";title.className="workspace-view-title";title.setAttribute("aria-live","polite");main.prepend(title);
    bindNav();
    const hash=location.hash.slice(1);setView(views[hash]?hash:"overview",false);
    const observer=new MutationObserver(()=>{if(current==="analysis"&&$("#fullAnalysis"))setView("analysis",false)});
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("resize",positionLiquid);
    const dockObserver=new MutationObserver(()=>{bindNav();positionLiquid()});
    dockObserver.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("hashchange",()=>{const key=location.hash.slice(1);if(views[key])setView(key,false)});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
