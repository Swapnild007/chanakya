const assert = require("node:assert/strict");
const S = require("../science-core.js");

function synthetic(period=2.5, depth=.01, duration=.12, baseline=40, cadence=.02){
  const points=[];let seed=42;
  const random=()=>{seed=(seed*48271)%2147483647;return seed/2147483647-.5;};
  for(let t=1000;t<1000+baseline;t+=cadence){
    const c={period,epoch:1000.4,duration};
    const phase=Math.abs(S.phaseOf(t,c));
    points.push({t,y:(phase<=duration/(2*period)?-depth:0)+random()*.0015});
  }
  return points;
}
{
  const p=synthetic(),stats=S.eventStats(p,{period:2.5,epoch:1000.4,duration:.12,depth:.01});
  assert.ok(stats.oddN>=5 && stats.evenN>=5,"must compare sampled events, not individual points");
  assert.ok(Number.isFinite(stats.oddEvenSigma),"odd/even significance should be quantified");
  assert.ok(stats.oddEvenRatio>.75,"equal injected odd/even depths should have similar medians");
  assert.ok(stats.events.some(e=>e.status==="NO COVERAGE")===false,"regular cadence should cover every predicted event");
  assert.ok(stats.events.every(e=>e.n>0),"each expected event has points");
  const quality=S.tessQualitySummary([0,1,2,4,8,16,32,64,128,175,256,NaN]);
  assert.equal(quality.mask,175);
  assert.equal(quality.rejected,7,"default mask excludes values sharing one or more masked TESS bits");
  assert.equal(quality.missing,1);
  assert.ok(quality.bits.some(b=>b.name==="Manual exclude"&&b.count>=2));
}
{
  const a=S.aliasInfo(.755562,"TRAPPIST-1");
  assert.equal(a.type,"alias");
  assert.equal(a.label,"TRAPPIST-1 b × 0.5");
  assert.ok(a.error<.01);
  assert.equal(S.aliasInfo(.755562,"Vega").type,"not-run");
}
{
  const p=synthetic(),candidate={period:2.5,epoch:1000.4,duration:.12,depth:.01};
  const injected=S.injectionRecovery(p,candidate,50,20);
  assert.deepEqual(S.injectionRecovery(p,candidate,50,20),injected,"fixed-seed injection recovery must reproduce exactly");
  assert.equal(injected.n,1500);
  assert.equal(injected.levels.reduce((n,x)=>n+x.n,0),1500);
  assert.ok(injected.levels.every(x=>x.n>0));
  assert.equal(injected.levels.length,30,"sensitivity curve must sample 100 through 3000 ppm");
  assert.deepEqual(injected.levels.map(x=>x.ppm),Array.from({length:30},(_,i)=>(i+1)*100),"sensitivity levels must be ordered and reproducible");
  assert.ok(injected.levels.every(x=>x.fraction===null||x.fraction>=0&&x.fraction<=1));
  assert.ok(injected.levels.every(x=>x.ci95.low!==null&&x.ci95.high!==null&&x.ci95.low<=x.fraction&&x.ci95.high>=x.fraction),"each recovery level must include Wilson 95% intervals");
  assert.equal(injected.matchingRule.epoch,"recovered epoch must be within half the assumed duration (or one phase bin)");
  assert.equal(injected.nullTrialsPerDepth,20);
  assert.ok(injected.levels.every(x=>x.nullTrials===20&&x.nullFalseMatchRate>=0&&x.nullFalseMatchRate<=1&&x.nullFalseMatchCI95.low<=x.nullFalseMatchRate&&x.nullFalseMatchCI95.high>=x.nullFalseMatchRate),"each injection level must include matched null controls and Wilson intervals");
}
{
  const p=synthetic(),candidate={period:2.5,epoch:1000.4,duration:.12,depth:.01};
  const result=S.quickSearch(p,.5,10,40,120);
  assert.equal(result.trialCount,120);
  assert.ok(result.candidates.length>0);
  assert.deepEqual(S.quickSearch(p,.5,10,40,120),result,"identical inputs and grid must reproduce identical candidates");
  assert.deepEqual(S.denseRefine(p,result.candidates,40),S.denseRefine(p,result.candidates,40),"dense candidate refinement must be reproducible");
  const consistency=S.eventDepthConsistency(S.eventStats(p,{period:2.5,epoch:1000.4,duration:.12,depth:.01}));
  assert.ok(consistency.n>=2 && Number.isFinite(consistency.chiSquare),"event-depth consistency must report chi-square");
  const residual=S.residualSummary(p);
  assert.equal(residual.count,p.length);
  assert.ok(Number.isFinite(residual.meanPpm)&&Number.isFinite(residual.medianPpm),"residual summary must expose finite shared mean and median");
  const combined=S.candidateDepthSummary(p,candidate);
  assert.deepEqual(combined.stats,S.eventStats(p,candidate),"combined candidate summary must reuse the canonical event statistics");
  assert.deepEqual(combined.consistency,S.eventDepthConsistency(combined.stats),"combined summary must use the canonical event-consistency test");
  assert.equal(combined.searchToEventMeanRatio,Math.abs(candidate.depth/combined.consistency.weightedMeanDepth));
  assert.ok(result.candidates.some(x=>[.5,1,2].some(ratio=>Math.abs(x.period/2.5-ratio)/ratio<.05)),"coarse re-search should retain the injected period or a recognizable half/double-period alias");
}

{
  const c={period:2.5,epoch:1000.4,duration:.12,depth:.01};
  const p=synthetic(2.5,.01,.12,5,.01);
  const residual=S.removeCandidateBox(p,c);
  const inTransit=residual.filter(x=>Math.abs(S.phaseOf(x.t,c))<=c.duration/(2*c.period));
  const outside=residual.filter(x=>Math.abs(S.phaseOf(x.t,c))>Math.max(c.duration/c.period,.04));
  assert.ok(Math.abs(S.median(inTransit.map(x=>x.y))-S.median(outside.map(x=>x.y)))<.0015,
    "removing a negative-going transit box must add back the fitted depth, not deepen the dip");
}


console.log("AstroLens shared science-core tests passed.");
