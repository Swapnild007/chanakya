"use strict";
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ChanakyaWorkflowEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const KEY="chanakya.workflows.v1";
 const STATUSES=Object.freeze(["ready","in_progress","blocked","completed","cancelled"]);
 const STEP_STATUSES=Object.freeze(["pending","in_progress","blocked","completed"]);
 const DEFAULT_STEPS=Object.freeze([
  "Define the desired outcome and success criteria.",
  "Gather required inputs and supporting evidence.",
  "Complete the work and record the observed result.",
  "Verify the result against the original objective."
 ]);
 function read(storage){try{const d=JSON.parse(storage.getItem(KEY)||"null"),items=Array.isArray(d)?d:d&&Array.isArray(d.workflows)?d.workflows:[];return items.filter(w=>w&&typeof w.id==="string"&&Array.isArray(w.steps))}catch{return []}}
 function persist(items,storage){storage.setItem(KEY,JSON.stringify(items));return items}
 function clean(value,max=4000){if(typeof value!=="string")throw new TypeError("Expected text.");const s=value.replace(/\s+/g," ").trim();if(!s)throw new Error("A description is required.");if(s.length>max)throw new Error("Text is too long.");return s}
 function create(title,storage,now,steps){
  const label=clean(title),stamp=now||new Date().toISOString(),items=read(storage);
  const workflow={id:"flow-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:label,status:"ready",createdAt:stamp,updatedAt:stamp,steps:(steps||DEFAULT_STEPS).map((text,index)=>({id:"step-"+(index+1),title:clean(text,500),status:"pending",evidence:"",updatedAt:stamp})),events:[{type:"created",at:stamp,detail:"Workflow created locally. No external action was performed."}]};
  if(!workflow.steps.length)throw new Error("A workflow needs at least one step.");
  items.unshift(workflow);persist(items,storage);return workflow;
 }
 function find(items,id){const w=items.find(x=>x.id===id);if(!w)throw new Error("Workflow not found.");return w}
 function mutate(id,storage,now,fn){const items=read(storage),w=find(items,id),stamp=now||new Date().toISOString();fn(w,stamp);w.updatedAt=stamp;persist(items,storage);return w}
 function event(w,type,stamp,detail){w.events.push({type,at:stamp,detail})}
 function nextStep(w){return w.steps.find(s=>s.status!=="completed")||null}
 function activateNextStep(w){const next=nextStep(w);if(next&&next.status==="pending")next.status="in_progress";return next}
 function start(id,storage,now){return mutate(id,storage,now,(w,t)=>{
  if(!["ready","blocked"].includes(w.status))throw new Error("Only ready or blocked workflows can be started or resumed.");
  if(w.steps.some(s=>s.status==="blocked"))throw new Error("Resolve the blocked step before resuming.");
  w.status="in_progress";activateNextStep(w);event(w,"workflow_started",t,"Workflow started or resumed locally; only the next incomplete step is active.");
 })}
 function setStep(id,stepId,status,evidence,storage,now){
  if(!STEP_STATUSES.includes(status))throw new Error("Unsupported step status.");
  return mutate(id,storage,now,(w,t)=>{
   if(!["ready","in_progress","blocked"].includes(w.status))throw new Error("This workflow is no longer editable.");
   const step=w.steps.find(s=>s.id===stepId);if(!step)throw new Error("Workflow step not found.");
   if(step.status==="completed")throw new Error("A completed step cannot be changed.");
   const next=nextStep(w);
   if(!next||next.id!==step.id)throw new Error("Complete workflow steps in order. Only the next incomplete step can change.");
   if(status==="completed"){
    step.evidence=clean(evidence||"",2000);
    step.status="completed";
    if(w.status==="ready"||w.status==="blocked")w.status="in_progress";
    const upcoming=activateNextStep(w);
    event(w,"step_completed",t,step.title+" | Evidence: "+step.evidence);
    if(!upcoming){w.status="completed";event(w,"workflow_completed",t,"All steps completed in order with recorded evidence. This is a local record, not independent verification.");}
   }else if(status==="blocked"){
    step.status="blocked";w.status="blocked";event(w,"step_blocked",t,step.title+" requires review before work can continue.");
   }else if(status==="in_progress"){
    if(w.status==="blocked")throw new Error("Resolve the workflow blocker before continuing.");
    step.status="in_progress";w.status="in_progress";event(w,"step_started",t,step.title+" marked in progress.");
   }else{
    step.status="pending";
    if(w.status==="blocked")w.status="ready";
    event(w,"step_reset",t,step.title+" returned to pending.");
   }
   step.updatedAt=t;
  });
 }
 function unblockStep(id,stepId,storage,now){return mutate(id,storage,now,(w,t)=>{if(w.status!=="blocked")throw new Error("Workflow is not blocked.");const s=w.steps.find(x=>x.id===stepId);if(!s||s.status!=="blocked")throw new Error("Blocked step not found.");s.status="pending";s.updatedAt=t;w.status="ready";event(w,"block_cleared",t,s.title+" marked pending after user review.");});}
 function cancel(id,storage,now){return mutate(id,storage,now,(w,t)=>{if(["completed","cancelled"].includes(w.status))throw new Error("This workflow is already closed.");w.status="cancelled";event(w,"cancelled",t,"Cancelled locally by user.");});}
 function summary(items){const counts=Object.fromEntries(STATUSES.map(s=>[s,items.filter(w=>w.status===s).length]));return {total:items.length,counts,items:items.map(w=>({id:w.id,title:w.title,status:w.status,steps:w.steps.length,completed:w.steps.filter(s=>s.status==="completed").length}))}}
 return Object.freeze({KEY,STATUSES,STEP_STATUSES,DEFAULT_STEPS,read,create,start,setStep,unblockStep,cancel,summary});
});
