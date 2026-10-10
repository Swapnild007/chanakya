/* Chanakya Cognitive Firewall: deterministic, local-only prototype. No API calls. */
const { CATEGORIES, classify } = window.ChanakyaClassifier;
let messages=[],corrections={},activeFilter="all",query="";
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function currentCategory(m){return corrections[m.id]||classify(m).category}
function toast(s){const t=$("toast");t.textContent=s;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2600)}
function renderStats(){
 const counts={};messages.forEach(m=>{const c=currentCategory(m);counts[c]=(counts[c]||0)+1});
 const cards=[["⌕",messages.length,"Sample items","#eef3fa","#506581"],["!",counts.act_now||0,"Act now","#fff0f2","#df4c61"],["?",counts.needs_decision||0,"Needs decision","#fff5e5","#b86c12"],["✓",counts.authorized_handling||0,"Handling candidates","#e7f7f0","#10966c"],["▤",(counts.digest_later||0)+(counts.noise||0),"Digest / noise","#edf3ff","#2865e8"]];
 $("stats").innerHTML=cards.map(c=>'<div class="stat"><div class="stat-icon" style="background:'+c[3]+';color:'+c[4]+'">'+c[0]+'</div><div><strong>'+c[1]+'</strong><small>'+c[2]+'</small></div></div>').join("");
 $("mix").innerHTML=Object.keys(CATEGORIES).map(k=>'<div class="mix-row"><i style="background:'+CATEGORIES[k].color+'"></i><span>'+CATEGORIES[k].name+'</span><b>'+(counts[k]||0)+'</b></div>').join("");
}
function renderFilters(){
 const options=[["all","All items"],["act_now","Act now"],["needs_decision","Needs decision"],["authorized_handling","Handling candidates"],["digest_later","Digest later"],["noise","Noise candidates"]];
 $("filters").innerHTML=options.map(o=>'<button class="filter '+(activeFilter===o[0]?'active':'')+'" data-filter="'+o[0]+'">'+o[1]+'</button>').join("");
 $("filters").querySelectorAll("button").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;render()});
}
function renderItems(){
 const visible=messages.filter(m=>{
  const c=currentCategory(m);
  const hay=(m.subject+" "+m.body+" "+m.source+" "+m.sender).toLowerCase();
  return (activeFilter==="all"||activeFilter===c)&&hay.includes(query.toLowerCase());
 });
 $("items").innerHTML=visible.map(m=>{
  const c=currentCategory(m),meta=CATEGORIES[c],base=classify(m);
  return '<article class="item" data-id="'+escapeHtml(m.id)+'"><div class="item-icon">'+meta.icon+'</div><div class="item-content"><div class="item-title"><span class="tag '+c+'">'+meta.label+'</span><h3>'+escapeHtml(m.subject)+'</h3></div><div class="meta">'+escapeHtml(m.source)+' · '+escapeHtml(m.sender)+' · '+escapeHtml(m.received)+' · Deadline: '+escapeHtml(m.deadline||"Not stated")+'</div><p class="body">'+escapeHtml(m.body)+'</p><div class="item-bottom"><span class="pill">Confidence: '+(corrections[m.id]?"user corrected":base.confidence)+'</span><span class="pill">'+m.evidence.length+' evidence points</span><div class="item-actions"><button class="mini blue" data-detail="'+escapeHtml(m.id)+'">Why this?</button><button class="mini" data-correct="'+escapeHtml(m.id)+'">Correct category</button></div></div><div class="detail" id="detail-'+escapeHtml(m.id)+'"><strong>Classification rationale</strong><p>'+escapeHtml(corrections[m.id]?"Current session correction by user. Original baseline rationale: "+base.reason:base.reason)+'</p><strong>Source evidence</strong><ul>'+m.evidence.map(e=>"<li>"+escapeHtml(e)+"</li>").join("")+'</ul><strong>Recommended next step</strong><p>'+escapeHtml(m.nextStep)+'</p><p><strong>Safety:</strong> This is a recommendation only. The prototype has no external permissions and cannot execute this action.</p></div></div></article>';
 }).join("");
 $("empty").hidden=visible.length>0;
 $("items").querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>{const el=$("detail-"+b.dataset.detail);el.classList.toggle("open");b.textContent=el.classList.contains("open")?"Hide rationale":"Why this?"});
 $("items").querySelectorAll("[data-correct]").forEach(b=>b.onclick=()=>openCorrection(b.dataset.correct));
}
function render(){renderStats();renderFilters();renderItems()}
function openCorrection(id){
 const m=messages.find(x=>x.id===id);if(!m)return;
 const dlg=$("dialog");$("dialogTitle").textContent="Correct classification";$("dialogBody").textContent="Choose a better category for “"+m.subject+"”. This correction affects only this browser session and is not saved to a server.";const input=$("dialogInput");input.value="";input.placeholder="Optional: explain why this classification is better.";
 const old=$("dialogSubmit");old.replaceWith(old.cloneNode(true));const submit=$("dialogSubmit");
 const select=document.createElement("select");select.id="categorySelect";select.style.cssText="width:100%;padding:10px;border:1px solid #e5ebf3;border-radius:9px;margin:8px 0";
 select.innerHTML=Object.keys(CATEGORIES).map(k=>'<option value="'+k+'" '+(currentCategory(m)===k?"selected":"")+'>'+CATEGORIES[k].name+'</option>').join("");
 input.parentNode.insertBefore(select,input);
 submit.onclick=()=>{corrections[id]=select.value;select.remove();render();toast("Correction applied for this session only.");};
 dlg.addEventListener("close",()=>select.remove(),{once:true});dlg.showModal();
}
$("search").addEventListener("input",e=>{query=e.target.value;renderItems()});
$("about").onclick=()=>{ $("dialogTitle").textContent="About this prototype";$("dialogBody").textContent="Chanakya Cognitive Firewall is a local, deterministic baseline using fictional sample messages. It makes no network requests, uses no model API, and executes no external actions. Categories and counts are experimental, not measured performance."; $("dialogInput").value="";$("dialogInput").placeholder="";$("dialogSubmit").textContent="Got it";$("dialogSubmit").onclick=()=>{};$("dialog").showModal()};
$("stress").onclick=()=>{$("dialogTitle").textContent="Stress-test a claim";$("dialogBody").textContent="The future Epistemic Adversary will distinguish facts, assumptions, uncertainties, and counterarguments. This form does not call an AI model yet."; $("dialogInput").value="";$("dialogInput").placeholder="Paste a claim or plan to examine...";$("dialogSubmit").textContent="Save local note";const old=$("dialogSubmit");old.replaceWith(old.cloneNode(true));$("dialogSubmit").onclick=()=>{const v=$("dialogInput").value.trim();$("dialog").close();toast(v?"Saved only for this interaction; no AI analysis is connected.":"Enter a claim first.");};$("dialog").showModal()};
messages=Array.isArray(window.CHANAKYA_MESSAGES)?window.CHANAKYA_MESSAGES:[];render();
