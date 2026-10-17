/* AstroLens Full Analysis: reproducible, side-by-side screening. Not a planet-confirmation pipeline. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const host = document.createElement("section");
  host.id = "fullAnalysis";
  host.className = "full-analysis";
  host.innerHTML = `
    <div class="fa-head"><div><div class="fa-eyebrow">INTEGRATED SCIENCE PIPELINE · AL / 02</div><h2>Full observation analysis<span>.</span></h2><p>One run, all core checks. Both flux-processing modes use the same uploaded observation.</p></div><span class="fa-chip">LOCAL · PRIVATE</span></div>
    <div class="fa-source"><div><b id="faFileName">No observation loaded</b><small id="faFileMeta">Import a CSV or TESS light-curve FITS file in Light Curve Lab above.</small></div><button id="faRun" class="primary" disabled>Run Full Analysis →</button></div>
    <div class="fa-progress" aria-live="polite"><span id="faProgressBar"></span></div><p id="faStatus" class="status-message">Waiting for a real observation file.</p>
    <div id="faSummary" class="fa-summary"></div>
    <div id="faResults" class="fa-results"></div>
    <div class="fa-foot">Screening results are hypotheses, not discoveries. This browser pipeline is not equivalent to the NASA SPOC pipeline, a full transit model, or a formal false-alarm calculation.</div>`;
  const lab = $("#dataLab");
  if (lab) lab.appendChild(host);
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "full-analysis.css?v=integrated-1"; document.head.appendChild(link);
  const button = $("#faRun"), status = $("#faStatus"), progress = $("#faProgressBar");
  let running = false, lastReport = null;
  const setStatus = (s, cls="") => { status.textContent=s; status.className="status-message "+cls; };
  const tick = (pct) => { progress.style.width = Math.max(0,Math.min(100,pct))+"%"; };
  const fileNow = () => (typeof selectedCSV !== "undefined" ? selectedCSV : null);
  function syncFile() {
    const f=fileNow(), name=$("#faFileName"), meta=$("#faFileMeta");
    if (!f) { name.textContent="No observation loaded"; meta.textContent="Import a CSV or TESS light-curve FITS file in Light Curve Lab above."; button.disabled=true; return; }
    name.textContent=f.name;
    meta.textContent=(f.size/1024).toFixed(1)+" KB · stays on this device · full pipeline will run both processing modes";
    button.disabled=running;
  }
  const fileInput=$("#lightCurveFile");
  if(fileInput) fileInput.addEventListener("change",syncFile);
  const mastFetch=$("#mastFetchBtn");
  if(mastFetch) mastFetch.addEventListener("click",()=>setTimeout(syncFile,1000));
  const originalScan=$("#scanBtn");
  if(originalScan) originalScan.addEventListener("click",()=>setTimeout(syncFile,500));
  const scanStatusNode=$("#scanStatus"); if(scanStatusNode&&typeof MutationObserver!=="undefined"){new MutationObserver(syncFile).observe(scanStatusNode,{childList:true,subtree:true,characterData:true});}
  const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
  const mad=a=>{const m=median(a);return median(a.map(x=>Math.abs(x-m)))*1.4826};
  function parseData(csv) {
    const rows=parseCSV(csv), h=rows[0].map(x=>x.trim().toLowerCase());
    const idx=(names)=>{for(const n of names){const i=h.findIndex(x=>x===n||x.includes(n));if(i>=0)return i;}return -1;};
    const ti=idx(["time","btjd","bjd","jd"]), fi=idx(["pdcsap_flux","sap_flux","relative_flux","flux","brightness"]), qi=idx(["quality"]), ei=idx(["pdcsap_flux_err","sap_flux_err","flux_err"]);
    if(ti<0||fi<0) throw Error("Time and flux columns were not recognized. Expected TIME and PDCSAP_FLUX/FLUX.");
    const all=rows.slice(1).map((r,i)=>({t:Number(r[ti]),f:Number(r[fi]),q:qi>=0?Number(r[qi]):null,e:ei>=0?Number(r[ei]):NaN,row:i+2}))
      .filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.f)&&p.f>0);
    const qualityRemoved=qi>=0?all.filter(p=>p.q!==0).length:0;
    const missingQuality=qi>=0?all.filter(p=>!Number.isFinite(p.q)).length:0;
    const good=(qi<0?all:all.filter(p=>p.q===0)).sort((a,b)=>a.t-b.t);
    if(good.length<100)throw Error("At least 100 valid unflagged observations are required; found "+good.length+".");
    return {all,points:good,qualityColumn:qi>=0,qualityRemoved,missingQuality,invalidRows:rows.length-1-all.length,fluxColumn:rows[0][fi],timeColumn:rows[0][ti],errorColumn:ei>=0?rows[0][ei]:null,rawRows:rows.length-1};
  }
  function normalize(points) {
    const center=median(points.map(p=>p.f));
    return points.map(p=>({...p,y:p.f/center-1}));
  }
  function detrend(points, window=1, step=.5) {
    const origin=points[0].t, end=points[points.length-1].t, anchors=[];
    for(let c=origin;c<=end+step;c+=step){
      const v=points.filter(p=>Math.abs(p.t-c)<=window/2).map(p=>p.f);
      if(v.length>=8)anchors.push({t:c,v:median(v)});
    }
    if(anchors.length<3)return {points:normalize(points),anchors:0};
    const corrected=points.map(p=>{
      let j=0;while(j<anchors.length-2&&anchors[j+1].t<p.t)j++;
      const a=anchors[j],b=anchors[Math.min(j+1,anchors.length-1)];
      const w=b.t===a.t?0:Math.max(0,Math.min(1,(p.t-a.t)/(b.t-a.t)));
      const base=a.v+(b.v-a.v)*w;
      return {...p,y:p.f/Math.max(base,1e-12)-1};
    });
    const m=median(corrected.map(p=>p.y));
    return {points:corrected.map(p=>({...p,y:p.y-m})),anchors:anchors.length};
  }
  function searchBLS(points, baseline, cadence) {
    const minP=Math.max(cadence*3,.3), maxP=Math.min(15,baseline/2);
    if(maxP<=minP)throw Error("Observation baseline is too short for a useful period search.");
    const nTrial=Math.max(100,Math.min(1800,Math.ceil((1/minP-1/maxP)*baseline*5)));
    const bins=256, durations=[.025,.04,.06,.085,.12,.17], ys=points.map(p=>p.y), scatter=Math.max(mad(ys),1e-7);
    const output=[];
    for(let k=0;k<nTrial;k++){
      const freq=1/maxP+(1/minP-1/maxP)*k/(nTrial-1), period=1/freq;
      const sums=new Float64Array(bins),counts=new Uint32Array(bins);
      for(const p of points){let ph=((p.t-points[0].t)*freq)%1;if(ph<0)ph++;const b=Math.min(bins-1,Math.floor(ph*bins));sums[b]+=p.y;counts[b]++;}
      const ps=new Float64Array(bins*2+1),pc=new Float64Array(bins*2+1);
      for(let b=0;b<bins*2;b++){ps[b+1]=ps[b]+sums[b%bins];pc[b+1]=pc[b]+counts[b%bins];}
      let best=null;
      for(const d of durations){
        const width=Math.max(2,Math.min(Math.floor(bins*.22),Math.round(bins*d/period)));
        if(width>=bins*.24)continue;
        for(let s=0;s<bins;s++){
          const ni=pc[s+width]-pc[s], no=points.length-ni;if(ni<3||no<20)continue;
          const inside=(ps[s+width]-ps[s])/ni, outside=((ps[bins]-ps[0])-(ps[s+width]-ps[s]))/no, depth=outside-inside;
          if(depth<=0)continue;
          const snr=depth/scatter*Math.sqrt(ni*no/points.length);
          if(!best||snr>best.snr)best={period,epoch:points[0].t+((((s+width/2)/bins)%1)/freq),duration:width/bins*period,depth,snr,nIn:ni,cycles:baseline/period};
        }
      }
      if(best)output.push(best);
    }
    output.sort((a,b)=>b.snr-a.snr);
    const unique=[];
    for(const r of output){if(unique.every(x=>Math.abs(x.period-r.period)/Math.min(x.period,r.period)>.02)){unique.push(r);if(unique.length>=8)break;}}
    return {minP,maxP,nTrial,scatter,candidates:unique};
  }
  function phaseStats(points,c) {
    const bins=80,arr=Array.from({length:bins},()=>[]);
    for(const p of points){let ph=(((p.t-c.epoch+c.period/2)/c.period)%1+1)%1-.5;const i=Math.max(0,Math.min(bins-1,Math.floor((ph+.5)*bins)));arr[i].push(p.y);}
    const curve=arr.map((v,i)=>({phase:(i+.5)/bins-.5,flux:v.length?median(v):null,n:v.length}));
    const inside=curve.filter(x=>Math.abs(x.phase)<Math.max(c.duration/c.period/2,.02)&&x.flux!==null);
    const outside=curve.filter(x=>Math.abs(x.phase)>.18&&x.flux!==null);
    const dip=inside.length&&outside.length?median(outside.map(x=>x.flux))-median(inside.map(x=>x.flux)):NaN;
    const shared=window.AstroLensScienceCore?window.AstroLensScienceCore.eventStats(points,c):{};
    return {...shared,curve,dip};
  }
  function harmonicNote(period, list) {
    for(const x of list){if(x.period===period)continue;const ratio=period/x.period;
      for(const n of [0.5,1,2,3])if(Math.abs(ratio-n)<.025)return "Possible harmonic/alias of "+x.period.toFixed(5)+" d (ratio "+ratio.toFixed(2)+").";
    }return "No simple harmonic match in the reported top peaks.";
  }
  function knownMatches(candidates,target) {
    if(!window.AstroLensScienceCore)return [];
    return candidates.map(c=>{const a=window.AstroLensScienceCore.aliasInfo(c.period,target);return {...c,match:(a.type==="known"||a.type==="alias")?[a.label,a.reference,a.error*100]:null,closest:a.reference?{0:a.label,1:a.reference,delta:a.error*100}:null,alias:a};});
  }
  function renderPlot(canvas, points, candidate, stats) {
    if(!canvas||!candidate)return;
    const rect=canvas.getBoundingClientRect(),w=Math.max(320,rect.width),h=230,dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const ys=points.map(p=>p.y).sort((a,b)=>a-b),lo=ys[Math.floor(ys.length*.02)],hi=ys[Math.floor(ys.length*.98)],span=Math.max(hi-lo,1e-7),L=45,R=w-12,T=18,B=h-30;
    ctx.strokeStyle="#27384e";ctx.lineWidth=1;for(let i=0;i<5;i++){let y=T+(B-T)*i/4;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();}
    ctx.fillStyle="#93a8c2";ctx.font="10px monospace";ctx.fillText("Normalized flux",4,12);ctx.fillText("-0.5 phase",L,h-9);ctx.fillText("+0.5 phase",R-65,h-9);
    const folded=points.map(p=>({phase:(((p.t-candidate.epoch+candidate.period/2)/candidate.period)%1+1)%1-.5,y:p.y}));
    ctx.fillStyle="#53d8cb";for(const p of folded){const x=L+(p.phase+.5)*(R-L),y=T+(1-(p.y-lo)/span)*(B-T);if(y>=T-2&&y<=B+2){ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fill();}}
    if(stats){ctx.strokeStyle="#f0c981";ctx.lineWidth=2;ctx.beginPath();let started=false;for(const b of stats.curve){if(b.flux===null){started=false;continue;}const x=L+(b.phase+.5)*(R-L),y=T+(1-(b.flux-lo)/span)*(B-T);if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);}ctx.stroke();}
    // Overlay the candidate's simple box hypothesis separately from the observed binned data.
    const baseY=T+(1-(0-lo)/span)*(B-T),dipY=T+(1-(-candidate.depth-lo)/span)*(B-T),half=(candidate.duration/candidate.period/2)*(R-L),mid=L+.5*(R-L);
    ctx.strokeStyle="#f6d28a";ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(L,baseY);ctx.lineTo(mid-half,baseY);ctx.lineTo(mid-half,dipY);ctx.lineTo(mid+half,dipY);ctx.lineTo(mid+half,baseY);ctx.lineTo(R,baseY);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#f6d28a";ctx.font="9px monospace";ctx.fillText("Dashed gold: BLS box hypothesis, not a fitted transit profile",Math.max(L,w-300),T+10);
  }
  function renderReport(report) {
    const {meta,raw,detrended,rawSearch,detSearch,rawStats,detStats,target}=report;
    const best=detSearch.candidates[0]||rawSearch.candidates[0], bestMode=detSearch.candidates.length?"Detrended":"Original", phase=detStats||rawStats;
    const match=knownMatches(detSearch.candidates,target);
    const summary=[
      ["Valid points",meta.points.length.toLocaleString(),"After non-finite/flux screening"],
      ["Time baseline",meta.baseline.toFixed(3)+" d","Observation span"],
      ["Median cadence",(meta.cadence*1440).toFixed(2)+" min","From positive time differences"],
      ["Quality-flagged rows excluded",meta.qualityColumn?meta.qualityRemoved.toLocaleString():"Not supplied",meta.qualityColumn?"QUALITY=0 rows retained; invalid flags excluded":"No QUALITY column in the loaded CSV; no flag screening applied"],
      ["Top refined signal",best?best.period.toFixed(5)+" d":"None","Best screening hypothesis, not a planet"],
      ["Processing agreement",agreement(rawSearch.candidates,detSearch.candidates),"Cross-mode consistency"]
    ];
    $("#faSummary").innerHTML=summary.map(x=>`<article><small>${esc(x[0])}</small><strong>${esc(x[1])}</strong><span>${esc(x[2])}</span></article>`).join("");
    const makeRows=(a)=>a.map((c,i)=>{const st=phaseStats(report.pointsForStats,c);const harm=harmonicNote(c.period,a);const km=knownMatches([c],target)[0];return `<tr><td>${i+1}</td><td>${c.period.toFixed(6)} d</td><td>${(c.duration*24).toFixed(2)} h</td><td>${(c.depth*1e6).toFixed(0)} ppm</td><td>${c.snr.toFixed(1)}</td><td>${c.cycles.toFixed(1)}</td><td>${esc(km?.match?km.match[0]+" match":(km?.closest?"closest "+km.closest[0]+" ("+km.closest.delta.toFixed(1)+"%)":"Not checked"))}</td><td>${esc(harm)}</td></tr>`;}).join("");
    const rowsRaw=rawSearch.candidates.map((c,i)=>`<tr><td>${i+1}</td><td>${c.period.toFixed(6)} d</td><td>${(c.duration*24).toFixed(2)} h</td><td>${(c.depth*1e6).toFixed(0)} ppm</td><td>${c.snr.toFixed(1)}</td><td>${c.cycles.toFixed(1)}</td></tr>`).join("");
    const rowsDet=detSearch.candidates.map((c,i)=>`<tr><td>${i+1}</td><td>${c.period.toFixed(6)} d</td><td>${(c.duration*24).toFixed(2)} h</td><td>${(c.depth*1e6).toFixed(0)} ppm</td><td>${c.snr.toFixed(1)}</td><td>${c.cycles.toFixed(1)}</td><td>${esc(harmonicNote(c.period,detSearch.candidates))}</td></tr>`).join("");
    const consistency=best&&phase?phase.dip:NaN;
    const judgement="No credible periodic transit established by this run. The leading peaks remain screening hypotheses until a coherent, repeatable dip survives independent vetting.";
    $("#faResults").innerHTML=`
      <div class="fa-verdict"><div><small>PRELIMINARY SCIENTIFIC VERDICT</small><strong>${esc(judgement)}</strong><p>Signal ranking is based on an approximate box search. SNR is not a formal false-alarm probability. A positive result is a follow-up hypothesis, not a planet confirmation.</p></div><button id="faExport" class="secondary">Export report JSON ↓</button></div>
      <div class="fa-columns"><article class="fa-card"><h3>01 · Original flux</h3><p>Median-normalized only, no added rolling baseline. This is the control analysis.</p><div class="fa-table-wrap"><table><thead><tr><th>#</th><th>Period</th><th>Duration</th><th>Depth</th><th>Approx SNR</th><th>Cycles</th></tr></thead><tbody>${rowsRaw||"<tr><td colspan='6'>No candidates returned</td></tr>"}</tbody></table></div></article>
      <article class="fa-card"><h3>02 · Rolling-median detrended</h3><p>One-day median baseline sampled every 0.5 day. Edge and signal suppression are possible.</p><div class="fa-table-wrap"><table><thead><tr><th>#</th><th>Period</th><th>Duration</th><th>Depth</th><th>Approx SNR</th><th>Cycles</th><th>Alias check</th></tr></thead><tbody>${rowsDet||"<tr><td colspan='7'>No candidates returned</td></tr>"}</tbody></table></div></article></div>
      <article class="fa-card"><h3>03 · Phase-folded leading candidate</h3><p>Inspect whether the dip is narrow and repeatable. A cloud of points without a coherent dip is weak evidence.</p><canvas id="faFold" aria-label="Phase folded leading candidate"></canvas><p class="fa-muted" id="faFoldNote"></p></article>
      <div class="fa-columns"><article class="fa-card"><h3>04 · Event consistency</h3><div class="fa-checks">${checkRow("Positive phase-fold dip",Number.isFinite(consistency)&&consistency>0,Number.isFinite(consistency)?(consistency*1e6).toFixed(0)+" ppm estimated from phase bins":"Not measurable")}${checkRow("Cross-processing stability",agreement(rawSearch.candidates,detSearch.candidates).startsWith("Consistent"),agreement(rawSearch.candidates,detSearch.candidates))}${checkRow("Known-planet period check",match.some(x=>x.match),match.some(x=>x.match)?"Close period match exists, not identity proof":(/trappist/i.test(target)?"No close reference-period match in top detrended peaks":"Target not recognized as TRAPPIST-1; known-planet cross-match not run"))}${checkRow("Odd/even event-depth comparison",Number.isFinite(phase?.oddEvenSigma)&&phase.evenN>=3&&phase.oddN>=3,Number.isFinite(phase?.oddEvenSigma)?"Odd "+(phase.oddDepth*1e6).toFixed(0)+" ± "+(phase.oddErr*1e6).toFixed(0)+" ppm; even "+(phase.evenDepth*1e6).toFixed(0)+" ± "+(phase.evenErr*1e6).toFixed(0)+" ppm; difference "+phase.oddEvenSigma.toFixed(1)+"σ; "+phase.oddN+"/"+phase.evenN+" sampled events.":"Too few well-sampled events for a parity test")}${checkRow("Centroid / pixel vetting",false,"Not available in this light-curve CSV; requires target-pixel data")}${checkRow("Formal false-alarm probability",false,"Not calculated by this approximate screening algorithm")}</div></article>
      <article class="fa-card"><h3>05 · Data quality & method</h3><ul class="fa-list"><li>Flux column: <b>${esc(meta.fluxColumn)}</b>; time column: <b>${esc(meta.timeColumn)}</b>. Metadata provenance: <b>${esc(report.meta.metadataOrigin)}</b>.</li><li>Rows read: ${meta.rawRows.toLocaleString()}; invalid time/flux rows: ${meta.invalidRows.toLocaleString()}; finite positive flux rows: ${meta.all.length.toLocaleString()}; ${meta.qualityColumn?"nonzero/missing QUALITY flags excluded: "+meta.qualityRemoved.toLocaleString():"QUALITY column absent; flag screening unavailable"}; accepted rows: ${meta.points.length.toLocaleString()}.</li><li>Trial grid: ${rawSearch.nTrial} frequencies in each mode; period span ${rawSearch.minP.toFixed(3)} to ${rawSearch.maxP.toFixed(3)} days.</li><li>Duration grid and phase bins are approximate. Peaks may be harmonics, eclipsing binaries, stellar variability, instrumental artifacts, or noise.</li><li>NASA notes that PDCSAP flux already has long-term trends corrected using co-trending basis vectors. Compare modes rather than assuming extra detrending improves the signal. <a href="https://heasarc.gsfc.nasa.gov/docs/tess/LightCurveFile-Object-Tutorial.html" target="_blank" rel="noreferrer">NASA TESS light-curve guide ↗</a></li></ul></article></div>`;
    const bestStats=best?phaseStats(report.pointsForStats,best):null;
    if(best){renderPlot($("#faFold"),report.pointsForStats,best,bestStats);$("#faFoldNote").textContent="Period "+best.period.toFixed(6)+" d · "+best.cycles.toFixed(1)+" baseline cycles · "+report.pointsForStats.length.toLocaleString()+" points. Gold line shows phase-bin medians."; }
    $("#faExport").addEventListener("click",()=>downloadTextFile(JSON.stringify(report.exportData,null,2),"astrolens-full-analysis.json","application/json"));
  }
  function checkRow(label,pass,detail){return `<div class="fa-check"><span class="${pass?"fa-pass":"fa-pending"}">${pass?"✓":"·"}</span><div><b>${esc(label)}</b><small>${esc(detail)}</small></div></div>`;}
  function agreement(a,b){if(!a.length||!b.length)return "Insufficient peaks";const p=a[0].period;const close=b.find(x=>Math.abs(x.period-p)/Math.min(x.period,p)<.03);return close?"Consistent: leading periods within 2%":"Unstable: leading peaks differ by more than 2%";}
  async function run() {
    if(running)return;const file=fileNow();if(!file)return;
    running=true;button.disabled=true;tick(3);$("#faResults").innerHTML="";$("#faSummary").innerHTML="";
    try {
      if(file.size>25*1024*1024)throw Error("Files over 25 MB are not supported by this browser analysis.");
      setStatus("Reading observation and checking fields…");
      let csv;
      if(/\.fits?$/i.test(file.name)){const conv=parseFitsLightCurve(await file.arrayBuffer());csv=conv.csv;window.__astrolensFitsMeta=conv.metadata||null;}else{window.__astrolensFitsMeta=file.__astrolensFitsMeta||null;csv=await file.text();}
      tick(12);setStatus("Screening finite flux values, quality flags and cadence…");
      const meta=parseData(csv),points=meta.points,baseline=points[points.length-1].t-points[0].t;
      const gaps=[];for(let i=1;i<points.length;i++){const d=points[i].t-points[i-1].t;if(d>0)gaps.push(d);}
      const cadence=median(gaps);
      tick(23);setStatus("Searching original flux without extra detrending…");
      const rawPoints=normalize(points),rawSearch=searchBLS(rawPoints,baseline,cadence);
      tick(53);setStatus("Searching independently detrended flux…");
      const det=detrend(points),detPoints=det.points,detSearch=searchBLS(detPoints,baseline,cadence);
      tick(79);setStatus("Comparing periods, harmonics, known references and phase-folded morphology…");
      const target=$("#mastTarget")?.value||"";
      const rawStats=rawSearch.candidates[0]?phaseStats(rawPoints,rawSearch.candidates[0]):null;
      const detStats=detSearch.candidates[0]?phaseStats(detPoints,detSearch.candidates[0]):null;
      const report={meta:{...meta,baseline,cadence,metadataOrigin:file.name.toLowerCase().endsWith(".fits")?"FITS header and light-curve table":file.__astrolensFitsMeta?"Original FITS metadata retained with converted CSV":"CSV only; FITS-header metadata unavailable"},raw:rawPoints,detrended:detPoints,rawSearch,detSearch,rawStats,detStats,target,pointsForStats:detSearch.candidates.length?detPoints:rawPoints};
      report.exportData={createdAt:new Date().toISOString(),sourceFile:file.name,sourceTarget:target||null,diagnostics:{measurements:points.length,baselineDays:baseline,medianCadenceDays:cadence,qualityColumn:meta.qualityColumn,qualityRemoved:meta.qualityRemoved,invalidRows:meta.invalidRows,metadataOrigin:report.meta.metadataOrigin,fluxColumn:meta.fluxColumn,timeColumn:meta.timeColumn},originalFlux:{periodRangeDays:[rawSearch.minP,rawSearch.maxP],trialFrequencies:rawSearch.nTrial,candidates:rawSearch.candidates},rollingMedianDetrended:{windowDays:1,stepDays:.5,periodRangeDays:[detSearch.minP,detSearch.maxP],trialFrequencies:detSearch.nTrial,candidates:detSearch.candidates},processingAgreement:agreement(rawSearch.candidates,detSearch.candidates),limitations:["Approximate browser BLS screening, not NASA SPOC or a validated transit pipeline.","SNR is not a formal false-alarm probability.","Odd/even event-depth checks are approximate; centroid and pixel-level vetting require target-pixel data; independent confirmation is not completed." ]};
      lastReport=report;renderReport(report);tick(100);setStatus("Full analysis complete. Review both processing modes and the validation limits below.","success");
      if(/\.fits?$/i.test(file.name))$("#faFileMeta").textContent="FITS converted locally for analysis · "+points.length.toLocaleString()+" quality-screened rows";
    } catch(e){setStatus("Full analysis failed: "+e.message,"error");$("#faResults").innerHTML='<div class="fa-error">'+esc(e.message)+'</div>';tick(0);}
    finally{running=false;button.disabled=!fileNow();}
  }
  // Expose the same parser, detrending and BLS implementation to Light Curve Lab.
  // Both screens now analyze identical accepted rows and use the same refined candidates.
  window.AstroLensFullAnalysisSearch={parseData,normalize,detrend,searchBLS,median};
  button.addEventListener("click",run);
  syncFile();
})();