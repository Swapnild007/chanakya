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
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "full-analysis.css?v=integrated-2"; document.head.appendChild(link);
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
    const all=rows.slice(1).map((r,i)=>({t:Number(r[ti]),f:Number(r[fi]),q:qi>=0?(String(r[qi]??"").trim()===""?NaN:Number(r[qi])):null,e:ei>=0?Number(r[ei]):NaN,row:i+2}))
      .filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.f)&&p.f>0);
    const qSummary=qi>=0&&window.AstroLensScienceCore?.tessQualitySummary?window.AstroLensScienceCore.tessQualitySummary(all.map(p=>p.q)):null;
    const missingQuality=qi>=0?all.filter(p=>!Number.isFinite(p.q)).length:0;
    const good=(qi<0?all:all.filter(p=>Number.isFinite(p.q)&&((Number(p.q)>>>0)&(window.AstroLensScienceCore?.TESS_QUALITY_MASK??175))===0)).sort((a,b)=>a.t-b.t);
    const qualityRemoved=qi>=0?all.length-good.length:0;
    if(good.length<100)throw Error("At least 100 valid observations after the TESS default QUALITY bitmask are required; found "+good.length+".");
    return {all,points:good,qualityColumn:qi>=0,qualityRemoved,missingQuality,qualityBitCounts:qSummary?.bits||[],qualityMask:qSummary?.mask??(qi>=0?175:null),qualityPolicy:qSummary?.policy??(qi>=0?"TESS default QUALITY mask 175":"QUALITY column absent"),invalidRows:rows.length-1-all.length,fluxColumn:rows[0][fi],timeColumn:rows[0][ti],errorColumn:ei>=0?rows[0][ei]:null,rawRows:rows.length-1};
  }
  function normalize(points) {
    const center=median(points.map(p=>p.f));
    return points.map(p=>({...p,y:p.f/center-1}));
  }
  function detrend(points, window=1, step=.5, maskCandidate=null) {
    const origin=points[0].t, end=points[points.length-1].t, anchors=[];let maskFallbacks=0,maskedAnchors=0;
    for(let c=origin;c<=end+step;c+=step){
      const local=points.filter(p=>Math.abs(p.t-c)<=window/2);
      const masked=maskCandidate?local.filter(p=>{let ph=((p.t-maskCandidate.epoch+maskCandidate.period/2)/maskCandidate.period)%1;if(ph<0)ph++;return Math.abs(ph-.5)>Math.max(maskCandidate.duration/(2*maskCandidate.period),.003);}):local;
      const use=masked.length>=8?masked:local;
      if(maskCandidate&&masked.length>=8)maskedAnchors++;else if(maskCandidate)maskFallbacks++;
      const v=use.map(p=>p.f);
      if(v.length>=8)anchors.push({t:c,v:median(v)});
    }
    if(anchors.length<3)return {points:normalize(points),anchors:0,maskFallbacks,maskedAnchors};
    const corrected=points.map(p=>{
      let j=0;while(j<anchors.length-2&&anchors[j+1].t<p.t)j++;
      const a=anchors[j],b=anchors[Math.min(j+1,anchors.length-1)];
      const w=b.t===a.t?0:Math.max(0,Math.min(1,(p.t-a.t)/(b.t-a.t)));
      const base=a.v+(b.v-a.v)*w;
      return {...p,y:p.f/Math.max(base,1e-12)-1};
    });
    const m=median(corrected.map(p=>p.y));
    return {points:corrected.map(p=>({...p,y:p.y-m})),anchors:anchors.length,maskFallbacks,maskedAnchors};
  }
  function searchBLS(points, baseline, cadence) {
    const minP=Math.max(cadence*3,.3), maxP=Math.min(15,baseline/2);
    if(maxP<=minP)throw Error("Observation baseline is too short for a useful period search.");
    const nTrial=Math.max(100,Math.min(1800,Math.ceil((1/minP-1/maxP)*baseline*5)));
    const bins=256, durations=[.025,.04,.06,.085,.12,.17], ys=points.map(p=>p.y), scatter=Math.max(mad(ys),1e-7);
    const output=[],spectrum=[];
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
      spectrum.push({frequency:freq,period,score:best?.snr??0});
      if(best)output.push(best);
    }
    output.sort((a,b)=>b.snr-a.snr);
    const unique=[];
    for(const r of output){if(unique.every(x=>Math.abs(x.period-r.period)/Math.min(x.period,r.period)>.02)){unique.push(r);if(unique.length>=8)break;}}
    return {minP,maxP,nTrial,scatter,candidates:unique,spectrum};
  }
  function phaseStats(points,c) {
    const bins=80,arr=Array.from({length:bins},()=>[]);
    for(const p of points){let ph=(((p.t-c.epoch+c.period/2)/c.period)%1+1)%1-.5;const i=Math.max(0,Math.min(bins-1,Math.floor((ph+.5)*bins)));arr[i].push(p.y);}
    const curve=arr.map((v,i)=>({phase:(i+.5)/bins-.5,flux:v.length?median(v):null,n:v.length}));
    const inside=curve.filter(x=>Math.abs(x.phase)<Math.max(c.duration/c.period/2,.02)&&x.flux!==null);
    const outside=curve.filter(x=>Math.abs(x.phase)>.18&&x.flux!==null);
    const dip=inside.length&&outside.length?median(outside.map(x=>x.flux))-median(inside.map(x=>x.flux)):NaN;
    const phaseOfPoint=p=>(((p.t-c.epoch+c.period/2)/c.period)%1+1)%1-.5;
    const insidePoints=points.filter(p=>Math.abs(phaseOfPoint(p))<Math.max(c.duration/c.period/2,.02));
    const outsidePoints=points.filter(p=>Math.abs(phaseOfPoint(p))>.18);
    const noise=window.AstroLensScienceCore?window.AstroLensScienceCore.robustSigma(points.map(p=>p.y)):NaN;
    const dipError=insidePoints.length&&outsidePoints.length&&Number.isFinite(noise)?noise*Math.sqrt(1/insidePoints.length+1/outsidePoints.length):NaN;
    const dipSigma=Number.isFinite(dip)&&Number.isFinite(dipError)&&dipError>0?dip/dipError:NaN;
    const shared=window.AstroLensScienceCore?window.AstroLensScienceCore.eventStats(points,c):{};
    return {...shared,curve,dip,dipError,dipSigma,insidePhasePoints:insidePoints.length,outsidePhasePoints:outsidePoints.length};
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
  function drawScoreSpectrum(canvas,raw,processed){
    if(!canvas)return;const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),w=box.width,h=190;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const series=[{data:raw||[],color:"#7bb8ff"},{data:processed||[],color:"#4ce0d2"}],all=series.flatMap(s=>s.data).filter(p=>Number.isFinite(p.frequency)&&Number.isFinite(p.score));
    if(all.length<2){ctx.fillStyle="#8aa6c0";ctx.font="10px monospace";ctx.fillText("Spectrum unavailable",12,24);return;}
    const minF=Math.min(...all.map(p=>p.frequency)),maxF=Math.max(...all.map(p=>p.frequency)),maxS=Math.max(1,...all.map(p=>p.score)),left=38,right=10,top=12,bottom=25,plotW=w-left-right,plotH=h-top-bottom;
    ctx.strokeStyle="#20384d";ctx.fillStyle="#8aa6c0";ctx.font="9px monospace";
    for(let i=0;i<5;i++){const y=top+plotH*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();}ctx.save();ctx.translate(11,top+plotH/2);ctx.rotate(-Math.PI/2);ctx.fillStyle="#8aa6c0";ctx.fillText("Heuristic score (uncalibrated)",0,0);ctx.restore();
    for(const item of series){const data=item.data.slice().filter(p=>Number.isFinite(p.frequency)&&Number.isFinite(p.score)).sort((a,b)=>a.frequency-b.frequency);ctx.strokeStyle=item.color;ctx.lineWidth=1.15;ctx.beginPath();let begun=false;for(const p of data){const x=left+(p.frequency-minF)/Math.max(maxF-minF,1e-12)*plotW,y=top+(1-p.score/maxS)*plotH;if(!begun){ctx.moveTo(x,y);begun=true;}else ctx.lineTo(x,y);}ctx.stroke();}
    ctx.fillStyle="#8aa6c0";ctx.fillText(minF.toFixed(2),left,h-7);ctx.fillText(maxF.toFixed(2)+" cycles/day",Math.max(left+30,w-115),h-7);
    ctx.fillStyle="#7bb8ff";ctx.fillRect(left,2,7,3);ctx.fillText("Original",left+11,7);ctx.fillStyle="#4ce0d2";ctx.fillRect(left+72,2,7,3);ctx.fillText("Transit-masked",left+83,7);
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
      ["Quality-flagged rows excluded",meta.qualityColumn?meta.qualityRemoved.toLocaleString():"Not supplied",meta.qualityColumn?"TESS default QUALITY bitmask "+meta.qualityMask+" applied; invalid/missing flags excluded":"No QUALITY column in the loaded CSV; no flag screening applied"],
      ["Top refined signal",best?best.period.toFixed(5)+" d":"None","Best screening hypothesis, not a planet"],
      ["Processing agreement",agreement(rawSearch.candidates,detSearch.candidates),"Cross-mode consistency"]
    ];
    $("#faSummary").innerHTML=summary.map(x=>`<article><small>${esc(x[0])}</small><strong>${esc(x[1])}</strong><span>${esc(x[2])}</span></article>`).join("");
    const depthConsistencyForDisplay=window.AstroLensScienceCore?.eventDepthConsistency?window.AstroLensScienceCore.eventDepthConsistency(phase):{consistent:null};
     const depthText=c=>depthConsistencyForDisplay.consistent===true?(c.depth*1e6).toFixed(0)+" ppm":"WITHHELD · event depths inconsistent";
     const depthRatioForDisplay=best&&Number.isFinite(depthConsistencyForDisplay.weightedMeanDepth)&&Math.abs(depthConsistencyForDisplay.weightedMeanDepth)>1e-12?Math.abs(best.depth/depthConsistencyForDisplay.weightedMeanDepth):null;
     const makeRows=(a)=>a.map((c,i)=>{const st=phaseStats(report.pointsForStats,c);const harm=harmonicNote(c.period,a);const km=knownMatches([c],target)[0];return `<tr><td>${i+1}</td><td>${c.period.toFixed(6)} d</td><td>${(c.duration*24).toFixed(2)} h</td><td>${depthText(c)}</td><td>${c.snr.toFixed(1)}</td><td>${c.cycles.toFixed(1)}</td><td>${esc(km?.match?km.match[0]+" match":(km?.closest?"closest "+km.closest[0]+" ("+km.closest.delta.toFixed(1)+"%)":"Not checked"))}</td><td>${esc(harm)}</td></tr>`;}).join("");
    const rowsRaw=rawSearch.candidates.map((c,i)=>`<tr><td>${i+1}</td><td>${c.period.toFixed(6)} d</td><td>${(c.duration*24).toFixed(2)} h</td><td>${depthText(c)}</td><td>${c.snr.toFixed(1)}</td><td>${c.cycles.toFixed(1)}</td></tr>`).join("");
    const rowsDet=detSearch.candidates.map((c,i)=>`<tr><td>${i+1}</td><td>${c.period.toFixed(6)} d</td><td>${(c.duration*24).toFixed(2)} h</td><td>${(c.depth*1e6).toFixed(0)} ppm</td><td>${c.snr.toFixed(1)}</td><td>${c.cycles.toFixed(1)}</td><td>${esc(harmonicNote(c.period,detSearch.candidates))}</td></tr>`).join("");
    const consistency=best&&phase?phase.dip:NaN;
    const depthConsistency=depthConsistencyForDisplay;
    const processingAgreement=agreement(rawSearch.candidates,detSearch.candidates);
    const parityConsistent=Number.isFinite(phase?.oddEvenSigma)&&phase.oddN>=3&&phase.evenN>=3&&Math.abs(phase.oddEvenSigma)<3;
    const eventScatterConsistent=Number.isFinite(phase?.eventDepthScatter)&&Number.isFinite(best?.depth)&&phase.usableEvents>=4&&phase.eventDepthScatter<Math.max(best.depth*1.5,1e-5);
    const phaseContrastPresent=Number.isFinite(phase?.dip)&&phase.dip>0;
    const formalFapComputed=false;
    const phaseDipCredible=phaseContrastPresent&&processingAgreement.startsWith("Consistent")&&parityConsistent&&eventScatterConsistent&&depthConsistency.consistent===true&&formalFapComputed;
    const phaseGateReasons=[];
    if(!formalFapComputed)phaseGateReasons.push("formal false-alarm probability not computed");
    if(!phaseContrastPresent)phaseGateReasons.push("no positive phase-fold contrast");
    if(!processingAgreement.startsWith("Consistent"))phaseGateReasons.push("period shifts with processing");
    if(!parityConsistent)phaseGateReasons.push("odd/even consistency not established");
    if(!eventScatterConsistent)phaseGateReasons.push("event depths are too variable or too few are sampled");
    if(depthConsistency.consistent!==true)phaseGateReasons.push(depthConsistency.consistent===false?"per-event depths are inconsistent with one shared depth":"per-event depth consistency is not computable");
    const judgement=phaseDipCredible?"The candidate passed the available screening gates, but remains unconfirmed pending independent vetting.":"No credible periodic transit established by this run. Blocking evidence gates: "+[...new Set(phaseGateReasons)].join("; ")+". This verdict is generated from the checklist results.";
    $("#faResults").innerHTML=`
      <div class="fa-verdict"><div><small>PRELIMINARY SCIENTIFIC VERDICT</small><strong>${esc(judgement)}</strong><p>Signal ranking uses a heuristic box-search score, not calibrated BLS power or formal false-alarm significance. A positive result is a follow-up hypothesis, not a planet confirmation.</p></div><button id="faExport" class="secondary">Export report JSON ↓</button></div>
      <div class="fa-columns"><article class="fa-card"><h3>01 · Original flux</h3><p>Median-normalized only, no added rolling baseline. This is the control analysis.</p><div class="fa-table-wrap"><table><thead><tr><th>#</th><th>Period</th><th>Duration</th><th>Depth</th><th>Heuristic score</th><th>Cycles</th></tr></thead><tbody>${rowsRaw||"<tr><td colspan='6'>No candidates returned</td></tr>"}</tbody></table></div></article>
      <article class="fa-card"><h3>02 · Transit-masked robust baseline</h3><p>Rolling-median baseline window is at least four times the seed duration. Masked anchors: ${detSearch.transitMask?.maskedAnchors??0}; fallback anchors (too few unmasked samples): ${detSearch.transitMask?.maskFallbackAnchors??0}. One exploratory mask pass; edge effects and residual signal suppression remain possible.</p><div class="fa-table-wrap"><table><thead><tr><th>#</th><th>Period</th><th>Duration</th><th>Depth</th><th>Heuristic score</th><th>Cycles</th><th>Alias check</th></tr></thead><tbody>${rowsDet||"<tr><td colspan='7'>No candidates returned</td></tr>"}</tbody></table></div></article></div>
      <article class="fa-card"><h3>03 · Period-score spectrum</h3><p>All trial frequencies are shown for both processing modes. This is a heuristic ranking-score spectrum, not calibrated BLS power or significance.</p><canvas id="faSpectrum" aria-label="Heuristic period score versus frequency for original and detrended light curves" style="height:190px"></canvas><p class="fa-muted">Horizontal axis: frequency (cycles/day). Peaks are screening hypotheses.</p></article><article class="fa-card"><h3>04 · Phase-folded leading candidate</h3><p>Inspect whether the dip is narrow and repeatable. A cloud of points without a coherent dip is weak evidence.</p><canvas id="faFold" aria-label="Phase folded leading candidate"></canvas><p class="fa-muted" id="faFoldNote"></p></article>
      <div class="fa-columns"><article class="fa-card"><h3>05 · Event consistency</h3><div class="fa-checks">${checkRow("Coherent phase-fold dip",phaseDipCredible,Number.isFinite(consistency)?(consistency*1e6).toFixed(0)+" ppm phase-bin contrast; formal significance: not computed. "+(phaseDipCredible?"Cross-check gate passed, still not a planet confirmation.":"NOT accepted as coherent: "+phaseGateReasons.join("; ")+"."):"Not measurable")}${checkRow("Cross-processing stability",processingAgreement.startsWith("Consistent")?true:processingAgreement.startsWith("Insufficient")?"pending":false,processingAgreement)}${checkRow("Known-planet period check",/trappist/i.test(target)||/tic\s*278892590/i.test(target)?!match.some(x=>x.match):"pending",match.some(x=>x.match)?"Close period match exists, not identity proof":(/trappist/i.test(target)?"No close reference-period match in top detrended peaks":"Target not recognized as TRAPPIST-1; known-planet cross-match not run"))}${checkRow("Odd/even event-depth comparison",phase.oddN<3||phase.evenN<3?"pending":parityConsistent,Number.isFinite(phase?.oddEvenSigma)?"Odd "+(phase.oddDepth*1e6).toFixed(0)+" ± "+(phase.oddErr*1e6).toFixed(0)+" ppm; even "+(phase.evenDepth*1e6).toFixed(0)+" ± "+(phase.evenErr*1e6).toFixed(0)+" ppm; difference "+phase.oddEvenSigma.toFixed(1)+"σ; "+phase.oddN+"/"+phase.evenN+" sampled events.":"Too few well-sampled events for a parity test")}${checkRow("Centroid / pixel vetting","pending","Not available in this light-curve CSV; requires target-pixel data")}${checkRow("Formal false-alarm probability","pending","Not computed. Full-search null trials are not run by Full Analysis; no global false-alarm probability is available.")}${checkRow("Per-event depth consistency",depthConsistency.consistent===null?"pending":depthConsistency.consistent,depthConsistency.n>=2?(depthConsistency.consistent===true?"weighted mean depth "+(depthConsistency.weightedMeanDepth*1e6).toFixed(0)+" ppm":"weighted mean depth withheld because events are inconsistent")+(Number.isFinite(depthRatioForDisplay)?"; search-box / event-mean ratio "+depthRatioForDisplay.toFixed(2)+"×":"")+"; χ²="+depthConsistency.chiSquare.toFixed(2)+" for "+depthConsistency.degreesFreedom+" degrees of freedom; reduced χ²="+depthConsistency.reducedChiSquare.toFixed(2)+"; "+(depthConsistency.consistent?"not inconsistent with one shared depth at approximate 5% threshold":"inconsistent with one shared depth at approximate 5% threshold")+"; "+depthConsistency.n+" events.":"Fewer than two usable events.")}</div></article>
      <article class="fa-card"><h3>06 · Data quality & method</h3><ul class="fa-list"><li>Flux column: <b>${esc(meta.fluxColumn)}</b>; time column: <b>${esc(meta.timeColumn)}</b>. Metadata provenance: <b>${esc(report.meta.metadataOrigin)}</b>.</li><li>Rows read: ${meta.rawRows.toLocaleString()}; invalid time/flux rows: ${meta.invalidRows.toLocaleString()}; finite positive flux rows: ${meta.all.length.toLocaleString()}; ${meta.qualityColumn?"TESS QUALITY mask "+meta.qualityMask+" excluded "+meta.qualityRemoved.toLocaleString()+" rows (missing: "+meta.missingQuality+"); per-bit counts: "+(meta.qualityBitCounts||[]).map(b=>b.name+"="+b.count).join(", "):"QUALITY column absent; flag screening unavailable"}; accepted rows: ${meta.points.length.toLocaleString()}.</li><li>TESS quality mask: ${meta.qualityColumn?"bitmask "+meta.qualityMask+"; per-bit counts "+(meta.qualityBitCounts||[]).map(b=>b.name+"="+b.count).join(", "):"QUALITY absent"}.</li><li>Detrended residual offset: mean ${report.meta.residualMeanPpm.toFixed(1)} ppm; median ${report.meta.residualMedianPpm.toFixed(1)} ppm${window.__astrolensFitsMeta?.sector!==undefined&&window.__astrolensFitsMeta?.sector!==null?"; FITS sector "+window.__astrolensFitsMeta.sector:"; sector metadata unavailable"}.</li><li>Trial grid: ${rawSearch.nTrial} frequencies in each mode; period span ${rawSearch.minP.toFixed(3)} to ${rawSearch.maxP.toFixed(3)} days.</li><li>Duration grid and phase bins are approximate. Peaks may be harmonics, eclipsing binaries, stellar variability, instrumental artifacts, or noise.</li><li>NASA notes that PDCSAP flux already has long-term trends corrected using co-trending basis vectors. Compare modes rather than assuming extra detrending improves the signal. <a href="https://heasarc.gsfc.nasa.gov/docs/tess/LightCurveFile-Object-Tutorial.html" target="_blank" rel="noreferrer">NASA TESS light-curve guide ↗</a></li></ul></article></div>`;
    const bestStats=best?phaseStats(report.pointsForStats,best):null;
    if(best){renderPlot($("#faFold"),report.pointsForStats,best,bestStats);$("#faFoldNote").textContent="Period "+best.period.toFixed(6)+" d · "+best.cycles.toFixed(1)+" baseline cycles · "+report.pointsForStats.length.toLocaleString()+" points. Gold line shows phase-bin medians. Formal false-alarm significance: not computed; no σ claim is made. Dense local refinement used 201 periods across ±2% around leading peaks."; }
    $("#faExport").addEventListener("click",()=>downloadTextFile(JSON.stringify(report.exportData,null,2),"astrolens-full-analysis.json","application/json"));
  }
  function checkRow(label,status,detail){const pass=status===true,pending=status==="pending";return `<div class="fa-check"><span class="${pass?"fa-pass":pending?"fa-pending":"fa-fail"}">${pass?"✓":pending?"…":"×"}</span><div><b>${esc(label)} · ${pass?"PASS":pending?"NOT COMPUTED / UNAVAILABLE":"FAIL"}</b><small>${esc(detail)}</small></div></div>`;}
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
      if(window.AstroLensScienceCore?.denseRefine){const refined=window.AstroLensScienceCore.denseRefine(rawPoints,rawSearch.candidates.slice(0,3),baseline,.02,201);rawSearch.candidates=[...refined,...rawSearch.candidates.slice(3)].sort((a,b)=>b.snr-a.snr);rawSearch.denseRefinement={windowFraction:.02,steps:201,refinedCandidates:Math.min(3,rawSearch.candidates.length)};}
      tick(53);setStatus("Searching independently detrended flux…");
      const firstDet=detrend(points),firstSearch=searchBLS(firstDet.points,baseline,cadence);
      if(window.AstroLensScienceCore?.denseRefine){const refined=window.AstroLensScienceCore.denseRefine(firstDet.points,firstSearch.candidates.slice(0,3),baseline,.02,201);firstSearch.candidates=[...refined,...firstSearch.candidates.slice(3)].sort((a,b)=>b.snr-a.snr);firstSearch.denseRefinement={windowFraction:.02,steps:201,refinedCandidates:Math.min(3,firstSearch.candidates.length)};}
      const maskSeed=firstSearch.candidates[0]||null,baselineWindowDays=Math.max(1,(maskSeed?.duration||.25)*4);
      const det=detrend(points,baselineWindowDays,.5,maskSeed),detPoints=det.points,detSearch=searchBLS(detPoints,baseline,cadence);
      if(window.AstroLensScienceCore?.denseRefine){const refined=window.AstroLensScienceCore.denseRefine(detPoints,detSearch.candidates.slice(0,3),baseline,.02,201);detSearch.candidates=[...refined,...detSearch.candidates.slice(3)].sort((a,b)=>b.snr-a.snr);detSearch.denseRefinement={windowFraction:.02,steps:201,refinedCandidates:Math.min(3,detSearch.candidates.length)};}
      detSearch.transitMask={applied:!!maskSeed,seedPeriod:maskSeed?.period??null,seedDurationDays:maskSeed?.duration??null,baselineWindowDays,maskedAnchors:det.maskedAnchors,maskFallbackAnchors:det.maskFallbacks,method:"One-pass candidate transit mask before rolling-median baseline fit; exploratory protection, not independent detection."};
      if(window.AstroLensScienceCore?.denseRefine){const refined=window.AstroLensScienceCore.denseRefine(detPoints,detSearch.candidates.slice(0,3),baseline,.02,201);detSearch.candidates=[...refined,...detSearch.candidates.slice(3)].sort((a,b)=>b.snr-a.snr);detSearch.denseRefinement={windowFraction:.02,steps:201,refinedCandidates:Math.min(3,detSearch.candidates.length)};}
      tick(79);setStatus("Comparing periods, harmonics, known references and phase-folded morphology…");
      const target=$("#mastTarget")?.value||"";
      const rawStats=rawSearch.candidates[0]?phaseStats(rawPoints,rawSearch.candidates[0]):null;
      const detStats=detSearch.candidates[0]?phaseStats(detPoints,detSearch.candidates[0]):null;
      const eventDepthGate=window.AstroLensScienceCore?.eventDepthConsistency?window.AstroLensScienceCore.eventDepthConsistency(detStats):{consistent:null,n:0};
      const residualMeanPpm=detPoints.reduce((sum,p)=>sum+p.y,0)/Math.max(1,detPoints.length)*1e6,residualMedianPpm=window.AstroLensScienceCore?.median(detPoints.map(p=>p.y))*1e6;
       const report={meta:{...meta,baseline,cadence,residualMeanPpm,residualMedianPpm,metadataOrigin:file.name.toLowerCase().endsWith(".fits")?"FITS header and light-curve table":file.__astrolensFitsMeta?"Original FITS metadata retained with converted CSV":"CSV only; FITS-header metadata unavailable"},raw:rawPoints,detrended:detPoints,rawSearch,detSearch,rawStats,detStats,target,pointsForStats:detSearch.candidates.length?detPoints:rawPoints};
      report.exportData={createdAt:new Date().toISOString(),software:{application:"AstroLens",version:"0.4.0-alpha",reportSchema:"2.0",periodSearch:"Custom deterministic browser BLS screening; not Astropy, Lightkurve or NASA SPOC"},sourceFile:file.name,sourceTarget:target||null,reproducibility:{primaryBLS:"Deterministic frequency grid and deterministic tie-breaking; no random seed used by the primary search.",periodGrid:"Frequency grid is uniform in frequency with approximately five samples per baseline-frequency resolution, bounded by minP and maxP."},injectionRecovery:{status:"Not run by Full Analysis; use Light Curve Lab validation for fixed-period sensitivity diagnostics.",plannedDepthsPpm:Array.from({length:30},(_,i)=>(i+1)*100)},diagnostics:{measurements:points.length,baselineDays:baseline,medianCadenceDays:cadence,qualityColumn:meta.qualityColumn,qualityRemoved:meta.qualityRemoved,qualityMask:meta.qualityMask,qualityPolicy:meta.qualityPolicy,qualityBitCounts:meta.qualityBitCounts,missingQuality:meta.missingQuality,invalidRows:meta.invalidRows,residualMeanPpm,residualMedianPpm,sector:window.__astrolensFitsMeta?.sector??null,metadataOrigin:report.meta.metadataOrigin,fluxColumn:meta.fluxColumn,timeColumn:meta.timeColumn},eventDepthConsistency:{...eventDepthGate,depthsReportable:eventDepthGate.consistent===true,rule:"Candidate depth is withheld from export unless the per-event shared-depth consistency test passes."},originalFlux:{periodRangeDays:[rawSearch.minP,rawSearch.maxP],trialFrequencies:rawSearch.nTrial,denseRefinement:rawSearch.denseRefinement||null,spectrum:rawSearch.spectrum,candidates:rawSearch.candidates.map(c=>({...c,depth:eventDepthGate.consistent===true?c.depth:null,depthStatus:eventDepthGate.consistent===true?"event consistency gate passed":"withheld: event depths inconsistent"}))},rollingMedianDetrended:{windowDays:baselineWindowDays,stepDays:.5,transitMask:detSearch.transitMask,maskedAnchors:det.maskedAnchors,maskFallbackAnchors:det.maskFallbacks,periodRangeDays:[detSearch.minP,detSearch.maxP],trialFrequencies:detSearch.nTrial,denseRefinement:detSearch.denseRefinement||null,spectrum:detSearch.spectrum,candidates:detSearch.candidates.map(c=>({...c,depth:eventDepthGate.consistent===true?c.depth:null,depthStatus:eventDepthGate.consistent===true?"event consistency gate passed":"withheld: event depths inconsistent"}))},processingAgreement:agreement(rawSearch.candidates,detSearch.candidates),limitations:["Approximate browser BLS screening, not NASA SPOC or a validated transit pipeline.","The heuristic ranking score is not calibrated BLS power or formal false-alarm significance.","Transit-aware detrending uses one candidate-mask pass with a rolling median, not a validated spline/biweight pipeline.","Odd/even event-depth checks are approximate; centroid and pixel-level vetting require target-pixel data; independent confirmation is not completed." ]};
      lastReport=report;renderReport(report);drawScoreSpectrum($("#faSpectrum"),rawSearch.spectrum,detSearch.spectrum);tick(100);setStatus("Full analysis complete. Review both processing modes and the validation limits below.","success");
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