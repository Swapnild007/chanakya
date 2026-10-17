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
  const TESS_QUALITY_MASK=175;
  const TESS_QUALITY_BITS=[
    {bit:1,name:"Attitude tweak"},{bit:2,name:"Safe mode"},{bit:4,name:"Coarse point"},{bit:8,name:"Earth point"},
    {bit:16,name:"Argabrightening"},{bit:32,name:"Desaturation"},{bit:64,name:"Cosmic ray in aperture"},
    {bit:128,name:"Manual exclude"},{bit:256,name:"Discontinuity"},{bit:512,name:"Stray light"},
    {bit:1024,name:"Low sky level"},{bit:2048,name:"Rolling band 1"},{bit:4096,name:"Rolling band 2"},
    {bit:8192,name:"Rolling band 3"},{bit:16384,name:"Rolling band 4"},{bit:32768,name:"Rolling band 5"}
  ];
  function tessQualitySummary(values,mask=TESS_QUALITY_MASK){
    const valid=values.filter(v=>Number.isFinite(Number(v))).map(v=>Number(v)>>>0);
    const missing=values.length-valid.length;
    const rejected=valid.filter(v=>(v&mask)!==0).length;
    const retained=valid.length-rejected;
    const bits=TESS_QUALITY_BITS.map(b=>({...b,count:valid.filter(v=>(v&b.bit)!==0).length,excludedByDefaultMask:(mask&b.bit)!==0})).filter(b=>b.count>0);
    return {mask,valid:valid.length,missing,rejected,retained,bits,policy:"TESS default quality bitmask 175; excluded if (QUALITY & 175) !== 0. Per-bit counts overlap and must not be summed."};
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

  function eventDepthConsistency(stats){
    const events=(stats?.events||[]).filter(e=>e.n>=3&&Number.isFinite(e.depth)&&Number.isFinite(e.uncertainty)&&e.uncertainty>0);
    const n=events.length,dof=n-1;
    if(n<2)return {n,chiSquare:null,degreesFreedom:0,reducedChiSquare:null,critical95:null,consistent:null};
    const weights=events.map(e=>1/(e.uncertainty*e.uncertainty));
    const mean=events.reduce((s,e,i)=>s+e.depth*weights[i],0)/weights.reduce((a,b)=>a+b,0);
    const chiSquare=events.reduce((s,e,i)=>s+((e.depth-mean)/e.uncertainty)**2,0);
    const critical95=dof*Math.pow(1-2/(9*dof)+1.645*Math.sqrt(2/(9*dof)),3);
    return {n,weightedMeanDepth:mean,chiSquare,degreesFreedom:dof,reducedChiSquare:chiSquare/dof,critical95,consistent:chiSquare<=critical95,
      method:"Approximate weighted chi-square against one shared depth; 95% upper critical value uses Wilson-Hilferty approximation."};
  }
  function denseRefine(points,candidates,baseline,spanFraction=.02,steps=201){
    if(!points?.length||!candidates?.length)return [];
    const ordered=points.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.y)).slice().sort((a,b)=>a.t-b.t);
    if(ordered.length<100)return candidates;
    const t0=ordered[0].t,bins=128,noise=Math.max(robustSigma(ordered.map(p=>p.y)),1e-7);
    return candidates.map(candidate=>{
      const lo=Math.max(candidate.period*(1-spanFraction),.0001),hi=candidate.period*(1+spanFraction);
      let best=null;
      for(let k=0;k<steps;k++){
        const period=lo+(hi-lo)*k/(steps-1),freq=1/period,sums=new Float64Array(bins),counts=new Uint32Array(bins);
        for(const p of ordered){let ph=((p.t-t0)*freq)%1;if(ph<0)ph++;const b=Math.min(bins-1,Math.floor(ph*bins));sums[b]+=p.y;counts[b]++;}
        const ps=new Float64Array(bins*2+1),pc=new Float64Array(bins*2+1);
        for(let b=0;b<bins*2;b++){ps[b+1]=ps[b]+sums[b%bins];pc[b+1]=pc[b]+counts[b%bins];}
        const width=Math.max(2,Math.min(Math.floor(bins*.22),Math.round(bins*candidate.duration/period)));
        for(let s=0;s<bins;s++){
          const ni=pc[s+width]-pc[s],no=ordered.length-ni;if(ni<3||no<20)continue;
          const si=ps[s+width]-ps[s],depth=(ps[bins]-ps[0]-si)/no-si/ni;if(depth<=0)continue;
          const snr=depth/noise*Math.sqrt(ni*no/ordered.length);
          if(!best||snr>best.snr)best={...candidate,period,epoch:t0+((((s+width/2)/bins)%1)/freq),duration:width/bins*period,depth,snr,nIn:ni,cycles:baseline/period,denseGrid:{minPeriod:lo,maxPeriod:hi,steps,selectedIndex:k}};
        }
      }
      return best||candidate;
    }).sort((a,b)=>b.snr-a.snr);
  }
  function wilsonInterval(successes,total,z=1.96){
    if(!(total>0))return {low:null,high:null};
    const p=successes/total,z2=z*z,den=1+z2/total,center=(p+z2/(2*total))/den;
    const half=z*Math.sqrt(p*(1-p)/total+z2/(4*total*total))/den;
    return {low:Math.max(0,center-half),high:Math.min(1,center+half)};
  }
  function injectionRecovery(points,c,trialsPerDepth=50,nullTrials=100){
    if(!points?.length||points.length<100||!c||!(c.period>0)||!(c.duration>0))return {n:0,recovered:0,fraction:null,levels:[],method:"unavailable"};
    const ordered=points.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.y)).slice().sort((a,b)=>a.t-b.t);
    const times=ordered.map(p=>p.t),t0=times[0],span=times[times.length-1]-t0;
    const width=Math.max(c.duration/2,c.period*.003),bins=256;
    const levels=Array.from({length:30},(_,i)=>({ppm:(i+1)*100,depth:(i+1)*100/1e6,n:0,recovered:0,ci95:{low:null,high:null}}));
    const residual=removeCandidateBox(ordered,c),noise=Math.max(robustSigma(residual.map(p=>p.y)),1e-8);
    let seed=61957;const rand=()=>{seed=(seed*48271)%2147483647;return seed/2147483647;};
    const phaseDistance=(a,b)=>{const d=Math.abs(a-b)%1;return Math.min(d,1-d);};
    function bestAtFixedPeriod(values){
      const sums=new Float64Array(bins),counts=new Uint32Array(bins);
      for(let i=0;i<ordered.length;i++){
        const p=ordered[i];let ph=((p.t-t0)/c.period)%1;if(ph<0)ph++;
        const b=Math.min(bins-1,Math.floor(ph*bins));sums[b]+=values[i];counts[b]++;
      }
      const ps=new Float64Array(bins*2+1),pc=new Float64Array(bins*2+1);
      for(let b=0;b<bins*2;b++){ps[b+1]=ps[b]+sums[b%bins];pc[b+1]=pc[b]+counts[b%bins];}
      const w=Math.max(2,Math.min(Math.floor(bins*.22),Math.round(bins*width/c.period)));
      let best=null;
      for(let b=0;b<bins;b++){
        const ni=pc[b+w]-pc[b],no=ordered.length-ni;if(ni<3||no<20)continue;
        const si=ps[b+w]-ps[b],depth=(ps[bins]-ps[0]-si)/no-si/ni;
        const snr=depth/(noise*Math.sqrt(1/ni+1/no));
        if(!best||snr>best.snr)best={depth,snr,phase:(((b+w/2)/bins)%1),nIn:ni};
      }
      return best;
    }
    let totalRecovered=0,totalTrials=0,nullFalsePositives=0;
    const blockSize=10,blocks=[];
    for(let i=0;i<residual.length;i+=blockSize)blocks.push(residual.slice(i,i+blockSize).map(p=>p.y));
    for(let k=0;k<Math.max(1,nullTrials);k++){
      const order=blocks.slice();
      for(let i=order.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      const nullValues=order.flat().slice(0,ordered.length);
      const nullBest=bestAtFixedPeriod(nullValues);
      if(nullBest&&nullBest.snr>=3&&nullBest.depth>0)nullFalsePositives++;
    }
    for(const level of levels){
      for(let k=0;k<Math.max(1,trialsPerDepth);k++){
        const epoch=t0+rand()*Math.max(span-c.period,0);
        const injectedPhase=((epoch-t0)/c.period)%1;
        const values=residual.map(p=>{
          let ph=((p.t-epoch+c.period/2)/c.period)%1;if(ph<0)ph++;
          const inTransit=Math.abs(ph-.5)*c.period<=width;
          return p.y-(inTransit?level.depth:0);
        });
        const found=bestAtFixedPeriod(values);
        const epochError=found?phaseDistance(found.phase,injectedPhase)*c.period:Infinity;
        const recovered=!!found&&found.depth>=level.depth*.5&&found.snr>=3&&epochError<=Math.max(c.duration*.5,c.period/bins);
        level.n++;if(recovered)level.recovered++;
      }
      level.fraction=level.recovered/level.n;
      level.ci95=wilsonInterval(level.recovered,level.n);
      totalRecovered+=level.recovered;totalTrials+=level.n;
    }
    return {n:totalTrials,recovered:totalRecovered,fraction:totalRecovered/totalTrials,levels,nullTrials:Math.max(1,nullTrials),nullFalsePositives,falsePositiveRate:nullFalsePositives/Math.max(1,nullTrials),nullFalsePositiveCI95:wilsonInterval(nullFalsePositives,Math.max(1,nullTrials)),matchingRule:{period:"held fixed at the leading candidate period; not re-searched",epoch:"recovered epoch must be within half the assumed duration (or one phase bin)",depth:"recovered depth ≥ 50% of injected depth",snr:"fixed-period box score ≥ 3",noise:"robust scatter estimated from candidate-box-subtracted residuals"},method:"Seeded fixed-period, fixed-duration epoch-search sensitivity test; 30 absolute depth levels from 100 to 3000 ppm, each searched over phase bins. Includes block-shuffled no-injection null trials and Wilson 95% intervals. It is not blind full-pipeline completeness or a global false-alarm probability."};
  }
  return {KNOWN,median,robustSigma,phaseOf,eventStats,eventDepthConsistency,denseRefine,aliasInfo,blockBootstrap,injectionRecovery,qualitySummary,tessQualitySummary,TESS_QUALITY_MASK,quickSearch,removeCandidateBox};
});
