"use strict";
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ChanakyaLocalRouter=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const patterns={
  list:/\b(show|list|view|open|what are|display)\b.{0,30}\b(tasks?|to-?dos?|work queue|my work)\b/i,
  create:/\b(add|create|capture|track|remember|save|make)\b.{0,45}\b(task|to-?do|action item|work item|reminder)\b/i,
  completion:/\b(mark|set|move|change|update)\b.{0,40}\b(task|to-?do|work item)\b.{0,30}\b(done|complete|completed|blocked|in progress)\b/i,
  plan:/\b(plan|planning|break down|steps|checklist)\b/i,
  help:/^\s*(help|what can you do|commands?)\s*[?.!]*\s*$/i
 };
 function route(input){
  if(typeof input!=="string"||!input.trim())return {intent:"empty"};
  const text=input.trim();
  if(patterns.list.test(text))return {intent:"list_tasks",input:text};
  if(patterns.create.test(text))return {intent:"create_task",title:text,input:text};
  if(patterns.completion.test(text))return {intent:"status_request",input:text};
  if(patterns.help.test(text))return {intent:"help"};
  if(patterns.plan.test(text))return {intent:"plan_request",input:text};
  return {intent:"unsupported",input:text,reason:"No local capability matches this request yet."};
 }
 function summarize(tasks){
  const counts={open:0,in_progress:0,blocked:0,done:0};
  for(const task of tasks)if(Object.prototype.hasOwnProperty.call(counts,task.status))counts[task.status]++;
  return {total:tasks.length,counts,items:tasks.slice(0,8).map(task=>({id:task.id,title:task.title,status:task.status}))};
 }
 function checklist(input){
  const subject=input.trim().replace(/^(please\s+)?(help me\s+)?(plan|planning|break down|make a checklist for|create a checklist for)\s*/i,"").replace(/[?.!]+$/,"").trim();
  if(!subject)return {ok:false,reason:"Tell me what you want to plan."};
  return {ok:true,title:subject,steps:[
   "Define the desired outcome and how success will be verified.",
   "Gather the required inputs, evidence, and constraints.",
   "Break the work into small, ordered actions.",
   "Identify dependencies, risks, and decisions requiring approval.",
   "Review the result against the original outcome and record what remains."
  ]};
 }
 return Object.freeze({route,summarize,checklist});
});
