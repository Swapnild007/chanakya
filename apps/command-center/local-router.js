"use strict";
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ChanakyaLocalRouter=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const patterns={
  list:/\\b(show|list|view|open|what are|display)\\b.{0,30}\\b(tasks?|to-?dos?|work queue|my work)\\b/i,
  create:/\\b(add|create|capture|track|remember|save|make)\\b.{0,45}\\b(task|to-?do|action item|work item|reminder)\\b/i,
  completion:/\\b(mark|set|move|change|update)\\b.{0,70}\\b(task|to-?do|work item)\\b.{0,70}\\b(done|complete|completed|blocked|in progress|open)\\b/i,
  plan:/\\b(plan|planning|break down|steps|checklist)\\b/i,
  help:/^\\s*(help|what can you do|commands?)\\s*[?.!]*\\s*$/i
 };
 function extractTaskTitle(input){
  return input.trim()
   .replace(/^(please\\s+)?(can you\\s+)?(add|create|capture|track|remember|save|make)\\s+(a\\s+|an\\s+|the\\s+)?(new\\s+)?(task|to-?do|action item|work item|reminder)\\b\\s*/i,"")
   .replace(/^(to|for)\\s*[:,-]?\\s*/i,"")
   .replace(/^(to\\s+)?(help me\\s+)?/i,"")
   .replace(/[?.!]+$/,"").trim();
 }
 function extractStatus(input){
  const match=input.match(/\\b(done|complete|completed|blocked|in progress|open)\\b/i);
  if(!match)return null;
  const word=match[1].toLowerCase();
  return word==="complete"||word==="completed"?"done":word.replace(/\\s+/g,"_");
 }
 function extractTaskTarget(input){
  let value=input.trim()
   .replace(/^(please\\s+)?(mark|set|move|change|update)\\s+/i,"")
   .replace(/\\s+(as|to)\\s+(done|complete|completed|blocked|in progress|open)\\s*[?.!]*$/i,"")
   .replace(/\\s+(done|complete|completed|blocked|in progress|open)\\s*[?.!]*$/i,"")
   .replace(/^the\\s+/i,"")
   .replace(/^task\\s+/i,"")
   .replace(/[?.!]+$/,"").trim();
  value=value.replace(/\\b(task|to-?do|work item)\\b/i,"").trim();
  return value;
 }
 function route(input){
  if(typeof input!=="string"||!input.trim())return {intent:"empty"};
  const text=input.trim();
  if(patterns.list.test(text))return {intent:"list_tasks",input:text};
  if(patterns.create.test(text)){
   const title=extractTaskTitle(text);
   return title?{intent:"create_task",title,input:text}:{intent:"unsupported",input:text,reason:"Describe the work to capture."};
  }
  if(patterns.completion.test(text)){
   const status=extractStatus(text);
   const target=extractTaskTarget(text);
   return {intent:"status_request",input:text,status,target};
  }
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
  const subject=input.trim().replace(/^(please\\s+)?(help me\\s+)?(plan|planning|break down|make a checklist for|create a checklist for)\\s*/i,"").replace(/[?.!]+$/,"").trim();
  if(!subject)return {ok:false,reason:"Tell me what you want to plan."};
  return {ok:true,title:subject,steps:[
   "Define the desired outcome and how success will be verified.",
   "Gather the required inputs, evidence, and constraints.",
   "Break the work into small, ordered actions.",
   "Identify dependencies, risks, and decisions requiring approval.",
   "Review the result against the original outcome and record what remains."
  ]};
 }
 return Object.freeze({route,summarize,checklist,extractTaskTitle,extractStatus,extractTaskTarget});
});
