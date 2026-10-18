/* AstroLens command navigation. Uses existing workspaces and controls; no fabricated astronomy data. */
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const commands = [
    {title:"Discover known objects",desc:"Open the catalogue workspace and its live-data controls.",icon:"◎",view:"known",terms:"discover catalogue objects stars planets"},
    {title:"Explore data sources",desc:"Open archive discovery and cross-catalogue lookup.",icon:"⌕",view:"explorer",terms:"archive source data query"},
    {title:"Analyse a light curve",desc:"Import a local CSV or fetch public TESS observations.",icon:"⌁",view:"lightcurve",terms:"light curve tess flux file analysis"},
    {title:"Review scientific methods",desc:"Read validation, evidence and interpretation guidance.",icon:"✳",view:"reports",terms:"methods validation evidence reports"},
    {title:"Open AI analysis",desc:"Review available analysis tools and their limitations.",icon:"◇",view:"analysis",terms:"ai analysis signal"},
    {title:"Return to overview",desc:"Go back to the AstroLens mission overview.",icon:"⌂",view:"overview",terms:"home overview"}
  ];
  function navigate(view){
    const link=$('.sidebar .nav-link[data-workspace-view="'+view+'"]')||$('.mobile-dock a[data-workspace-view="'+view+'"]');
    if(link){link.click();return;}
    const aliases={known:"exploreBtn",lightcurve:"uploadDataBtn",analysis:"openFullAnalysis"};
    const el=aliases[view]?$("#"+aliases[view]):null;
    if(el){el.click();return;}
    const href=view==="reports"?"#method":view==="explorer"?"#explorer":"#overview";
    location.hash=href;
  }
  function boot(){
    const hero=$("#overview");
    if(!hero||$("#missionLauncher"))return;
    const launcher=document.createElement("nav");
    launcher.id="missionLauncher";launcher.className="mission-launcher";launcher.setAttribute("aria-label","Quick launch");
    launcher.innerHTML=[
      ['◎','Discover objects','Open catalogue workspace','known'],
      ['⌁','Analyse observations','Open light-curve tools','lightcurve'],
      ['✳','Methods & evidence','Review scientific standards','reports']
    ].map(([icon,title,desc,view])=>'<button type="button" class="mission-launch" data-view="'+view+'"><span class="mission-launch-icon" aria-hidden="true">'+icon+'</span><span class="mission-launch-copy"><strong>'+title+'</strong><small>'+desc+'</small></span><span class="mission-launch-arrow" aria-hidden="true">↗</span></button>').join("");
    hero.insertAdjacentElement("afterend",launcher);
    launcher.addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)navigate(b.dataset.view);});
    const backdrop=document.createElement("div");backdrop.className="command-backdrop";backdrop.id="commandBackdrop";
    backdrop.innerHTML='<section class="command-deck-panel" role="dialog" aria-modal="true" aria-labelledby="commandLabel"><div class="command-top"><label id="commandLabel" for="commandInput">ASTROLENS COMMAND DECK</label><input id="commandInput" class="command-input" type="search" placeholder="Find a workspace or task…" autocomplete="off"><div class="command-footer"><span>Navigate your observatory</span><span><kbd>ESC</kbd> close</span></div></div><div class="command-results" id="commandResults"></div></section>';
    document.body.appendChild(backdrop);
    const input=$("#commandInput"),results=$("#commandResults");
    function render(q=""){
      const needle=q.trim().toLowerCase();
      const list=commands.filter(c=>(c.title+" "+c.desc+" "+c.terms).toLowerCase().includes(needle));
      results.innerHTML=list.length?list.map((c,i)=>'<button type="button" class="command-option" data-view="'+c.view+'"><span class="command-option-icon" aria-hidden="true">'+c.icon+'</span><span><strong>'+c.title+'</strong><small>'+c.desc+'</small></span><kbd>'+(i+1)+'</kbd></button>').join(""):'<div class="command-empty">No matching workspace. Try “data”, “TESS”, or “methods”.</div>';
    }
    function open(){backdrop.classList.add("open");render(input.value);setTimeout(()=>input.focus(),20);document.body.style.overflow="hidden";}
    function close(){backdrop.classList.remove("open");document.body.style.overflow="";}
    results.addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(!b)return;close();navigate(b.dataset.view);});
    input.addEventListener("input",()=>render(input.value));
    backdrop.addEventListener("click",e=>{if(e.target===backdrop)close();});
    document.addEventListener("keydown",e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();open();}
      if(e.key==="Escape"&&backdrop.classList.contains("open"))close();
      if(backdrop.classList.contains("open")&&/^[1-6]$/.test(e.key)&&document.activeElement===input){const b=$$(".command-option")[Number(e.key)-1];if(b)b.click();}
    });
    const search=$("#searchInput");
    if(search){
      search.setAttribute("placeholder","Search loaded objects…");
      search.setAttribute("aria-keyshortcuts","Control+K Meta+K");
      const label=search.closest("label");
      if(label){label.setAttribute("role","button");label.setAttribute("tabindex","0");label.setAttribute("aria-label","Open command deck, Control or Command K");label.addEventListener("click",e=>{if(e.target!==search)open();});label.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});}
    }
    const archive=$("#liveBtn");if(archive){archive.addEventListener("click",()=>{navigate("explorer");const target=$("#multiSourceDiscovery")||$("#multiSourcePanel");if(target)target.scrollIntoView({behavior:"smooth",block:"start"});});}
  }
  const $$ = (s,root=document) => [...root.querySelectorAll(s)];
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();