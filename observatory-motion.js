/* Accessible section reveals and motion preference handling for AstroLens. */
(() => {
  "use strict";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function init(){
    document.documentElement.classList.add("motion-ready");
    const targets = document.querySelectorAll(".metrics,.workspace,.analysis-grid,.method,.astronomy-platform,.astro-domain-card,.panel");
    if(reduce || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      for(const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add("motion-visible");
          observer.unobserve(entry.target);
        }
      }
    }, {rootMargin:"0px 0px -7% 0px",threshold:0.06});
    targets.forEach((el,i)=>{
      el.classList.add("motion-reveal");
      el.style.setProperty("--reveal-delay",String(Math.min(i%4,3)*65)+"ms");
      observer.observe(el);
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();