const $=id=>document.getElementById(id);
const labels={overview:"Overview",assistant:"AI Assistant",tasks:"Tasks & Projects",firewall:"Cognitive Firewall",agents:"Agent Studio",research:"Research",knowledge:"Knowledge",automation:"Automation",models:"Model providers",integrations:"Integrations",activity:"Activity & runs",settings:"Settings"};
const moduleInfo={
 assistant:{eyebrow:"YOUR AI WORKSPACE",title:"Think clearly. Move work forward.",description:"A unified assistant will coordinate reasoning, tools, and task outcomes through the shared Chanakya foundation.",status:"IN DESIGN",icon:"✳",capabilities:[["Task understanding","Turn a request into a clear objective and success criteria."],["Model routing","Choose an appropriate provider based on task, privacy, cost, and capability."],["Verified outcomes","Distinguish suggestions, attempts, verified results, and unresolved work."]],next:"Define the task contract and model-provider interface."},
 firewall:{eyebrow:"PRODUCT 01 · COGNITIVE FIREWALL",title:"Protect attention. Surface what matters.",description:"The first product reduces incoming noise to decision-relevant signal, while preserving evidence and keeping the user in control.",status:"LOCAL PROTOTYPE EXISTS",icon:"◈",capabilities:[["Urgency and consequence","Prioritize items requiring timely human attention."],["Evidence and rationale","Inspect why an item was classified and what source supports it."],["Conservative handling","Keep uncertain or consequential items visible instead of silently suppressing them."]],next:"Stabilize classifier regression tests and evaluate false alarms and missed critical items.",link:"../../prototype/index.html",linkText:"Open current Cognitive Firewall prototype"},
 agents:{eyebrow:"AGENT WORKSPACE",title:"Specialists with clear boundaries.",description:"Create purpose-built agents with defined responsibilities, permissions, and measurable completion criteria.",status:"PLANNED",icon:"⌘",capabilities:[["Agent definition","Specify role, inputs, outputs, and completion conditions."],["Bounded tools","Grant only the tools and permissions an agent needs."],["Evaluation","Test behavior against repeatable scenarios before enabling execution."]],next:"Define the agent manifest and runtime contract."},
 research:{eyebrow:"EVIDENCE WORKSPACE",title:"Research that shows its work.",description:"Turn questions into structured findings with source traceability, uncertainty, and explicit gaps in evidence.",status:"PLANNED",icon:"⌕",capabilities:[["Question decomposition","Break a broad question into answerable research tasks."],["Source ledger","Keep findings linked to their supporting sources."],["Evidence review","Separate established facts, inference, and unknowns."]],next:"Define the evidence schema and source quality rubric."},
 knowledge:{eyebrow:"MEMORY & RETRIEVAL",title:"Useful context. Traceable origins.",description:"A shared knowledge layer should retrieve relevant context without blurring source provenance or privacy boundaries.",status:"PLANNED",icon:"▤",capabilities:[["Source-aware memory","Preserve where information came from and when it was observed."],["Relevant retrieval","Bring forward only context useful to the current task."],["User control","Make retention and deletion behavior explicit."]],next:"Define memory boundaries, provenance, and retention rules."},
 automation:{eyebrow:"WORKFLOW ORCHESTRATION",title:"From intention to verified outcome.",description:"Coordinate multi-step workflows, pause for approval when needed, and reconcile the result against the original objective.",status:"PLANNED",icon:"↗",capabilities:[["Workflow state","Track pending, running, blocked, failed, and completed steps."],["Approval gates","Require human authorization for consequential actions."],["Reconciliation","Verify observed results instead of assuming an action succeeded."]],next:"Specify workflow states, permissions, and recovery behavior."},
 models:{eyebrow:"SHARED PLATFORM",title:"Choose models without locking the ecosystem.",description:"A provider-independent gateway will give products a stable interface while making capability, privacy, latency, and cost trade-offs explicit.",status:"PLANNED",icon:"◇",capabilities:[["Provider adapters","Normalize request and response contracts where semantics allow."],["Task routing","Match workloads to appropriate models and tools."],["Cost and reliability","Measure latency, errors, and spend without hiding provider differences."]],next:"Define provider-neutral interfaces and a mocked adapter for tests."},
 integrations:{eyebrow:"TOOLS & CONNECTORS",title:"Connected by permission, not by default.",description:"Integrations will be introduced one at a time, beginning with read-only access and clear scopes.",status:"PLANNED",icon:"⧉",capabilities:[["Least privilege","Request only the access needed for the selected workflow."],["Untrusted input boundary","Treat retrieved content as data, never as system instructions."],["Auditable actions","Record approvals, calls, outcomes, and failures."]],next:"Design the connector permission and audit contract."},
 activity:{eyebrow:"OBSERVABILITY",title:"Know what happened, not just what was attempted.",description:"A trustworthy platform needs an honest record of task state, evidence, failures, and remaining work.",status:"PLANNED",icon:"◷",capabilities:[["Run history","Record task steps and their observed outcomes."],["Evidence freshness","Show when the supporting evidence was last checked."],["Failure visibility","Make retries, blockers, and uncertain outcomes inspectable."]],next:"Define a shared execution event schema."}
};
let homeMarkup="";
function toast(message){if(!readSettings().localNotifications)return;const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
function showInfo(title,body){$("dialogTitle").textContent=title;$("dialogText").textContent=body;$("infoDialog").showModal()}
const SETTINGS_KEY="chanakya.commandCenter.settings.v1";
const defaultSettings={compact:false,reduceMotion:false,localNotifications:true};
function readSettings(){try{return {...defaultSettings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}}catch{return {...defaultSettings}}}
function saveSettings(settings){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));applySettings(settings)}
function applySettings(settings){
 document.body.classList.toggle("compact-mode",!!settings.compact);
 document.body.classList.toggle("reduce-motion",!!settings.reduceMotion);
}
function renderSettings(){
 const s=readSettings();
 const row=(key,title,desc)=>'<label class="setting-row"><span><b>'+title+'</b><small>'+desc+'</small></span><input type="checkbox" data-setting="'+key+'" '+(s[key]?'checked':'')+'></label>';
 document.querySelector(".content").innerHTML='<button class="back-link" id="backOverview">← Back to overview</button><section class="module-hero"><div><div class="eyebrow">WORKSPACE PREFERENCES</div><h1>Make Chanakya work your way.</h1><p>Local preview preferences are saved in this browser only. No account or server sync is connected.</p><span class="module-status">LOCAL SETTINGS</span></div><div class="module-hero-icon">⚙</div></section><section class="settings-grid"><div class="panel settings-panel"><div class="section-heading"><div><h2>Experience</h2><p>Adjust how the workspace looks and behaves.</p></div></div>'+row("compact","Compact layout","Reduce spacing to show more content on screen.")+row("reduceMotion","Reduce motion","Limit animated transitions in the interface.")+'</div><div class="panel settings-panel"><div class="section-heading"><div><h2>Notifications</h2><p>Preview-only preferences, not real alerts.</p></div></div>'+row("localNotifications","UI confirmation toasts","Show brief confirmations after local interface actions.")+'<div class="settings-note">Privacy: these settings stay in this browser local storage. They do not control external services.</div><button class="outline settings-reset" id="resetSettings">Reset preferences</button></div></section><footer><span>CHANAKYA AI</span><span>Preferences stay local in this preview.</span><span>SETTINGS</span></footer>';
 document.querySelectorAll("[data-setting]").forEach(input=>input.addEventListener("change",()=>{const next=readSettings();next[input.dataset.setting]=input.checked;saveSettings(next);toast("Preference saved on this device.")}));
 $("resetSettings").addEventListener("click",()=>{saveSettings({...defaultSettings});renderSettings();toast("Preferences reset.")});
 $("backOverview").addEventListener("click",()=>showView("overview"));
}

function renderTasks(){
 const content=document.querySelector(".content");
 let tasks=ChanakyaTaskEngine.load(localStorage);
 const statusLabel={open:"Open",in_progress:"In progress",blocked:"Blocked",done:"Done"};
 const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const draw=()=>{
  const counts=Object.fromEntries(ChanakyaTaskEngine.STATUSES.map(status=>[status,tasks.filter(task=>task.status===status).length]));
  content.innerHTML='<section class="tasks-header"><div><div class="eyebrow">PERSONAL WORK QUEUE · STORED ON THIS DEVICE</div><h1>Turn intentions into trackable work.</h1><p>Tasks persist in this browser. Chanakya has not performed any external actions.</p></div><div class="task-total"><b>'+tasks.length+'</b><small>total tasks</small></div></section><section class="task-counts">'+ChanakyaTaskEngine.STATUSES.map(status=>'<div class="task-count"><span>'+statusLabel[status]+'</span><b>'+counts[status]+'</b></div>').join("")+'</section><form class="task-create" id="taskCreateForm"><label for="taskTitle">Capture a task or intended outcome</label><textarea id="taskTitle" rows="2" maxlength="4000" placeholder="Example: Prepare a comparison of the options and list the evidence needed." required></textarea><div class="task-create-foot"><small>Creates a local task only. It does not claim to execute the work.</small><button type="submit">＋ Create task</button></div></form><section class="task-list" aria-label="Tasks">'+(tasks.length?tasks.map(task=>'<article class="task-row"><div class="task-row-main"><span class="task-status status-'+task.status+'">'+statusLabel[task.status]+'</span><h2>'+escapeHtml(task.title)+'</h2><p>Created '+new Date(task.createdAt).toLocaleString()+' · '+escapeHtml(task.note||"Local task")+'</p></div><label class="task-state-label" for="state-'+task.id+'">Update status</label><select id="state-'+task.id+'" data-task-state="'+task.id+'">'+ChanakyaTaskEngine.STATUSES.map(status=>'<option value="'+status+'" '+(task.status===status?'selected':'')+'>'+statusLabel[status]+'</option>').join("")+'</select></article>').join(""):'<div class="task-empty"><b>Your queue is clear.</b><p>Create a task above, or send a message from AI Assistant to capture work here.</p></div>')+'</section><footer><span>CHANAKYA AI</span><span>Local task state · No external integrations</span><span>WORK QUEUE</span></footer>';
  document.getElementById("taskCreateForm").addEventListener("submit",event=>{event.preventDefault();try{const result=ChanakyaTaskEngine.add(document.getElementById("taskTitle").value,tasks,localStorage);tasks=result.tasks;draw();toast("Task saved on this device.");}catch(error){toast(error.message)}});
  content.querySelectorAll("[data-task-state]").forEach(select=>select.addEventListener("change",()=>{try{tasks=ChanakyaTaskEngine.setStatus(select.dataset.taskState,select.value,tasks,localStorage);draw();toast("Task status updated.");}catch(error){toast(error.message)}}));
 };
 draw();
}
function renderAssistant(){
 const content=document.querySelector(".content");
 content.innerHTML=`<section class="chat-welcome">
  <div class="eyebrow"><span class="sparkle">✳</span> CHANAKYA AI</div>
  <h1>What can I help you<br><span>think through today?</span></h1>
  <p>One conversation for questions, planning, research, and getting work done.</p>
 </section>
 <section class="chat-workspace" aria-label="AI chat">
  <div class="chat-context"><span class="chat-status-dot"></span><div><b>New conversation</b><small>Private workspace · Preview mode</small></div><button id="newChatBtn" class="new-chat-btn" type="button">＋ New chat</button></div>
  <div class="chat-messages" id="chatMessages" aria-live="polite">
   <div class="assistant-intro"><div class="chat-brand-mark">च</div><div><b>Start with what matters.</b><p>Ask a question, bring a decision, or describe an outcome you want. Chanakya is being built to help you move from intention to verified results.</p></div></div>
   <div class="suggestion-grid" id="chatSuggestions">
    <button class="suggestion-chip" data-prompt="Help me think through an important decision">◈ <span><b>Think through a decision</b><small>Clarify options and trade-offs</small></span><span class="arrow">↗</span></button>
    <button class="suggestion-chip" data-prompt="Help me make a clear plan for my priorities today">☷ <span><b>Plan my priorities</b><small>Turn goals into next steps</small></span><span class="arrow">↗</span></button>
    <button class="suggestion-chip" data-prompt="Help me research a topic and identify what evidence I need">⌕ <span><b>Explore a question</b><small>Structure a research task</small></span><span class="arrow">↗</span></button>
    <button class="suggestion-chip" data-prompt="Help me design an AI agent for a specific task">⌘ <span><b>Design an AI agent</b><small>Define its job and boundaries</small></span><span class="arrow">↗</span></button>
   </div>
  </div>
  <form class="chat-composer" id="chatForm"><label class="sr-only" for="chatInput">Message Chanakya</label><textarea id="chatInput" rows="1" placeholder="Message Chanakya..." maxlength="4000"></textarea><div class="composer-bottom"><span>Preview only · No live AI model connected</span><button type="submit" id="sendChatBtn" aria-label="Send message">↑</button></div></form>
  <p class="chat-disclaimer">Chanakya can make mistakes. Important outcomes will need evidence and verification.</p>
 </section>
 <footer><span>CHANAKYA AI</span><span>Less noise. More verified outcomes.</span><span>PREVIEW MODE</span></footer>`;
 const messages=$("chatMessages"), form=$("chatForm"), input=$("chatInput");
 function sendMessage(value){
  const message=value.trim(); if(!message)return;
  $("chatSuggestions")?.remove();
  const user=document.createElement("div");user.className="chat-message user-message";
  const userBubble=document.createElement("div");userBubble.className="message-bubble";userBubble.textContent=message;user.appendChild(userBubble);
  const reply=document.createElement("div");reply.className="chat-message assistant-message";
  const mark=document.createElement("div");mark.className="chat-brand-mark";mark.textContent="च";
  const body=document.createElement("div");body.className="message-bubble";
  const title=document.createElement("b");title.textContent="The chat interface is ready. The intelligence connection is not.";
  const copy=document.createElement("p");
  try{const result=ChanakyaTaskEngine.add(message,ChanakyaTaskEngine.load(localStorage),localStorage);copy.textContent="I captured this as a local task (“"+result.task.title+"”). It is now in Tasks & Projects with Open status. This is task capture, not AI reasoning or execution; no external action was performed.";}
  catch(error){copy.textContent=error.message;}
  const tasksLink=document.createElement("button");tasksLink.type="button";tasksLink.className="inline-task-link";tasksLink.textContent="Open Tasks & Projects →";tasksLink.addEventListener("click",()=>showView("tasks"));
  body.append(title,copy,tasksLink);reply.append(mark,body);messages.append(user,reply);input.value="";input.style.height="auto";messages.scrollTop=messages.scrollHeight;
 }
 form.addEventListener("submit",e=>{e.preventDefault();sendMessage(input.value)});
 input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,140)+"px"});
 content.querySelectorAll("[data-prompt]").forEach(button=>button.addEventListener("click",()=>{input.value=button.dataset.prompt;input.focus()}));
 $("newChatBtn").addEventListener("click",()=>renderAssistant());
}

function showView(view){
 if(view==="overview")view="assistant";
 const name=labels[view]||"AI Assistant";
 $("crumb").textContent=name;
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 $("sidebar").classList.remove("open");
 const content=document.querySelector(".content");
 if(view==="tasks"){renderTasks();applySettings(readSettings());window.scrollTo({top:0,behavior:"smooth"});return}
 if(view==="assistant"){renderAssistant();applySettings(readSettings());window.scrollTo({top:0,behavior:"smooth"});return}
 if(view==="settings"){renderSettings();applySettings(readSettings());window.scrollTo({top:0,behavior:"smooth"});return}
 if(view==="overview"){content.innerHTML=homeMarkup;window.scrollTo({top:0,behavior:"smooth"});bindHomeActions();return}
 const m=moduleInfo[view];
 if(!m)return;
 const capabilities=m.capabilities.map((c,i)=>'<article class="module-cap"><span class="cap-number">0'+(i+1)+'</span><div><b>'+c[0]+'</b><p>'+c[1]+'</p></div></article>').join("");
 content.innerHTML='<button class="back-link" id="backOverview">← Back to overview</button><section class="module-hero"><div><div class="eyebrow">'+m.eyebrow+'</div><h1>'+m.title+'</h1><p>'+m.description+'</p><span class="module-status">'+m.status+'</span></div><div class="module-hero-icon">'+m.icon+'</div></section><section class="module-layout"><div class="panel module-panel"><div class="section-heading"><div><h2>Capability map</h2><p>Planned boundaries for this product.</p></div></div><div class="module-caps">'+capabilities+'</div></div><aside class="panel next-panel"><div class="eyebrow">NEXT ENGINEERING MILESTONE</div><h2>'+m.next+'</h2><p>This is a roadmap item, not a claim that the capability is already implemented.</p>'+(m.link?'<a class="module-link" href="'+m.link+'">'+m.linkText+' ↗</a>':'')+'<div class="module-boundary"><span class="status-dot"></span><div><b>Current boundary</b><small>No live AI calls, external integrations, or autonomous actions are enabled from this screen.</small></div></div></aside></section><footer><span>CHANAKYA AI</span><span>One intelligence foundation. Specialized products. Verified outcomes.</span><span>DESIGN PREVIEW 01</span></footer>';
 $("backOverview").addEventListener("click",()=>showView("overview"));
 window.scrollTo({top:0,behavior:"smooth"});
}
function bindHomeActions(){
 document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.view)));
 document.querySelectorAll("[data-action]").forEach(el=>el.addEventListener("click",()=>{const action=el.dataset.action;if(action==="ask")showView("assistant");if(action==="agent")showView("agents");if(action==="research")showView("research")}));
}
homeMarkup=document.querySelector(".content").innerHTML;
applySettings(readSettings());
bindHomeActions();
$("brandHome").addEventListener("click",e=>{e.preventDefault();showView("assistant")});
showView("assistant");
$("helpBtn").addEventListener("click",()=>showInfo("A design preview, not a live AI system","This is Phase 1 of the Chanakya ecosystem: a responsive command-center UI shell with local product navigation. Product pages show planned boundaries, not completed capabilities. No accounts, model APIs, external tools, or autonomous actions are connected."));
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("sidebar").classList.remove("open")});
