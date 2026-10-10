"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {classify}=require("../prototype/classifier.js");
const fixturePath=path.join(__dirname,"../prototype/data/sample_messages.json");
const messages=JSON.parse(fs.readFileSync(fixturePath,"utf8"));
const categories=["act_now","needs_decision","authorized_handling","digest_later","noise"];
const confusion=Object.fromEntries(categories.map(expected=>[expected,Object.fromEntries(categories.map(predicted=>[predicted,0]))]));
const critical=messages.filter(m=>["act_now","needs_decision"].includes(m.expectedCategory));
const suppressed=[];
for(const message of messages){const actual=classify(message).category;assert.ok(confusion[message.expectedCategory],"Unknown expected category: "+message.expectedCategory);assert.ok(Object.hasOwn(confusion[message.expectedCategory],actual),"Unknown predicted category: "+actual);confusion[message.expectedCategory][actual]++;if(["act_now","needs_decision"].includes(message.expectedCategory)&&["digest_later","noise"].includes(actual))suppressed.push({id:message.id,expected:message.expectedCategory,actual});}
const metrics=Object.fromEntries(categories.map(category=>{const tp=confusion[category][category];const predicted=categories.reduce((n,expected)=>n+confusion[expected][category],0);const actual=categories.reduce((n,value)=>n+confusion[category][value],0);const precision=predicted?tp/predicted:0;const recall=actual?tp/actual:0;const f1=precision+recall?2*precision*recall/(precision+recall):0;return [category,{support:actual,predicted,truePositive:tp,precision:Number(precision.toFixed(3)),recall:Number(recall.toFixed(3)),f1:Number(f1.toFixed(3))}]}));
const correct=messages.filter(m=>classify(m).category===m.expectedCategory).length;
const report={dataset:"prototype/data/sample_messages.json",sampleSize:messages.length,correct,accuracy:Number((correct/messages.length).toFixed(3)),criticalCount:critical.length,criticalSuppressed:suppressed.length,criticalRecall:Number(((critical.length-suppressed.length)/critical.length).toFixed(3)),perCategory:metrics,confusionMatrix:confusion,criticalSuppressionCases:suppressed,limitations:["Synthetic fixtures only; not representative of live inbox traffic.","Fixture labels are curated expectations, not independent expert adjudication.","Metrics are a baseline, not evidence of production readiness."]};
console.log(JSON.stringify(report,null,2));
assert.equal(suppressed.length,0,"Critical messages must never be categorized as digest_later or noise.");
assert.equal(correct,messages.length,"The current golden fixtures must match their expected categories.");
console.log("Firewall evaluation passed: no critical suppression and all golden fixtures matched.");