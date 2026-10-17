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
  const injected=S.injectionRecovery(p,candidate,200);
  assert.equal(injected.n,200);
  assert.equal(injected.levels.reduce((n,x)=>n+x.n,0),200);
  assert.ok(injected.levels.every(x=>x.n>0));
  assert.ok(injected.levels.every(x=>x.fraction===null||x.fraction>=0&&x.fraction<=1));
}
{
  const p=synthetic(),candidate={period:2.5,epoch:1000.4,duration:.12,depth:.01};
  const result=S.quickSearch(p,.5,10,40,120);
  assert.equal(result.trialCount,120);
  assert.ok(result.candidates.length>0);
  assert.ok(Math.abs(result.candidates[0].period-2.5)<.2,"coarse re-search should recover injected period");
}
console.log("AstroLens shared science-core tests passed.");
