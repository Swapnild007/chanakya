"use strict";
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ChanakyaAssistantRuntime=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const VERSION="0.1.0-local";
 const ACTIONS=Object.freeze({TASKS:"tasks",AUTOMATION:"automation"});
 const clean=value=>String(value||"").trim();
 function result(text,options={}){return {text,outcome:options.outcome||"completed",source:"local_deterministic",actions:options.actions||[],meta:{runtime:VERSION,...(options.meta||{})}}}
 function handle(input,storage,capabilities){
  const text=clean(input);
  if(!text)return result("Tell me the outcome you want to achieve.",{outcome:"needs_input"});
  const c=capabilities||{};
  const router=c.router,taskEngine=c.taskEngine,workflowEngine=c.workflowEngine;
  if(!router||!taskEngine||!storage)return result("The local assistant runtime is missing a required capability. No work was changed.",{outcome:"blocked"});
  const lower=text.toLocaleLowerCase();
  if(/\b(list|show|view|what are|open)\b.{0,35}\b(workflows?|automations?)\b/i.test(text)){
   if(!workflowEngine)return result("Workflow tracking is not loaded in this build.",{outcome:"blocked"});
   const flows=workflowEngine.read(storage),summary=workflowEngine.summary(flows);
   if(!flows.length)return result("There are no local workflows yet. Tell me “create a workflow to [outcome]” to start one.",{outcome:"completed",actions:[{type:"navigate",view:ACTIONS.AUTOMATION,label:"Open Automation"}]});
   const rows=flows.slice(0,8).map((w,i)=>(i+1)+". ["+w.status.replace(/_/g," ")+"] "+w.title+" ("+w.steps.filter(s=>s.status==="completed").length+"/"+w.steps.length+" steps)").join("\n");
   return result("Your local workflows\nTotal: "+summary.total+" · Active: "+(summary.counts.in_progress||0)+" · Blocked: "+(summary.counts.blocked||0)+" · Completed: "+(summary.counts.completed||0)+"\n\n"+rows,{actions:[{type:"navigate",view:ACTIONS.AUTOMATION,label:"Open Automation"}]});
  }
  const createFlow=text.match(/^(?:please\s+)?(?:create|start|make)\s+(?:a\s+)?workflow(?:\s+(?:to|for)\s+|:\s*)(.+)$/i);
  if(createFlow){
   const title=clean(createFlow[1]).replace(/[?.!]+$/,"");
   if(!title)return result("What outcome should the workflow achieve?",{outcome:"needs_input"});
   if(!workflowEngine)return result("Workflow tracking is not loaded. No workflow was created.",{outcome:"blocked"});
   try{const flow=workflowEngine.create(title,storage);return result("Workflow created locally: "+flow.title+"\nIt has "+flow.steps.length+" starter steps. Nothing has been executed outside this browser.",{actions:[{type:"navigate",view:ACTIONS.AUTOMATION,label:"Open workflow"}],meta:{entityType:"workflow",entityId:flow.id}})}catch(error){return result("I couldn't create that workflow: "+error.message,{outcome:"blocked"})}
  }
  if(/\b(decision|decide|trade-?offs?|pros and cons|compare options?)\b/i.test(lower)){
   const subject=text.replace(/^(please\s+)?(help me\s+)?(think through|analyze|analyse|make|with|help with)?\s*(a\s+)?(decision|compare|trade-?offs?|pros and cons)\s*(about|for|between|on)?\s*/i,"").replace(/[?.!]+$/,"").trim();
   return result("Decision brief"+(subject?": "+subject:"")+"\n\nI can structure the decision locally, but I won't invent facts or pretend to know your options.\n\n1. Desired outcome: what must be true after the decision?\n2. Options: list the realistic choices, including doing nothing.\n3. Criteria: rank cost, time, risk, reversibility, and long-term value.\n4. Evidence: what do we know, and what is still an assumption?\n5. Reversibility: what is the smallest safe test?\n6. Decision rule: choose the option that best meets the top criteria without crossing a hard constraint.\n\nSend me the options and constraints, and I'll organize them into a side-by-side comparison. This is a framework, not a recommendation based on missing evidence.",{outcome:"needs_input",meta:{capability:"decision_framework"}});
  }
  const intent=router.route(text),tasks=taskEngine.load(storage);
  if(intent.intent==="create_task"){
   try{const saved=taskEngine.add(intent.title,tasks,storage);return result("Task captured: "+saved.task.title+"\nStatus: Open. Saved on this device only; no external work was performed.",{actions:[{type:"navigate",view:ACTIONS.TASKS,label:"Open Tasks & Projects"}],meta:{entityType:"task",entityId:saved.task.id}})}catch(error){return result("I couldn't save that task: "+error.message,{outcome:"blocked"})}
  }
  if(intent.intent==="list_tasks"){
   const s=router.summarize(tasks),rows=s.items.length?s.items.map((t,i)=>(i+1)+". ["+t.status.replace(/_/g," ")+"] "+t.title).join("\n"):"Your local task queue is empty.";
   return result("Task queue\nTotal: "+s.total+" · Open: "+s.counts.open+" · In progress: "+s.counts.in_progress+" · Blocked: "+s.counts.blocked+" · Done: "+s.counts.done+"\n\n"+rows,{actions:[{type:"navigate",view:ACTIONS.TASKS,label:"Open Tasks & Projects"}]});
  }
  if(intent.intent==="plan_request"){
   const plan=router.checklist(text);
   if(!plan.ok)return result("What outcome do you want to plan?",{outcome:"needs_input"});
   return result("Plan framework: "+plan.title+"\n\n"+plan.steps.map((step,i)=>(i+1)+". "+step).join("\n")+"\n\nThis is a deterministic starting framework. It has not researched, executed, or verified the plan.",{outcome:"needs_input"});
  }
  if(intent.intent==="status_request"){
   if(!intent.status)return result("Which status should I use: open, in progress, blocked, or done?",{outcome:"needs_input",actions:[{type:"navigate",view:ACTIONS.TASKS,label:"Open Tasks & Projects"}]});
   const target=clean(intent.target).toLocaleLowerCase(),matches=target?tasks.filter(t=>t.title.toLocaleLowerCase().includes(target)||target.includes(t.title.toLocaleLowerCase())):[];
   if(matches.length!==1)return result(matches.length>1?"More than one task matches “"+intent.target+"”. Nothing was changed.":"I couldn't find one unambiguous task matching “"+intent.target+"”. Nothing was changed.",{outcome:"needs_input",actions:[{type:"navigate",view:ACTIONS.TASKS,label:"Review tasks"}]});
   try{const updated=taskEngine.setStatus(matches[0].id,intent.status,tasks,storage),task=updated.find(t=>t.id===matches[0].id);return result("Updated locally: "+task.title+"\nStatus: "+task.status.replace(/_/g," ")+". No external action was performed.",{actions:[{type:"navigate",view:ACTIONS.TASKS,label:"Open Tasks & Projects"}],meta:{entityType:"task",entityId:task.id}})}catch(error){return result("I couldn't update the task: "+error.message,{outcome:"blocked"})}
  }
  if(intent.intent==="help")return result("I can currently do these things locally:\n• Create and update tasks\n• Summarize your task queue\n• Create and summarize workflows\n• Structure a plan or decision\n\nOpen-ended knowledge questions, live research, model reasoning, and external actions are not connected. I will say so rather than fabricate an answer.",{outcome:"completed"});
  return result("I don't have a connected reasoning model for this request, and no local capability matched it. I haven't guessed, created a task, or performed an action. Try asking me to create/list/update tasks, create/list workflows, or structure a plan or decision.",{outcome:"unsupported"});
 }
 return Object.freeze({VERSION,ACTIONS,handle});
});
