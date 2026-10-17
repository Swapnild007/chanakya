/* AstroLens shared scientific primitives. Common definitions keep every panel numerically consistent.
   These are screening diagnostics, not a validated transit-confirmation pipeline. */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.AstroLensScienceCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const KNOWN=[
    {name:"TRAPPIST-1 b",period:1.510826},{name:"TRAPPIST-1 c",period:2.421937},
    {name:"TRAPPIST-1 d",period:4.049219},{name:"TRAPPIST-1 e",period:6.101013},
    {name:"TRAPPIST-1 f",period:9.207540},{name:"TRAPPIST-1 g",period:12.352446},
    {name:"TRAPPIST-1 h",period:18.772866}
  ];
  function median(values){if(!values||!values.length)return NaN;const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return NaN;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function robustSigma(values){const a=values.filter(Number.isFinite),m=median(a);return 1.4826*median(a.map(x=>Math.abs(x-m)));}
  function phaseOf(t,c){return (((t-c.epoch+c.period/2)/c.period)%1+1)%1-.5;}
  function eventStats(points,c){
    if(!points?.length||!c||!(c.period>0)||!(c.duration>0))return {events:[],oddDepth:NaN,evenDepth:NaN,oddEvenRatio:NaN,oddEvenSigma:NaN,oddN:0,evenN:0,secondaryDepth:NaN,secondarySigma:NaN,primaryDepth:NaN,primarySigma:NaN,baseline:NaN,noise:NaN};
    const ordered=points.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.y)).slice().sort((a,b)=>a.t-b.t);
    const half=Math.max(c.duration/(2*c.period),.003),primary=ordered.filter(p=>Math.abs(phaseOf(p.t,c))<=half);
    const secondary=ordered.filter(p=>Math.abs(Math.abs(phaseOf(p.t,c))-.5)<=half);
    const outside=ordered.filter(p=>Math.abs(phaseOf(p.t,c))>Math.max(half*2,.04)&&Math.abs(Math.abs(phaseOf(p.t,c))-.5)>Math.max(half*2,.04));
    const baseline=median(outside.map(p=>p.y)),noise=Math.max(robustSigma(outside.map(p=>p.y)),1e-8);
    const depthFor=ps=>ps.length?baseline-median(ps.map(p=>p.y)):NaN;
    const errFor=ps=>ps.length&&outside.length?noise*Math.sqrt(1/ps.length+1/outside.length):NaN;
    const cycles=ordered.length?Array.from({length:Math.max(0,Math.floor((ordered[ordered.length-1].t-c.epoch)/c.period)-Math.ceil((ordered[0].t-c.epoch)/c.period)+1)},(_,i)=>i+Math.ceil((ordered[0].t-c.epoch)/c.period)):[];
    const events=cycles.map(cycle=>{
      const epoch=c.epoch+cycle*c.period,ps=ordered.filter(p=>Math.abs(p.t-epoch)<=Math.max(c.duration*.75,c.period*.003));
      const depth=depthFor(ps),uncertainty=errFor(ps);
      return {cycle,epoch,n:ps.length,depth,uncertainty,status:ps.length===0?"NO COVERAGE":ps.length<3?"SPARSE":"SAMPLED",odd:Math.abs(cycle%2)===1};
    });
    const usable=events.filter(e=>e.n>=3&&Number.isFinite(e.depth)&&Number.isFinite(e.uncertainty));
    const odd=usable.filter(e=>e.odd),even=usable.filter(e=>!e.odd);
    const oddDepth=median(odd.map(e=>e.depth)),evenDepth=median(even.map(e=>e.depth));
    const groupErr=group=>group.length?Math.sqrt(group.reduce((s,e)=>s+e.uncertainty**2,0))/group.length:NaN;
    const oddErr=groupErr(odd),evenErr=groupErr(even);
    const oddEvenSigma=Number.isFinite(oddDepth)&&Number.isFinite(evenDepth)&&Number.isFinite(oddErr)&&Number.isFinite(evenErr)&&Math.hypot(oddErr,evenErr)>0?(oddDepth-evenDepth)/Math.hypot(oddErr,evenErr):NaN;
    const ratio=Number.isFinite(oddDepth)&&Number.isFinite(evenDepth)&&oddDepth>0&&evenDepth>0?Math.min(oddDepth,evenDepth)/Math.max(oddDepth,evenDepth):NaN;
    const secondaryDepth=depthFor(secondary),secondarySigma=Number.isFinite(secondaryDepth)&&Number.isFinite(errFor(secondary))&&errFor(secondary)>0?secondaryDepth/errFor(secondary):NaN;
    const eventDepthScatter=robustSigma(usable.map(e=>e.depth));
    return {events,oddDepth,evenDepth,oddN:odd.length,evenN:even.length,oddErr,evenErr,oddEvenSigma,oddEvenRatio:ratio,primaryDepth:depthFor(primary),primarySigma:depthFor(primary)/Math.max(errFor(primary),1e-12),primaryN:primary.length,secondaryDepth,secondarySigma,secondaryN:secondary.length,baseline,noise,eventDepthScatter,usableEvents:usable.length,totalExpectedEvents:cycles.length};
  }
  function aliasInfo(period,target){
    if(!/trappist\s*[- ]?1|tic\s*278892590/i.test(String(target||"")))return {type:"not-run",label:"Target not identified as TRAPPIST-1",error:null,reference:null};
    const exact=KNOWN.map(p=>({...p,error:Math.abs(period-p.period)/p.period})).sort((a,b)=>a.error-b.error)[0];
    if(exact&&exact.error<=.01)return {type:"known",label:exact.name,error:exact.error,reference:exact.period,ratio:period/exact.period};
    let best={error:Infinity,label:"No match within 1%",ratio:null,reference:null};
    for(const p of KNOWN)for(const targetRatio of [.5,1.5,2,3]){
      const ratio=period/p.period,error=Math.abs(ratio-targetRatio)/targetRatio;
      if(error<best.error)best={error,label:p.name+" × "+targetRatio,ratio,reference:p.period};
    }
    return best.error<=.01?{type:"alias",...best}:{type:"none",...best,label:"No match within 1%"};
  }
  function qualitySummary(rows,headers){
    const h=headers.map(x=>String(x).trim().toLowerCase()),qi=h.findIndex(x=>x==="quality");
    let finite=0,flagged=0,missingQuality=0;
    for(const r of rows){const t=Number(r.time),f=Number(r.flux),q=qi<0?null:Number(r.quality);if(Number.isFinite(t)&&Number.isFinite(f)&&f>0){finite++;if(qi>=0&&q!==0)flagged++;if(qi>=0&&!Number.isFinite(q))missingQuality++;}}
    return {qualityColumn:qi>=0,finite,flagged,missingQuality,accepted:finite-flagged};
  }
  function removeCandidateBox(points,c){
    if(!c||!(c.period>0)||!(c.depth>0))return points.map(p=>({...p}));
    const half=Math.max(c.duration/(2*c.period),.003);
    return points.map(p=>({...p,y:p.y+(Math.abs(phaseOf(p.t,c))<=half?c.depth:0)}));
  }
  function blockBootstrap(points,candidates,trials=199,blockSize=10){
    if(points.length<100||!candidates.length)return {n:0,exceed:0,p:null,observed:NaN,method:"unavailable"};
    const values=points.map(p=>p.y),top=candidates.slice(0,3),observed=scoreAtPeriods(points,values,top),primary=top[0];
    const residual=removeCandidateBox(points,primary).map(p=>p.y);
    let seed=92821,exceed=0;const rand=()=>{seed=(seed*48271)%2147483647;return seed/2147483647;};
    const n=Math.max(1,Math.floor(blockSize)),blocks=[];
    for(let i=0;i<residual.length;i+=n)blocks.push(residual.slice(i,Math.min(i+n,residual.length)));
    for(let k=0;k<trials;k++){
      const order=blocks.slice();for(let i=order.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      const trial=order.flat().slice(0,values.length);
      if(scoreAtPeriods(points,trial,top)>=observed)exceed++;
    }
    return {n:trials,exceed,p:(1+exceed)/(trials+1),observed,method:"block-resampled residuals after subtracting the leading box, evaluated only at the top three candidate periods"};
  }
  function scoreAtPeriods(points,values,candidates){
    const bins=128,scatter=Math.max(robustSigma(values),1e-7);let best=0;
    for(const c of candidates){
      const sums=new Float64Array(bins),counts=new Uint32Array(bins);
      for(let i=0;i<points.length;i++){const ph=((points[i].t-points[0].t)/c.period%1+1)%1,b=Math.min(bins-1,Math.floor(ph*bins));sums[b]+=values[i];counts[b]++;}
      const ps=new Float64Array(bins*2+1),pc=new Float64Array(bins*2+1);
      for(let b=0;b<bins*2;b++){ps[b+1]=ps[b]+sums[b%bins];pc[b+1]=pc[b]+counts[b%bins];}
      const base=Math.max(2,Math.round(c.duration/c.period*bins)),widths=[.5,.75,1,1.5,2].map(m=>Math.max(2,Math.min(24,Math.round(base*m))));
      for(const width of widths)for(let s=0;s<bins;s++){const ni=pc[s+width]-pc[s],no=points.length-ni;if(ni<3||no<20)continue;const si=ps[s+width]-ps[s],so=ps[bins]-ps[0]-si,depth=so/no-si/ni;if(depth>0)best=Math.max(best,depth/scatter*Math.sqrt(ni*no/points.length));}
    }
    return best;
  }
  function quickSearch(points,minP,maxP,baseline,trialCount=300){
    if(!points||points.length<100||!(maxP>minP))return {candidates:[],trialCount:0};
    const bins=128,durations=[.025,.04,.06,.085,.12,.17],scatter=Math.max(robustSigma(points.map(p=>p.y)),1e-7),out=[];
    const t0=points[0].t;
    for(let k=0;k<trialCount;k++){
      const freq=1/maxP+(1/minP-1/maxP)*k/(trialCount-1),period=1/freq,sums=new Float64Array(bins),counts=new Uint32Array(bins);
      for(const p of points){let ph=((p.t-t0)*freq)%1;if(ph<0)ph++;const b=Math.min(bins-1,Math.floor(ph*bins));sums[b]+=p.y;counts[b]++;}
      const ps=new Float64Array(bins*2+1),pc=new Float64Array(bins*2+1);
      for(let b=0;b<bins*2;b++){ps[b+1]=ps[b]+sums[b%bins];pc[b+1]=pc[b]+counts[b%bins];}
      let best=null;
      for(const d of durations){const width=Math.max(2,Math.min(Math.floor(bins*.22),Math.round(bins*d/period)));if(width>=bins*.24)continue;
        for(let s=0;s<bins;s++){const ni=pc[s+width]-pc[s],no=points.length-ni;if(ni<3||no<20)continue;const si=ps[s+width]-ps[s],depth=(ps[bins]-ps[0]-si)/no-si/ni;if(depth<=0)continue;const snr=depth/scatter*Math.sqrt(ni*no/points.length);if(!best||snr>best.snr)best={period,epoch:t0+((((s+width/2)/bins)%1)/freq),duration:width/bins*period,depth,snr,cycles:baseline/period};}
      }
      if(best)out.push(best);
    }
    out.sort((a,b)=>b.snr-a.snr);const unique=[];
    for(const x of out)if(unique.every(y=>Math.abs(y.period-x.period)/Math.min(y.period,x.period)>.02)){unique.push(x);if(unique.length===5)break;}
    return {candidates:unique,trialCount};
  }
  function injectionRecovery(points,c,trials=200){
    if(points.length<100||!c||!(c.depth>0)||!(c.period>0))return {n:0,recovered:0,fraction:null,levels:[],method:"unavailable"};
    const ordered=points.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.y)).slice().sort((a,b)=>a.t-b.t),times=ordered.map(p=>p.t),span=times[times.length-1]-times[0];
    const width=Math.max(c.duration/2,c.period*.003),levels=[.5,1,2].map(mult=>({mult,depth:c.depth*mult,n:0,recovered:0}));
    const residual=removeCandidateBox(ordered,c);
    let seed=61957;const rand=()=>{seed=(seed*48271)%2147483647;return seed/2147483647;};
    for(let k=0;k<trials;k++){
      const level=levels[k%levels.length];level.n++;const epoch=times[0]+rand()*Math.max(span-c.period,0),inside=[],outside=[];
      for(const p of residual){const ph=Math.abs((((p.t-epoch+c.period/2)/c.period)%1+1)%1-.5);(ph*c.period<=width?inside:outside).push(p.y-(ph*c.period<=width?level.depth:0));}
      const depth=median(outside)-median(inside),noise=Math.max(robustSigma(outside),1e-8),snr=depth/(noise*Math.sqrt(1/Math.max(1,inside.length)+1/Math.max(1,outside.length)));
      if(Number.isFinite(depth)&&depth>=level.depth*.5&&snr>=2)level.recovered++;
    }
    levels.forEach(x=>x.fraction=x.n?x.recovered/x.n:null);
    return {n:trials,recovered:levels.reduce((s,x)=>s+x.recovered,0),fraction:levels.reduce((s,x)=>s+x.recovered,0)/trials,levels,method:"fixed-period, randomized-epoch injections into residuals after subtracting the current box; not a blind full-search completeness estimate"};
  }
  return {KNOWN,median,robustSigma,phaseOf,eventStats,aliasInfo,blockBootstrap,injectionRecovery,qualitySummary,quickSearch,removeCandidateBox};
});
