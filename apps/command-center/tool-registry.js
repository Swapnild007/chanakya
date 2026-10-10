"use strict";
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ChanakyaToolRegistry=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const KEY="chanakya.tool-runs.v1";
 const PERMISSIONS=Object.freeze(["read","local_write","external_write"]);
 const clean=value=>String(value||"").trim();
 function readRuns(storage){try{const rows=JSON.parse(storage.getItem(KEY)||"[]");return Array.isArray(rows)?rows:[]}catch(_){return []}}
 function create(storage,definitions,options){
  if(!storage||typeof storage.getItem!=="function"||typeof storage.setItem!=="function")throw new TypeError("A storage adapter is required.");
  const tools=new Map(),settings=options||{};
  (definitions||[]).forEach(def=>{
   if(!def||typeof def.name!=="string"||!/^[a-z][a-z0-9_.-]{1,79}$/.test(def.name))throw new Error("Tool name is invalid.");
   if(tools.has(def.name))throw new Error("Duplicate tool name: "+def.name);
   if(!PERMISSIONS.includes(def.permission))throw new Error("Tool permission is invalid.");
   if(typeof def.run!=="function")throw new Error("Tool runner is required.");
   tools.set(def.name,Object.freeze({name:def.name,description:clean(def.description),permission:def.permission,requiresApproval:def.requiresApproval===true,validate:typeof def.validate==="function"?def.validate:()=>true,run:def.run}));
  });
  function catalog(){return Array.from(tools.values(),t=>({name:t.name,description:t.description,permission:t.permission,requiresApproval:t.requiresApproval}))}
  function execute(name,input,context){
   const tool=tools.get(name),ctx=context||{},startedAt=new Date().toISOString(),id="run-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
   let status="failed",output=null,error=null;
   try{
    if(!tool)throw new Error("Unknown tool. No action was performed.");
    if(tool.permission==="external_write"&&!settings.allowExternalWrites)throw new Error("External writes are disabled by policy. No action was performed.");
    if(tool.requiresApproval&&ctx.approved!==true)throw new Error("This tool requires explicit approval. No action was performed.");
    if(typeof settings.allowTool==="function"&&!settings.allowTool(tool.name,ctx))throw new Error("Tool is not permitted in this context. No action was performed.");
    if(tool.validate(input)!==true)throw new Error("Tool input failed validation. No action was performed.");
    output=tool.run(input,ctx);status="succeeded";
   }catch(e){error=clean(e&&e.message)||"Tool execution failed.";}
   const record={id,tool:name,permission:tool?tool.permission:"unknown",status,startedAt,finishedAt:new Date().toISOString(),input:input===undefined?null:input,output:status==="succeeded"?output:null,error,externalAction:false};
   const rows=readRuns(storage);rows.unshift(record);storage.setItem(KEY,JSON.stringify(rows.slice(0,200)));
   return {ok:status==="succeeded",record,output,error};
  }
  return Object.freeze({KEY,catalog,execute,history:()=>readRuns(storage)});
 }
 return Object.freeze({KEY,PERMISSIONS,readRuns,create});
});
