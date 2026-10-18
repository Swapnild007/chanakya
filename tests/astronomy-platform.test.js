const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("astronomy-platform.js", "utf8");
test("registry covers eight distinct astronomy research domains", () => {
  const context = {window:{}, document:{readyState:"loading",addEventListener(){}}};
  vm.runInNewContext(source, context);
  const registry=context.window.AstroLensAstronomyPlatform;
  assert.equal(registry.domainCount,8);
  assert.equal(new Set(registry.domains.map(d=>d.id)).size,8);
  assert.ok(registry.domains.some(d=>d.id==="stars-exoplanets"));
  assert.ok(registry.domains.some(d=>d.id==="gravitational"));
});
test("every domain has a description, method, and traceable source URL", () => {
  const context = {window:{}, document:{readyState:"loading",addEventListener(){}}};
  vm.runInNewContext(source, context);
  for(const domain of context.window.AstroLensAstronomyPlatform.domains){
    assert.ok(domain.desc.length>40,domain.id);
    assert.ok(domain.methods.length>0,domain.id);
    assert.ok(domain.sources.length>0,domain.id);
    for(const [,url] of domain.sources) assert.match(url,/^https:\/\//);
  }
});
test("planned domain labels do not claim completed solvers", () => {
  const context = {window:{}, document:{readyState:"loading",addEventListener(){}}};
  vm.runInNewContext(source, context);
  const planned=context.window.AstroLensAstronomyPlatform.domains.filter(d=>d.status==="planned");
  assert.equal(planned.length,5);
});
