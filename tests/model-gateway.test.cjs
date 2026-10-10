"use strict";
const assert=require("node:assert/strict");
const gateway=require("../apps/command-center/model-gateway.js");
assert.equal(gateway.validateRequest(null),"Request must be an object.");
assert.match(gateway.validateRequest({content:""}),/non-empty/);
assert.match(gateway.validateRequest({content:"x".repeat(20001)}),/20000/);
assert.equal(gateway.validateProposal({category:"made_up",confidence:"high",reason:"x"}).ok,false);
assert.equal(gateway.validateProposal({category:"act_now",confidence:"high",reason:""}).ok,false);
assert.throws(()=>gateway.create({}),/provider adapter/);
(async()=>{
 const invalid=gateway.create({provider:gateway.createMockProvider(async()=>({category:"pretend",confidence:"high",reason:"fake"}))});
 const bad=await invalid.classify({content:"test"});assert.equal(bad.status,gateway.STATES.invalid);assert.equal(bad.authoritative,undefined);
 const failing=gateway.create({provider:{name:"failure-fixture",propose:async()=>{throw new Error("fixture outage")}}});
 const outage=await failing.classify({content:"test"});assert.equal(outage.status,gateway.STATES.blocked);assert.match(outage.error,/fixture outage/);
 const mock=gateway.create({provider:gateway.createMockProvider()});
 const result=await mock.classify({content:"A sample message"});assert.equal(result.status,gateway.STATES.completed);assert.equal(result.authoritative,false);assert.equal(result.externalAction,false);assert.match(result.proposal.reason,/Mock provider only/);
 const oversized=await mock.classify({content:"x".repeat(20001)});assert.equal(oversized.status,gateway.STATES.blocked);
 console.log("Chanakya Model Gateway: request/output validation, provider outage, mock-only boundary, and non-authoritative proposals passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});