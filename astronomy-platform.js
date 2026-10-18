/* AstroLens Astronomy Platform: domain registry and workspace entry point.
 * This layer expands navigation without pretending every domain already has a validated solver.
 */
(() => {
  "use strict";
  const domains = [
    {id:"cosmology",n:"01",title:"Universe & Cosmology",desc:"Cosmic expansion, large-scale structure, dark matter, dark energy, the cosmic microwave background and gravitational lensing.",methods:["Cosmological parameters","Galaxy surveys","Lens candidates"],sources:[["NASA/IPAC Extragalactic Database","https://ned.ipac.caltech.edu/"],["ESA Planck Archive","https://pla.esac.esa.int/"]],status:"catalogue-and-research"},
    {id:"stars-exoplanets",n:"02",title:"Stars & Exoplanets",desc:"Stellar properties, transit photometry, radial-velocity signals, variable stars, candidate vetting and false-positive analysis.",methods:["Light curves","BLS search","Transit modelling"],sources:[["NASA Exoplanet Archive","https://exoplanetarchive.ipac.caltech.edu/"],["MAST","https://mast.stsci.edu/"]],status:"existing-module"},
    {id:"solar-system",n:"03",title:"Solar System & Planetary Science",desc:"Planets, moons, asteroids, comets, orbital mechanics, planetary atmospheres and near-Earth objects.",methods:["Orbit propagation","Ephemerides","Small-body tracking"],sources:[["JPL Horizons","https://ssd.jpl.nasa.gov/horizons/"],["NASA PDS","https://pds.nasa.gov/"]],status:"planned"},
    {id:"solar-space-weather",n:"04",title:"Solar Physics & Space Weather",desc:"Solar activity, flares, coronal mass ejections, heliophysics and geomagnetic-storm observations.",methods:["Solar image analysis","Event timelines","Space-weather indices"],sources:[["NASA Heliophysics","https://science.nasa.gov/heliophysics/"],["NASA DONKI","https://kauai.ccmc.gsfc.nasa.gov/DONKI/"]],status:"planned"},
    {id:"high-energy",n:"05",title:"Galaxies & High-Energy Astrophysics",desc:"Nebulae, supernovae, black holes, neutron stars, pulsars, gamma-ray bursts and accretion phenomena.",methods:["Transient analysis","Spectral fitting","Multiwavelength matching"],sources:[["HEASARC","https://heasarc.gsfc.nasa.gov/"],["NASA ADS","https://ui.adsabs.harvard.edu/"]],status:"planned"},
    {id:"observations",n:"06",title:"Observational Astronomy",desc:"Optical, infrared, radio, ultraviolet, X-ray and gamma-ray observations; image processing, photometry and spectroscopy.",methods:["FITS inspection","Image photometry","Spectral analysis"],sources:[["MAST","https://mast.stsci.edu/"],["NOIRLab Astro Data Lab","https://datalab.noirlab.edu/"],["IRSA","https://irsa.ipac.caltech.edu/"]],status:"planned"},
    {id:"gravitational",n:"07",title:"Gravitational & Multi-messenger Astronomy",desc:"Gravitational waves, compact-object mergers, lensing and coordinated electromagnetic/neutrino follow-up.",methods:["Time-series search","Event cross-match","Alert provenance"],sources:[["LIGO Open Science Center","https://gwosc.org/"],["NASA HEASARC","https://heasarc.gsfc.nasa.gov/"]],status:"planned"},
    {id:"research-lab",n:"08",title:"Research Lab & Scientific Computing",desc:"Reproducible analyses, uncertainty propagation, simulations, model comparison, benchmarks and research reports.",methods:["Data provenance","Synthetic controls","Regression benchmarks"],sources:[["Astropy","https://www.astropy.org/"],["NASA Open Science","https://science.nasa.gov/open-science/"]],status:"shared-foundation"}
  ];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function init(){
    const main = document.querySelector("main.main-content");
    if(!main || document.getElementById("astronomyPlatform")) return;
    const section = document.createElement("section");
    section.id = "astronomyPlatform";
    section.className = "astronomy-platform";
    section.innerHTML = `
      <div class="section-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> THE WIDER UNIVERSE</div><h2>Astronomy, end to end<span class="heading-period">.</span></h2><p class="section-description">One research workspace across the major astronomy disciplines. Every module states what is implemented, what is planned, and which source supports its data.</p></div></div>
      <div class="astro-platform-banner"><div><strong>One scientific foundation.</strong><p>Traceable data · explicit uncertainty · reproducible calculations · no unsupported discovery claims.</p></div><span class="astro-platform-badge">8 RESEARCH DOMAINS</span></div>
      <div class="astro-domain-grid">${domains.map(d=>`<article class="astro-domain-card" id="domain-${d.id}"><div class="astro-domain-top"><span class="astro-domain-number">${d.n}</span><span class="astro-domain-state state-${d.status}">${d.status==="existing-module"?"EXISTING MODULE":d.status==="shared-foundation"?"FOUNDATION":d.status==="catalogue-and-research"?"RESEARCH":"PLANNED"}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.desc)}</p><div class="astro-domain-methods">${d.methods.map(m=>`<span>${esc(m)}</span>`).join("")}</div><div class="astro-domain-links">${d.sources.map(s=>`<a href="${esc(s[1])}" target="_blank" rel="noopener noreferrer">${esc(s[0])} ↗</a>`).join("")}</div></article>`).join("")}</div>
      <p class="astro-platform-footnote">Scope honesty: domain cards and source links are available now. A card marked PLANNED is not a claim that its scientific solver or live data connector has been implemented. Each module must pass domain-specific benchmark tests before its outputs are presented as scientific results.</p>`;
    main.appendChild(section);
    const sidebar = document.getElementById("sidebar");
    if(sidebar && !sidebar.querySelector('[href="#astronomyPlatform"]')){
      const link=document.createElement("a"); link.className="nav-link"; link.href="#astronomyPlatform"; link.innerHTML="<span>✧</span> Astronomy domains";
      const anchor=sidebar.querySelector('[href="#method"]');
      if(anchor) anchor.insertAdjacentElement("afterend",link); else sidebar.insertBefore(link,sidebar.firstChild);
    }
    document.querySelectorAll('.nav-link[href="#astronomyPlatform"]').forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(n=>n.classList.remove("active"));a.classList.add("active");}));
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
  window.AstroLensAstronomyPlatform = Object.freeze({domains:domains.map(d=>({...d,sources:d.sources.map(s=>[...s]),methods:[...d.methods]})),domainCount:domains.length});
})();