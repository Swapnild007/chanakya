"use strict";
const assert=require("node:assert/strict");
const registryApi=require("../apps/command-center/tool-registry.js");
class Store{constructor(){this.data={}}getItem(k){return this.data[k]??null}setItem(k,v){this.data[k]=String(v)}}
const storage=new Store(),calls=[];
const registry=registryApi.create(storage,[
 {name:"notes.add",description:"Add a local note.",permission:"local_write",validate:x=>!!x&&typeof x.text==="string"&&!!x.text.trim(),run:x=>{calls.push(x.text);return {saved:true,text:x.text}}},
 {name:"external.send",description:"Send externally.",permission:"external_write",validate:x=>!!x&&typeof x.text==="string",run:()=>{throw new Error("Must never run")}},
 {name:"protected.delete",description:"Protected action.",permission:"local_write",requiresApproval:true,validate:x=>!!x,run:()=>({deleted:true})}
]);
let result=registry.execute("notes.add",{text:"capture evidence"});
assert.equal(result.ok,true);assert.deepEqual(result.output,{saved:true,text:"capture evidence"});
result=registry.execute("notes.add",{text:""});
assert.equal(result.ok,false);assert.match(result.error,/validation/);assert.deepEqual(calls,["capture evidence"]);
result=registry.execute("external.send",{text:"no"});
assert.equal(result.ok,false);assert.match(result.error,/disabled by policy/);
result=registry.execute("protected.delete",{id:"x"});
assert.equal(result.ok,false);assert.match(result.error,/requires explicit approval/);
result=registry.execute("protected.delete",{id:"x"},{approved:true});
assert.equal(result.ok,true);assert.deepEqual(result.output,{deleted:true});
result=registry.execute("missing.tool",{});
assert.equal(result.ok,false);assert.match(result.error,/Unknown tool/);
assert.equal(registry.history().length,6);
assert.equal(registry.history()[0].tool,"missing.tool");
assert.ok(registry.history().every(run=>run.externalAction===false));
assert.equal(registry.catalog().length,3);
assert.throws(()=>registryApi.create(storage,[{name:"same.tool",permission:"read",run:()=>1},{name:"same.tool",permission:"read",run:()=>2}]),/Duplicate tool/);
console.log("Chanakya tool registry: catalog, local execution, input validation, approval gate, external-write denial, failure records, and audit history passed.");
