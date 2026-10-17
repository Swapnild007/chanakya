/* AstroLens validation layer for browser BLS screening.
   Diagnostics are deliberately labelled as screening tests, not planet confirmation. */
(() => {
  const $ = s => document.querySelector(s);
  const style=document.createElement("style");
  style.textContent=`
  .blsv-panel{margin-top:16px;padding:clamp(13px,2vw,20px);border:1px solid #8ad9f52b;border-radius:19px;background:linear-gradient(145deg,#102638c9,#081523ed 60%,#0a1422e8);box-shadow:inset 0 1px #ffffff16,0 16px 42px #0003;-webkit-backdrop-filter:blur(20px) saturate(135%);backdrop-filter:blur(20px) saturate(135%)}
  .blsv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}.blsv-kicker{color:#76dce6;font:10px 'DM Mono',monospace;letter-spacing:.12em}.blsv-head h3{margin:7px 0;font-size:clamp(18px,2.4vw,24px);letter-spacing:-.03em;color:#e3f4ff}.blsv-head p,.blsv-card p{margin:5px 0 0;color:#91aabe;font-size:12px;line-height:1.6}.blsv-chip{flex:none;border:1px solid #65d8ce38;border-radius:999px;padding:7px 9px;color:#8ce4d7;font:9px 'DM Mono',monospace}
  .blsv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.blsv-card{min-width:0;padding:13px;border-radius:14px;border:1px solid #a5dfff1b;background:linear-gradient(140deg,#c9f1ff0b,#ffffff03);box-shadow:inset 0 1px #ffffff0d}.blsv-card>small{display:block;color:#7e9eb5;font:9px 'DM Mono',monospace;letter-spacing:.08em}.blsv-card>strong{display:block;color:#dffaff;font-size:20px;margin-top:8px;overflow-wrap:anywhere}.blsv-card h4{margin:0 0 6px;color:#d7effc;font-size:14px}.blsv-wide{margin-top:10px}.blsv-card .scan-table-wrap{max-width:100%;overflow:auto;margin-top:10px}.blsv-card .scan-table{min-width:500px}.blsv-card canvas{max-width:100%}.blsv-card button{margin:8px 0;padding:9px 12px;border:1px solid #80ddf344;border-radius:999px;background:linear-gradient(135deg,#b9f4ff1a,#7cc9e80a);color:#b8f3ff;font-size:11px;box-shadow:inset 0 1px #ffffff14}.blsv-card button:disabled{opacity:.5}
  @media(max-width:600px){.blsv-panel{padding:12px;border-radius:17px;margin-top:12px}.blsv-head{display:block}.blsv-chip{display:inline-block;margin-top:9px}.blsv-grid{gap:8px}.blsv-card{padding:10px}.blsv-card>strong{font-size:17px}.blsv-card p{font-size:11px}.blsv-card .scan-table{min-width:470px}}
  `;
  document.head.appendChild(style);
  const median = values => {
    if (!values.length) return NaN;
    const a = [...values].sort((x,y)=>x-y), m=Math.floor(a.length/2);
    return a.length%2?a[m]:(a[m-1]+a[m])/2;
  };
  const robustSigma = values => {
    const m=median(values);
    return 1.4826*median(values.map(v=>Math.abs(v-m)));
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function csvRows(text) {
    const rows=[];let row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){row.push(cell);cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell="";}else cell+=c;}
    row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
  }
  function parse(text) {
    const rows=csvRows(text);if(rows.length<2)throw Error("No CSV measurements available for validation.");
    const h=rows[0].map(v=>v.trim().toLowerCase());
    const find=names=>h.findIndex(v=>names.some(n=>v===n||v.includes(n)));
    const ti=find(["time","btjd","bjd","jd"]),fi=find(["pdcsap_flux","sap_flux","relative_flux","flux","brightness"]),qi=h.findIndex(v=>v==="quality");
    if(ti<0||fi<0)throw Error("Validation could not identify time/flux columns.");
    const all=rows.slice(1).map((r,i)=>({t:Number(r[ti]),f:Number(r[fi]),q:qi<0?null:Number(r[qi]),row:i+2}))
      .filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.f)&&p.f>0);
    const badQuality=qi<0?0:all.filter(p=>p.q!==0).length;
    const good=all.filter(p=>qi<0||p.q===0).sort((a,b)=>a.t-b.t);
    return {all,good,qualityColumn:qi>=0,badQuality,invalidRows:rows.length-1-all.length,timeColumn:rows[0][ti],fluxColumn:rows[0][fi]};
  }
  function detrend(points,windowDays) {
    const step=windowDays/2,origin=points[0].t,end=points[points.length-1].t,anchors=[];
    for(let center=origin;center<=end+step;center+=step){
      const values=points.filter(p=>Math.abs(p.t-center)<=windowDays/2).map(p=>p.f);
      if(values.length>=8)anchors.push({t:center,v:median(values)});
    }
    if(anchors.length<3){
      const m=median(points.map(p=>p.f));
      return points.map(p=>({...p,y:p.f/m-1}));
    }
    let j=0;
    const output=points.map(p=>{
      while(j<anchors.length-2&&anchors[j+1].t<p.t)j++;
      const a=anchors[j],b=anchors[Math.min(j+1,anchors.length-1)];
      const f=b.t===a.t?0:Math.max(0,Math.min(1,(p.t-a.t)/(b.t-a.t)));
      const baseline=a.v+(b.v-a.v)*f;
      return {...p,y:p.f/Math.max(baseline,1e-12)-1};
    });
    const center=median(output.map(p=>p.y));
    return output.map(p=>({...p,y:p.y-center}));
  }
  function phaseOf(t,c) { return (((t-c.epoch+c.period/2)/c.period)%1+1)%1-.5; }
  function foldMetrics(points,c) {
    const shared=window.AstroLensScienceCore?.eventStats(points,c);
    if(!shared)return {events:[],primaryN:0,secondaryN:0,primaryDepth:NaN,secondaryDepth:NaN,secondarySnr:NaN,oddDepth:NaN,evenDepth:NaN,oddN:0,evenN:0,oddEvenRatio:NaN,oddEvenSigma:NaN,level:NaN,sigma:NaN};
    return {...shared,secondarySnr:shared.secondarySigma,level:shared.baseline,sigma:shared.noise};
  }
  function scoreAtPeriods(points,values,candidates) {
    const nBins=128,scatter=Math.max(robustSigma(values),1e-7);
    let best=0;
    for(const c of candidates){
      const sums=new Float64Array(nBins),counts=new Uint32Array(nBins);
      for(let i=0;i<points.length;i++){
        const phase=((points[i].t-points[0].t)/c.period%1+1)%1;
        const b=Math.min(nBins-1,Math.floor(phase*nBins));
        sums[b]+=values[i];counts[b]++;
      }
      const ps=new Float64Array(nBins*2+1),pc=new Float64Array(nBins*2+1);
      for(let b=0;b<nBins*2;b++){ps[b+1]=ps[b]+sums[b%nBins];pc[b+1]=pc[b]+counts[b%nBins];}
      const base=Math.max(2,Math.round(c.duration/c.period*nBins));
      const widths=[.5,.75,1,1.5,2].map(m=>Math.max(2,Math.min(24,Math.round(base*m))));
      for(const width of widths)for(let start=0;start<nBins;start++){
        const ni=pc[start+width]-pc[start],no=points.length-ni;if(ni<3||no<20)continue;
        const inside=(ps[start+width]-ps[start])/ni,outside=((ps[nBins]-ps[0])-(ps[start+width]-ps[start]))/no;
        const depth=outside-inside;if(depth<=0)continue;
        best=Math.max(best,depth/scatter*Math.sqrt(ni*no/points.length));
      }
    }
    return best;
  }
  function aliasInfo(period,targetText) {
    return window.AstroLensScienceCore?window.AstroLensScienceCore.aliasInfo(period,targetText||$("#mastTarget")?.value||""):{type:"unavailable",label:"Shared alias rules unavailable",error:null,reference:null};
  }
  function drawEventPanels(canvas,points,c,stats) {
    const plotted=stats.events.filter(e=>e.n>0).slice(0,8);if(!canvas||!plotted.length)return;
    const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(300,box.width||600),cols=2,cellW=(w-30)/cols,cellH=92,rows=Math.ceil(plotted.length/cols),h=rows*cellH+8;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    plotted.forEach((event,i)=>{
      const x=10+(i%cols)*cellW,y=8+Math.floor(i/cols)*cellH;
      ctx.strokeStyle="#243b50";ctx.strokeRect(x,y,cellW-8,cellH-12);
      ctx.fillStyle="#9fc4d6";ctx.font="10px monospace";ctx.fillText("Transit "+(event.cycle+1)+" · "+event.epoch.toFixed(3),x+7,y+14);
      const subset=points.filter(p=>Math.abs(p.t-event.epoch)<=Math.max(c.duration*2,c.period*.015));
      const ys=subset.map(p=>p.y),lo=Math.min(...ys,0)-Math.max(c.depth,1e-5)*.5,hi=Math.max(...ys,0)+Math.max(c.depth,1e-5)*.5,span=Math.max(hi-lo,1e-7);
      ctx.strokeStyle="#34546b";ctx.beginPath();ctx.moveTo(x+8,y+cellH-25);ctx.lineTo(x+cellW-18,y+cellH-25);ctx.stroke();
      ctx.fillStyle="#59dfd0";subset.forEach(p=>{const px=x+8+((p.t-event.epoch)/Math.max(c.duration*2,c.period*.015)+1)/2*(cellW-28),py=y+24+(1-(p.y-lo)/span)*(cellH-53);ctx.beginPath();ctx.arc(px,py,1.6,0,Math.PI*2);ctx.fill();});
    });
  }
  function render(result,csvText,fileName) {
    window.__astrolensLastBLS=result;
    const host=$("#blsResults");if(!host||!result?.unique?.length)return;
    host.querySelectorAll(".bls-summary").forEach(el=>{if(el.textContent.includes("Known-system period comparison"))el.remove();});
    let parsed;try{parsed=parse(csvText);}catch(e){host.insertAdjacentHTML("beforeend",'<p class="science-note">'+esc(e.message)+'</p>');return;}
    const points=result.points,top=result.unique[0],stats=foldMetrics(points,top);
    const core=window.AstroLensScienceCore;
    const nullTest=core?core.blockBootstrap(points,result.unique,199,10):{p:null,n:0,exceed:0};
    const injection=core?core.injectionRecovery(points,top,200):{n:0,levels:[],fraction:null};
    const modes=[.5,1,2].map(w=>{const p=detrend(parsed.good,w),search=core?core.quickSearch(p,result.minP,result.maxP,result.baseline,300):{candidates:[],trialCount:0};const lead=search.candidates[0]||null;return {window:w,points:p,search,lead,depth:lead?.depth??NaN,snr:lead?.snr??NaN,period:lead?.period??NaN,agrees:!!lead&&Math.abs(lead.period-top.period)/top.period<=.02};});
    const target=(($("#mastTarget")?.value||"")+" "+(fileName||"")).toLowerCase();
    const hasTrappist=/trappist\s*[- ]?1|tic\s*278892590/.test(target);
    const quality=parsed.qualityColumn?"QUALITY flags applied: "+parsed.badQuality.toLocaleString()+" rejected, "+parsed.good.length.toLocaleString()+" retained.":"No QUALITY column found. No flagged points could be excluded.";
    const metadata=[];
    const filenameTic=(fileName||"").match(/-s\d{4}-(\d{16})-/i);
    const tic=(target.match(/tic\s*[-_ ]?(\d+)/i)||fileName?.match(/tic(\d+)/i)||(filenameTic?[filenameTic[0],filenameTic[1].replace(/^0+/,"")]:[]))[1];
    if(tic)metadata.push(["TIC identifier","TIC "+tic]);
    const sectors=[...new Set([...(fileName||"").matchAll(/-s(\d{4})-/gi)].map(m=>Number(m[1])))];
    metadata.push(["TESS sector(s)",sectors.length?sectors.map(n=>String(n).padStart(4,"0")).join(", "):"Not embedded in CSV filename"]);
    const fitsMeta=window.__astrolensFitsMeta||{};
    const metaOrigin=fitsMeta&&Object.keys(fitsMeta).length?"Original FITS metadata retained with this dataset":"CSV input; FITS headers were not read";
    metadata.push(["Metadata provenance",metaOrigin]);
    metadata.push(["CROWDSAP",fitsMeta.crowdsap!==null&&fitsMeta.crowdsap!==undefined?String(fitsMeta.crowdsap):"Unavailable from this input"]);
    metadata.push(["Stellar radius",fitsMeta.stellarRadius!==null&&fitsMeta.stellarRadius!==undefined?String(fitsMeta.stellarRadius)+" (source header units)": "Unavailable from this input"]);
    metadata.push(["Stellar effective temperature",fitsMeta.teff!==null&&fitsMeta.teff!==undefined?String(fitsMeta.teff)+" K":"Unavailable from this input"]);
    if(fitsMeta.sector!==null&&fitsMeta.sector!==undefined)metadata[1]=["TESS sector(s)",String(fitsMeta.sector)];
    if(fitsMeta.ticId!==null&&fitsMeta.ticId!==undefined&&!tic)metadata[0]=["TIC identifier","TIC "+fitsMeta.ticId];
    const aliasRows=result.unique.map(c=>{const a=aliasInfo(c.period,target);return "<tr><td>"+c.period.toFixed(6)+" d</td><td>"+esc(a.label)+"</td><td>"+(a.reference?a.reference.toFixed(6)+" d":"—")+"</td><td>"+(a.error<=.01?(a.error*100).toFixed(2)+"%":"—")+"</td><td>"+(a.type==="known"?"Known-period proximity":a.type==="alias"?"Possible harmonic/half-period alias":"No close ratio")+"</td></tr>";}).join("");
    const validationReport={generatedAt:new Date().toISOString(),sourceFile:fileName||null,target:target||null,sourceMetadata:metaOrigin,input:{timeColumn:parsed.timeColumn,fluxColumn:parsed.fluxColumn,qualityColumn:parsed.qualityColumn,qualityRemoved:parsed.badQuality,invalidRows:parsed.invalidRows,acceptedRows:parsed.good.length},leadingCandidate:top,diagnostics:stats,blockResampledNullTest:nullTest,injectionRecovery:injection,detrendingReSearch:modes.map(m=>({windowDays:m.window,trialCount:m.search.trialCount,leadingCandidate:m.lead,agreesWithinTwoPercent:m.agrees})),knownPeriodAliases:result.unique.map(c=>({period:c.period,...aliasInfo(c.period,target)})),eventCoverage:stats.events,metadata:metadata};
    const eventRows=stats.events.slice(0,24).map(e=>"<tr><td>"+e.cycle+"</td><td>"+e.epoch.toFixed(6)+"</td><td>"+e.n+"</td><td>"+(Number.isFinite(e.depth)?(e.depth*1e6).toFixed(0)+" ppm":"—")+"</td><td>"+(Number.isFinite(e.uncertainty)?(e.uncertainty*1e6).toFixed(0)+" ppm":"—")+"</td><td>"+e.status+"</td></tr>").join("");
    const oddPass=stats.oddN>=3&&stats.evenN>=3&&Number.isFinite(stats.oddEvenSigma)&&Math.abs(stats.oddEvenSigma)<3;
    const secondaryFlag=Number.isFinite(stats.secondaryDepth)&&stats.secondaryDepth>0&&stats.secondarySnr>=3;
    const pText=nullTest.p===null?"Unavailable":nullTest.p.toFixed(3)+" ("+nullTest.exceed+"/"+nullTest.n+" block-resampled maxima)";
    const modeRows=modes.map(m=>"<tr><td>"+m.window.toFixed(1)+" d</td><td>"+(Number.isFinite(m.period)?m.period.toFixed(5)+" d":"No peak")+"</td><td>"+(Number.isFinite(m.depth)?(m.depth*1e6).toFixed(0)+" ppm":"—")+"</td><td>"+(Number.isFinite(m.snr)?m.snr.toFixed(1):"—")+"</td><td>"+m.search.trialCount+"</td><td>"+(m.agrees?"Within 2% of leading period":"Period shifted / no match")+"</td></tr>").join("");
    const injectionRows=injection.levels.map(x=>"<tr><td>"+x.mult.toFixed(1)+"×</td><td>"+(x.depth*1e6).toFixed(0)+" ppm</td><td>"+x.recovered+"/"+x.n+"</td><td>"+(Number.isFinite(x.fraction)?(x.fraction*100).toFixed(1)+"%":"—")+"</td></tr>").join("");
    host.insertAdjacentHTML("beforeend",`
      <section class="blsv-panel" id="blsValidationPanel">
        <div class="blsv-head"><div><div class="blsv-kicker">VALIDATION SUITE · BLS / 02</div><h3>Candidate vetting, not just peak ranking</h3><p>Diagnostics below evaluate the leading period against repeatability, secondary events, aliases and alternate detrending. None independently confirms a planet.</p></div><div><span class="blsv-chip">EVIDENCE CHECKS</span><button id="blsvExport" type="button">Export validation JSON ↓</button></div></div>
        <div class="blsv-grid">
          <article class="blsv-card"><small>QUALITY FLAGS</small><strong>${parsed.qualityColumn?parsed.badQuality.toLocaleString()+" removed":"Not supplied"}</strong><p>${esc(quality)}</p></article>
          <article class="blsv-card"><small>ODD / EVEN DEPTH</small><strong>${Number.isFinite(stats.oddEvenSigma)?Math.abs(stats.oddEvenSigma).toFixed(1)+"σ difference":"Insufficient data"}</strong><p>Odd ${Number.isFinite(stats.oddDepth)?(stats.oddDepth*1e6).toFixed(0)+" ± "+(stats.oddErr*1e6).toFixed(0)+" ppm":"n/a"} (${stats.oddN} events), even ${Number.isFinite(stats.evenDepth)?(stats.evenDepth*1e6).toFixed(0)+" ± "+(stats.evenErr*1e6).toFixed(0)+" ppm":"n/a"} (${stats.evenN} events); depth ratio ${Number.isFinite(stats.oddEvenRatio)?stats.oddEvenRatio.toFixed(2):"n/a"}. ${oddPass?"Difference is below 3σ under this approximate uncertainty model; not a planet confirmation.":"Depth difference or coverage is concerning / inconclusive."}</p></article>
          <article class="blsv-card"><small>SECONDARY ECLIPSE · PHASE 0.5</small><strong>${Number.isFinite(stats.secondaryDepth)?(stats.secondaryDepth*1e6).toFixed(0)+" ppm":"Not measurable"}</strong><p>${stats.secondaryN} points near phase 0.5 · approx S/N ${Number.isFinite(stats.secondarySnr)?stats.secondarySnr.toFixed(1):"n/a"}. ${secondaryFlag?"A secondary-like dip is present and warrants false-positive review.":"No significant secondary-like dip under this simple test; absence is not proof of a planet."}</p></article>
          <article class="blsv-card"><small>PERMUTATION NULL TEST</small><strong>${pText}</strong><p>${nullTest.n} block-resampled trials against only the top three periods. This is a restricted, approximate conditional null score, not a global false-alarm probability and not fully red-noise-safe.</p></article>
        </div>
        <article class="blsv-card blsv-wide"><h4>Known-system ratios · tight 1% tolerance</h4><p>Compares every top peak against all seven published TRAPPIST-1 periods. Only exact-period proximity or half/integer ratios within 1% are flagged.</p><div class="scan-table-wrap"><table class="scan-table"><thead><tr><th>BLS period</th><th>Nearest relationship</th><th>Reference period</th><th>Deviation</th><th>Interpretation</th></tr></thead><tbody>${hasTrappist?aliasRows:result.unique.map(c=>"<tr><td>"+c.period.toFixed(6)+" d</td><td>Target not recognized as TRAPPIST-1</td><td>—</td><td>—</td><td>Known-system comparison not run</td></tr>").join("")}</tbody></table></div></article>
        <article class="blsv-card blsv-wide"><h4>Independent re-search by detrending window</h4><p>Each window runs a separate coarse BLS grid over the same period range. This is an independent screening re-search with 300 trial frequencies per window, not the full-resolution primary grid.</p><div class="scan-table-wrap"><table class="scan-table"><thead><tr><th>Window</th><th>Leading period</th><th>Depth</th><th>Approx SNR</th><th>Trials</th><th>Comparison</th></tr></thead><tbody>${modeRows}</tbody></table></div></article>
        <article class="blsv-card blsv-wide"><h4>Individual transit inspection</h4><p>All predicted cycles are listed, including missing coverage. Event depths can be negative and should not be hidden. The panel grid only plots covered events.</p><canvas id="blsEventCanvas" style="display:block;width:100%;height:auto" aria-label="Individual transit event panels"></canvas><div class="scan-table-wrap"><table class="scan-table"><thead><tr><th>Cycle</th><th>Predicted epoch</th><th>Points</th><th>Estimated depth</th><th>Approx. error</th><th>Coverage</th></tr></thead><tbody>${eventRows||"<tr><td colspan='6'>No predicted events.</td></tr>"}</tbody></table></div></article>
        <article class="blsv-card blsv-wide"><h4>Injection-recovery · fixed-period diagnostic</h4><p>${injection.n} randomized-epoch box signals were injected into residuals after subtracting the current candidate box. This measures fixed-period recoverability at three depths, not blind-search completeness or false-alarm probability.</p><div class="scan-table-wrap"><table class="scan-table"><thead><tr><th>Injected depth</th><th>Depth</th><th>Recovered</th><th>Recovery rate</th></tr></thead><tbody>${injectionRows}</tbody></table></div></article>
        <article class="blsv-card blsv-wide"><h4>Target metadata & provenance</h4><p>FITS metadata is shown only when the original FITS file or its retained metadata is available. A CSV by itself cannot supply FITS headers. TIC values are a separate catalogue query.</p><button id="blsvFetchTic" type="button">Fetch TIC stellar metadata ↗</button><p id="blsvTicStatus" class="science-note">TIC lookup is on demand. It may return multiple nearby stars; verify the identifier and separation.</p><div id="blsvTicDetails"></div><div class="scan-table-wrap"><table class="scan-table"><tbody>${metadata.map(x=>"<tr><th>"+esc(x[0])+"</th><td>"+esc(x[1])+"</td></tr>").join("")}<tr><th>Input columns</th><td>${esc(parsed.timeColumn)} / ${esc(parsed.fluxColumn)}${parsed.qualityColumn?" / QUALITY":""}</td></tr><tr><th>Invalid time/flux rows</th><td>${parsed.invalidRows}</td></tr><tr><th>Source file</th><td>${esc(fileName||"Local CSV/FITS conversion")}</td></tr></tbody></table></div><p>Stellar radius and CROWDSAP are not guessed from light-curve shape. Obtain target metadata and aperture contamination before converting transit depth into planet radius.</p></article>
      </section>`);
    drawEventPanels($("#blsEventCanvas"),points,top,stats);
    drawTransitModel($("#blsFoldCanvas"),top);
    $("#blsvFetchTic")?.addEventListener("click",()=>fetchTicMetadata());
    const autoTic=fitsMeta.ticId??(filenameTic?filenameTic[1].replace(/^0+/,""):null);
    if(autoTic)fetchTicMetadata("TIC "+autoTic);
    $("#blsvExport")?.addEventListener("click",()=>downloadTextFile(JSON.stringify(validationReport,null,2),"astrolens-validation-"+new Date().toISOString().slice(0,10)+".json","application/json"));
  }
  async function fetchTicMetadata(targetOverride) {
    const button=$("#blsvFetchTic"),status=$("#blsvTicStatus"),out=$("#blsvTicDetails");
    if(!button||!status||!out)return;
    const target=(($("#mastTarget")?.value||"").trim()||$("#lightCurveFile")?.files?.[0]?.name||"");
    if(!target){status.textContent="Enter a target name or TIC identifier in Light Curve Lab first.";return;}
    button.disabled=true;button.textContent="Querying MAST TIC…";status.textContent="Resolving target coordinates, then querying the public TESS Input Catalog…";
    try{
      const invoke=async payload=>{
        const url="https://mast.stsci.edu/api/v0/invoke?request="+encodeURIComponent(JSON.stringify(payload));
        const response=await fetch(url,{headers:{Accept:"application/json"}});
        if(!response.ok)throw Error("MAST returned HTTP "+response.status);
        const data=await response.json();
        if(data.status&&data.status!=="COMPLETE")throw Error(data.msg||"MAST query did not complete.");
        return data;
      };
      const lookup=await invoke({service:"Mast.Name.Lookup",params:{input:target,format:"json"}});
      const coord=(lookup.resolvedCoordinate||[])[0];
      if(!coord||!Number.isFinite(Number(coord.ra))||!Number.isFinite(Number(coord.decl)))throw Error("MAST could not resolve this target. Try its TIC identifier.");
      const response=await invoke({service:"Mast.Catalogs.Tic.Cone",params:{ra:Number(coord.ra),dec:Number(coord.decl),radius:0.003},format:"json",pagesize:50,page:1});
      const records=response.data||[];
      if(!records.length)throw Error("No TIC sources were returned within 0.003 degrees of the resolved coordinate.");
      const selected=records.slice().sort((a,b)=>(Number(a.distance)||Infinity)-(Number(b.distance)||Infinity))[0];
      const fields=[["TIC ID",selected.ID!==undefined?"TIC "+selected.ID:"Unavailable"],["Separation",selected.distance!==undefined?String(selected.distance)+" (archive distance units)":"Not supplied"],["Stellar radius",selected.rad!==undefined&&selected.rad!==null?String(selected.rad)+" R☉":"Not supplied"],["Stellar mass",selected.mass!==undefined&&selected.mass!==null?String(selected.mass)+" M☉":"Not supplied"],["Effective temperature",selected.Teff!==undefined&&selected.Teff!==null?String(selected.Teff)+" K":"Not supplied"],["TESS magnitude",selected.Tmag!==undefined&&selected.Tmag!==null?String(selected.Tmag):"Not supplied"],["Gaia identifier",selected.GAIA!==undefined?String(selected.GAIA):"Not supplied"],["2MASS identifier",selected.TWOMASS!==undefined?String(selected.TWOMASS):"Not supplied"],["Object type",selected.objType||selected.type||"Not supplied"]];
      out.innerHTML='<div class="scan-table-wrap"><table class="scan-table"><tbody>'+fields.map(x=>"<tr><th>"+esc(x[0])+"</th><td>"+esc(x[1])+"</td></tr>").join("")+'</tbody></table></div>';
      status.textContent="TIC query returned "+records.length+" nearby source(s). The closest row is shown, not automatically asserted to be the correct host star. Verify its identifier and separation.";
      status.className="science-note";
    }catch(error){status.textContent="TIC metadata unavailable: "+(error.message||"query failed")+". Existing light-curve diagnostics remain available.";status.className="science-note";}
    finally{button.disabled=false;button.textContent="Fetch TIC stellar metadata ↗";}
  }
  function drawTransitModel(canvas,c) {
    if(!canvas||!c)return;
    const ctx=canvas.getContext("2d"),w=canvas.clientWidth||canvas.width,h=canvas.clientHeight||230;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr))return;
    const L=42,R=w-12,T=18,B=h-32,frac=Math.min(.45,c.duration/c.period/2);
    const folded=c;
    const rows=document.querySelectorAll("#blsFoldCanvas");
    if(!rows.length)return;
    const phasePts=window.__astrolensLastBLS?.points||[];
    const values=phasePts.map(p=>p.y).sort((a,b)=>a-b);
    if(!values.length)return;
    const lo=values[Math.floor(values.length*.02)],hi=values[Math.floor(values.length*.98)],span=Math.max(hi-lo,1e-6);
    const y0=T+(1-(0-lo)/span)*(B-T),y1=T+(1-(-c.depth-lo)/span)*(B-T);
    ctx.strokeStyle="#f0c879";ctx.lineWidth=2.2;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(L,y0);ctx.lineTo(L+(0.5-frac)*(R-L),y0);ctx.lineTo(L+(0.5-frac)*(R-L),y1);ctx.lineTo(L+(0.5+frac)*(R-L),y1);ctx.lineTo(L+(0.5+frac)*(R-L),y0);ctx.lineTo(R,y0);ctx.stroke();
  }
  window.AstroLensValidation={render};
})();