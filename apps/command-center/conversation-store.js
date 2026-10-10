"use strict";
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ChanakyaConversationStore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const KEY="chanakya.conversations.v1";
 function read(storage){
  try{const data=JSON.parse(storage.getItem(KEY)||"null");if(data&&Array.isArray(data.sessions))return {activeId:data.activeId||null,sessions:data.sessions.filter(s=>s&&typeof s.id==="string"&&Array.isArray(s.messages))};}catch{}
  return {activeId:null,sessions:[]};
 }
 function write(data,storage){storage.setItem(KEY,JSON.stringify(data));return data;}
 function create(storage,now){
  const data=read(storage),stamp=now||new Date().toISOString();
  const session={id:"chat-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:"New conversation",createdAt:stamp,updatedAt:stamp,messages:[]};
  data.sessions.unshift(session);data.activeId=session.id;
  data.sessions=data.sessions.slice(0,30);write(data,storage);return session;
 }
 function active(storage){const data=read(storage);return data.sessions.find(s=>s.id===data.activeId)||null;}
 function select(id,storage){const data=read(storage);if(!data.sessions.some(s=>s.id===id))throw new Error("Conversation not found.");data.activeId=id;write(data,storage);return data.sessions.find(s=>s.id===id);}
 function append(role,text,storage,now){
  if(!["user","assistant"].includes(role)||typeof text!=="string"||!text.trim())throw new Error("A non-empty conversation message is required.");
  const data=read(storage);let session=data.sessions.find(s=>s.id===data.activeId);
  if(!session)session=create(storage,now);
  const latest=read(storage),current=latest.sessions.find(s=>s.id===session.id);
  current.messages.push({role,text,createdAt:now||new Date().toISOString()});
  if(current.title==="New conversation"&&role==="user")current.title=text.trim().replace(/\s+/g," ").slice(0,48);
  current.updatedAt=now||new Date().toISOString();latest.activeId=current.id;write(latest,storage);return current;
 }
 function list(storage){return read(storage).sessions.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
 return Object.freeze({KEY,read,write,create,active,select,append,list});
});
