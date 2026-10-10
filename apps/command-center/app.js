const $=id=>document.getElementById(id);
const labels={overview:"Overview",assistant:"AI Assistant",firewall:"Cognitive Firewall",agents:"Agent Studio",research:"Research",knowledge:"Knowledge",automation:"Automation",models:"Model providers",integrations:"Integrations",activity:"Activity & runs"};
const descriptions={
 overview:"Your unified workspace preview.",
 assistant:"A unified assistant is planned to coordinate models, tools, and task outcomes. No model is connected in this preview.",
 firewall:"The existing local Cognitive Firewall prototype is available in the repository. It currently uses synthetic messages and deterministic rules.",
 agents:"Design specialized agents around a clear job, bounded permissions, and testable success criteria. Agent execution is not connected yet.",
 research:"Evidence-first research workflows are planned. Live web research is not connected to this interface.",
 knowledge:"Shared memory and retrieval are planned. No personal knowledge sources are connected.",
 automation:"Workflow coordination and verified execution are planned. This preview cannot perform external actions.",
 models:"The model gateway will provide a replaceable interface for supported AI providers. No provider credentials or API calls are configured.",
 integrations:"Integrations will be added selectively with least-privilege access. No accounts are connected.",
 activity:"Execution history will distinguish attempted, completed, failed, blocked, and unverified work. This preview has no real task runs."
};
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
function showView(view){
 const name=labels[view]||"Overview";
 $("crumb").textContent=name;
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 $("sidebar").classList.remove("open");
 if(view==="overview"){window.scrollTo({top:0,behavior:"smooth"});return}
 if(view==="firewall"){
  showInfo("Cognitive Firewall","The current local prototype is available at prototype/index.html in the repository. This command-center preview is a UI shell; navigation does not connect or execute product functionality.");
  return;
 }
 showInfo(name,descriptions[view]||"This product module is planned and not implemented yet.");
}
document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.view)));
document.querySelectorAll("[data-action]").forEach(el=>el.addEventListener("click",()=>{
 const action=el.dataset.action;
 if(action==="ask")showInfo("Ask Chanakya", "The shared assistant is planned. No model is connected, and no prompt is sent to a server in this preview.");
 if(action==="agent")showView("agents");
 if(action==="research")showView("research");
}));
function showInfo(title,body){$("dialogTitle").textContent=title;$("dialogText").textContent=body;$("infoDialog").showModal()}
$("helpBtn").addEventListener("click",()=>showInfo("A design preview, not a live AI system","This is Phase 1 of the Chanakya ecosystem: a responsive command-center UI shell. Product cards show intended modules, not completed capabilities. No accounts, model APIs, external tools, or autonomous actions are connected."));
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("sidebar").classList.remove("open")});
