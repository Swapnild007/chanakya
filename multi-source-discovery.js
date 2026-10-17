/* AstroLens multi-archive discovery: live catalogue/observation queries with explicit provenance. */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const panel = document.createElement("section");
  panel.id = "multiSourceHub";
  panel.className = "multi-source-hub";
  panel.innerHTML = `
    <div class="msh-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> MULTI-ARCHIVE INTELLIGENCE</div><h2>Look beyond one observatory<span class="heading-period">.</span></h2><p>Resolve a target, compare independent catalogues, and find nearby archive observations. These are live source queries, not invented detections.</p></div><span class="msh-chip">LIVE SOURCES · ON DEMAND</span></div>
    <form id="mshForm" class="msh-search"><label for="mshTarget">Target name or catalogue identifier</label><div class="msh-input-row"><input id="mshTarget" value="TRAPPIST-1" maxlength="120" placeholder="e.g. M31, Vega, TIC 307210830" required><button class="primary" id="mshRun" type="submit">Query archives <span>→</span></button></div><div class="msh-query-options"><label for="mshRadius">Cross-match radius</label><select id="mshRadius"><option value="0.0166666667">1 arcminute · precise</option><option value="0.0833333333" selected>5 arcminutes · balanced</option><option value="0.5">30 arcminutes · wide field</option></select><span class="msh-live-note"><i></i> Live public archives</span></div><p class="msh-help">SIMBAD resolves the object first. Gaia and VizieR search nearby catalogue entries; ESO searches observation metadata around the resolved sky position.</p></form>
    <div id="mshStatus" class="status-message" role="status">Ready. Queries run only when you ask, and results retain their source links.</div>
    <div id="mshResolved" class="msh-resolved" hidden></div><div class="msh-results-toolbar"><span id="mshResultCount">No query run yet</span><button id="mshCopyCoords" type="button" disabled>Copy coordinates</button><button id="mshExport" type="button" disabled>Export report</button></div>
    <div class="msh-grid">
      <article class="msh-source" data-source="simbad"><div class="msh-source-head"><span class="msh-mark">01</span><div><strong>SIMBAD</strong><small>Object identity & coordinates</small></div><span class="msh-state">READY</span></div><div class="msh-output">Waiting for query.</div><a href="https://simbad.cds.unistra.fr/simbad/" target="_blank" rel="noreferrer">Open SIMBAD ↗</a></article>
      <article class="msh-source" data-source="gaia"><div class="msh-source-head"><span class="msh-mark">02</span><div><strong>ESA Gaia DR3</strong><small>Astrometry & stellar photometry</small></div><span class="msh-state">READY</span></div><div class="msh-output">Waiting for coordinates.</div><a href="https://gea.esac.esa.int/archive/" target="_blank" rel="noreferrer">Open Gaia Archive ↗</a></article>
      <article class="msh-source" data-source="vizier"><div class="msh-source-head"><span class="msh-mark">03</span><div><strong>CDS VizieR · 2MASS</strong><small>Independent infrared catalogue</small></div><span class="msh-state">READY</span></div><div class="msh-output">Waiting for coordinates.</div><a href="https://vizier.cds.unistra.fr/" target="_blank" rel="noreferrer">Open VizieR ↗</a></article>
      <article class="msh-source" data-source="eso"><div class="msh-source-head"><span class="msh-mark">04</span><div><strong>ESO Science Archive</strong><small>Public observation metadata</small></div><span class="msh-state">READY</span></div><div class="msh-output">Waiting for coordinates.</div><a href="https://archive.eso.org/" target="_blank" rel="noreferrer">Open ESO Archive ↗</a></article>
    </div>
    <p class="msh-foot">Scientific guardrails: a catalogue match is not a new discovery; a nearby source is not automatically the same object. Failed browser/API access is reported as unavailable, never counted as zero detections.</p>`;
  const workspace = $("#explorer");
  if (!workspace) return;
  const candidateList = $("#candidateList");
  if (candidateList) workspace.insertBefore(panel, candidateList);
  else workspace.prepend(panel);
  const style = document.createElement("style");
  style.textContent = `
  .multi-source-hub{position:relative;isolation:isolate;overflow:hidden;margin:24px 0 30px;padding:clamp(16px,2.4vw,26px);border:1px solid #b9eaff25;border-radius:26px;background:linear-gradient(135deg,#132a3bc9 0%,#0a1b2bd9 42%,#0a1425d9 100%);box-shadow:inset 0 1px #ffffff23,inset 0 -1px #a4e7ff0b,0 22px 70px #0005;-webkit-backdrop-filter:blur(28px) saturate(155%);backdrop-filter:blur(28px) saturate(155%)}.multi-source-hub:before{content:"";position:absolute;z-index:-1;inset:0;pointer-events:none;background:radial-gradient(80% 55% at 0% 0%,#67dfff19,transparent 68%),radial-gradient(70% 50% at 100% 100%,#6f8dff12,transparent 70%)}.multi-source-hub:after{content:"";position:absolute;top:0;left:8%;right:8%;height:1px;pointer-events:none;background:linear-gradient(90deg,transparent,#d6f8ff7d,transparent)}
  .msh-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.msh-head h2{margin:8px 0;font-size:clamp(21px,2.5vw,30px);letter-spacing:-.04em}.msh-head p{max-width:700px;color:#9cb1c6;font-size:13px;line-height:1.65;margin:0}
  .msh-chip{white-space:nowrap;border:1px solid #67d6e52e;border-radius:999px;padding:8px 11px;color:#8fe8f3;font:10px 'DM Mono',monospace;letter-spacing:.08em}
  .msh-search{position:relative;margin:20px 0 12px;padding:15px;border:1px solid #b6e6ff27;border-radius:17px;background:linear-gradient(145deg,#ffffff0d,#9adfff04);box-shadow:inset 0 1px #ffffff15,0 8px 24px #0002;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}.msh-search label{display:block;color:#c9d9e8;font-size:12px;font-weight:700;margin-bottom:9px}.msh-input-row{display:flex;gap:10px}.msh-input-row input{flex:1;min-width:0;background:#06111dcc;border:1px solid #91dfff3d;border-radius:12px;color:#effaff;padding:12px 13px;font:inherit;outline:none;box-shadow:inset 0 1px #ffffff08}.msh-input-row input:focus{border-color:#68d5e8a6;box-shadow:0 0 0 3px #68d5e814}.msh-input-row button{white-space:nowrap}.msh-help,.msh-foot{font-size:11px;line-height:1.6;color:#8099af;margin:10px 0 0}.msh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:15px}.msh-source{position:relative;display:block!important;min-width:0;min-height:0!important;height:auto!important;align-self:start;padding:15px;border-radius:19px;border:1px solid #b8e7ff20;background:linear-gradient(145deg,#d7f4ff0c,#6eb8e607 45%,#07132170);box-shadow:inset 0 1px #ffffff16,inset 0 -1px #9bdcff09,0 12px 30px #0002;-webkit-backdrop-filter:blur(22px) saturate(140%);backdrop-filter:blur(22px) saturate(140%);transition:border-color .25s ease,transform .25s ease,background .25s ease}.msh-source:before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(115deg,#ffffff08,transparent 38%,#8edfff06)}.msh-source:hover{border-color:#8fe5ff4a;transform:translateY(-2px);background:linear-gradient(145deg,#d7f4ff12,#6eb8e60a 45%,#07132188)}.msh-source-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.msh-mark{display:grid;place-items:center;width:31px;height:31px;flex:none;border-radius:9px;background:#163044;color:#8be3ef;font:11px 'DM Mono',monospace}.msh-source-head strong{display:block;font-size:13px;color:#e4f1fb}.msh-source-head small{display:block;color:#849db3;font-size:10px;margin-top:3px}.msh-state{margin-left:auto;color:#7f9bb1;font:9px 'DM Mono',monospace;letter-spacing:.07em}.msh-state.live{color:#76e0b5}.msh-state.error{color:#ff9a9a}.msh-output{min-height:0!important;color:#a7bdcf;font-size:11px;line-height:1.55;overflow-wrap:anywhere}.msh-source>a{display:inline-block;margin-top:12px;color:#8fe5f5;font-size:11px;text-decoration:none}.msh-source>a:hover{text-decoration:underline}.msh-query-options{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}.msh-query-options label{margin:0;font-size:11px;color:#9db5c9}.msh-query-options select{background:#091827d9;color:#dff6ff;border:1px solid #8ed9f33a;border-radius:9px;padding:8px 10px;font-size:11px;max-width:100%}.msh-live-note{display:inline-flex;align-items:center;gap:7px;margin-left:auto;color:#8fc8d4;font-size:10px}.msh-live-note i{width:6px;height:6px;border-radius:50%;background:#65e5b5;box-shadow:0 0 10px #65e5b580}.msh-results-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0 2px;color:#8da8bd;font:10px 'DM Mono',monospace}.msh-results-toolbar span{margin-right:auto}.msh-results-toolbar button{border:1px solid #9edfff30;border-radius:999px;background:#d7f4ff08;color:#aeeeff;padding:7px 10px;font-size:10px}.msh-results-toolbar button:disabled{opacity:.38}.msh-results-toolbar button:not(:disabled):active{transform:scale(.97)}.msh-table-wrap{max-width:100%;overflow:auto;margin-top:8px}.msh-table{border-collapse:collapse;width:100%;font-size:10px;color:#bcd0e0}.msh-table th,.msh-table td{text-align:left;padding:7px 8px;border-bottom:1px solid #ffffff0b;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}.msh-table th{color:#75d5e8;font:9px 'DM Mono',monospace;text-transform:uppercase}.msh-resolved{position:relative;margin-top:12px;padding:13px 15px;border-radius:15px;border:1px solid #75e9c83a;background:linear-gradient(130deg,#0f4b4085,#0d2b32a8);box-shadow:inset 0 1px #ffffff12;color:#c5f5e3;font-size:12px;line-height:1.6;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}.msh-resolved a{color:#8ee9ff}.msh-foot{margin-top:15px}
  @media(max-width:650px){.multi-source-hub{margin:15px -2px 24px;padding:15px 12px 16px;border-radius:22px;background:linear-gradient(145deg,#142c40d9,#081727e8 65%,#0a1425ed);box-shadow:inset 0 1px #ffffff22,0 16px 45px #0004}.msh-head{display:block}.msh-head h2{font-size:23px;line-height:1.18}.msh-head p{font-size:12px}.msh-chip{display:inline-block;margin-top:10px;padding:6px 9px;font-size:9px}.msh-search{margin:14px 0 10px;padding:12px}.msh-input-row{flex-direction:column}.msh-input-row input{padding:12px}.msh-input-row button{width:100%;min-height:44px}.msh-query-options{gap:8px}.msh-query-options select{flex:1;min-width:0}.msh-live-note{margin-left:0}.msh-grid{grid-template-columns:1fr;gap:9px;margin-top:11px}.msh-source{padding:12px 13px;border-radius:17px}.msh-source-head{gap:9px;margin-bottom:7px}.msh-mark{width:32px;height:32px;border-radius:10px}.msh-source-head strong{font-size:13px}.msh-source-head small{font-size:10px}.msh-output{font-size:11px;line-height:1.45}.msh-source>a{margin-top:8px;font-size:11px}.msh-table th,.msh-table td{padding:6px}.msh-foot{font-size:10px}.msh-results-toolbar{position:static;gap:6px}.msh-results-toolbar button{padding:8px 9px}.msh-help{font-size:10px}}@media(prefers-reduced-motion:reduce){.msh-source{transition:none!important}}
  `;
  document.head.appendChild(style);
  const status = $("#mshStatus");
  let lastReport = null;
  const radiusSelect = $("#mshRadius");
  const copyCoords = $("#mshCopyCoords"), exportBtn = $("#mshExport"), resultCount = $("#mshResultCount");
  copyCoords.addEventListener("click", async () => { if(!lastReport?.coordinates)return; try { await navigator.clipboard.writeText(lastReport.coordinates); copyCoords.textContent="Copied ✓"; setTimeout(()=>copyCoords.textContent="Copy coordinates",1400); } catch { status.textContent="Clipboard access was blocked. Coordinates: "+lastReport.coordinates; } });
  exportBtn.addEventListener("click", () => { if(!lastReport)return; const blob=new Blob([JSON.stringify(lastReport,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="astrolens-archive-report-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url); });

  const form = $("#mshForm");
  const targetInput = $("#mshTarget");
  const cards = Object.fromEntries(["simbad","gaia","vizier","eso"].map(k=>[k,$('.msh-source[data-source="'+k+'"]')]));
  let busy = false;
  function state(key, label, body, kind="") {
    const card=cards[key]; if(!card)return;
    const badge=card.querySelector(".msh-state"), out=card.querySelector(".msh-output");
    badge.textContent=label;badge.className="msh-state "+kind;out.innerHTML=body;
  }
  function parseCSV(text) {
    const rows=[];let row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){row.push(cell);cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell="";}else cell+=c;}
    row.push(cell);if(row.some(v=>v.trim()))rows.push(row);if(rows.length<2)throw Error("No tabular rows returned.");return rows;
  }
  async function tap(url, query, format="csv") {
    const params=new URLSearchParams({REQUEST:"doQuery",LANG:"ADQL",FORMAT:format,QUERY:query});
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),25000);
    try {const res=await fetch(url+"?"+params.toString(),{signal:controller.signal,headers:{Accept:format==="csv"?"text/csv":"*/*"}});if(!res.ok)throw Error("HTTP "+res.status);const text=await res.text();if(/<html|<!doctype html/i.test(text.slice(0,500)))throw Error("Service returned an HTML page instead of query data.");return text;}
    catch(e){if(e.name==="AbortError")throw Error("Query timed out after 25 seconds.");if(e instanceof TypeError)throw Error("Browser blocked the archive request (often a CORS/network restriction). Open the source link below; this is not a zero-result search.");throw e;}
    finally{clearTimeout(timer);}
  }
  function table(rows, maxRows=6) {
    const headers=rows[0], data=rows.slice(1,maxRows+1);
    if(!data.length)return "<p>No matching rows returned for this query.</p>";
    return '<div class="msh-table-wrap"><table class="msh-table"><thead><tr>'+headers.map(h=>"<th>"+esc(h)+"</th>").join("")+'</tr></thead><tbody>'+data.map(r=>"<tr>"+headers.map((_,i)=>"<td>"+esc(r[i]||"")+"</td>").join("")+"</tr>").join("")+'</tbody></table></div><small>Showing '+data.length+' of '+Math.max(0,rows.length-1)+' returned rows.</small>';
  }
  function adqlNum(n){return Number(n).toFixed(7);}
  async function run(e) {
    e?.preventDefault(); if(busy)return;
    const target=targetInput.value.trim();if(!target)return;
    busy=true;$("#mshRun").disabled=true;$("#mshRun").textContent="Querying…";$("#mshResolved").hidden=true;
    status.textContent="Resolving "+target+" with SIMBAD before issuing coordinate-based catalogue and archive queries…";status.className="status-message";
    for(const k of Object.keys(cards))state(k,"QUERYING","Connecting to the public service…");
    try {
      const safe=target.replace(/'/g,"''");
      const simbadUrl="https://simbad.cds.unistra.fr/simbad/sim-tap/sync";
      let simbadRaw, simbad, simbadError;
      const resolutionQueries=[
        "SELECT TOP 5 b.main_id,b.ra,b.dec,b.otype,b.sp_type FROM ident AS i JOIN basic AS b ON i.oidref=b.oid WHERE i.id='"+safe+"'",
        "SELECT TOP 5 main_id,ra,dec,otype,sp_type FROM basic WHERE main_id='"+safe+"'"
      ];
      for(const query of resolutionQueries){
        try{
          const raw=await tap(simbadUrl,query,"csv");
          const parsed=parseCSV(raw);
          const heads=parsed[0].map(x=>x.toLowerCase().trim());
          if(heads.includes("ra")&&heads.includes("dec")&&parsed.length>1){simbadRaw=raw;simbad=parsed;break;}
          simbadError=Error("SIMBAD query returned no matching coordinate row.");
        }catch(err){simbadError=err;}
      }
      if(!simbad)throw Error("SIMBAD resolution failed after identifier-table and exact-main-ID queries. "+(simbadError?.message||"No coordinate row returned.")+" Open SIMBAD directly to verify the target.");
      const sh=simbad[0].map(x=>x.toLowerCase().trim()), si=n=>sh.indexOf(n);
      const sr=simbad[1], get=n=>sr[si(n)]||"", ra=Number(get("ra")),dec=Number(get("dec"));
      if(!Number.isFinite(ra)||!Number.isFinite(dec))throw Error("SIMBAD returned invalid sky coordinates.");
      state("simbad","LIVE",table(simbad,3),"live");
      const id=get("main_id")||target, radius=Number(radiusSelect.value);
      const resolved=$("#mshResolved");resolved.innerHTML="<strong>Resolved object: "+esc(id)+"</strong><br>ICRS coordinates: RA "+esc(get("ra"))+"°, Dec "+esc(get("dec"))+"°<br>Object type: "+esc(get("otype")||"not supplied")+" · Spectral type: "+esc(get("sp_type")||"not supplied")+"<br><a href=\"https://simbad.cds.unistra.fr/simbad/sim-id?Ident="+encodeURIComponent(id)+"\" target=\"_blank\" rel=\"noreferrer\">Open resolved object record ↗</a>";resolved.hidden=false;
      const circle="1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',"+adqlNum(ra)+","+adqlNum(dec)+","+radius+"))";
      const jobs=[
        ["gaia",()=>tap("https://gea.esac.esa.int/tap-server/tap/sync","SELECT TOP 12 source_id,ra,dec,parallax,parallax_error,pmra,pmdec,phot_g_mean_mag FROM gaiadr3.gaia_source WHERE "+circle+" ORDER BY phot_g_mean_mag ASC")],
        ["vizier",()=>tap("https://tapvizier1.cds.unistra.fr/TAPVizieR/tap/sync","SELECT TOP 12 * FROM \"II/246/out\" WHERE 1=CONTAINS(POINT('ICRS',RAJ2000,DEJ2000),CIRCLE('ICRS',"+adqlNum(ra)+","+adqlNum(dec)+","+radius+"))")],
        ["eso",()=>tap("https://archive.eso.org/tap_obs/sync","SELECT TOP 12 target_name,instrument_name,dataproduct_type,s_ra,s_dec FROM ivoa.ObsCore WHERE 1=CONTAINS(POINT('ICRS',s_ra,s_dec),CIRCLE('ICRS',"+adqlNum(ra)+","+adqlNum(dec)+",0.05))")]
      ];
      const archiveResults={simbad:simbad.slice(0,4).map(r=>r.map(v=>v)),gaia:null,vizier:null,eso:null};
      const settled=await Promise.allSettled(jobs.map(async ([key,fn])=>{const raw=await fn(),rows=parseCSV(raw);archiveResults[key]=rows.slice(0,13).map(r=>r.map(v=>v));if(rows.length<2){state(key,"NO ROWS","The service responded, but no rows matched this search.");return;}state(key,"LIVE",table(rows,6),"live");}));
      settled.forEach((r,i)=>{if(r.status==="rejected"){const key=jobs[i][0];state(key,"UNAVAILABLE","<p>"+esc(r.reason?.message||"Query failed.")+"</p>","error");}});
      const good=settled.filter(x=>x.status==="fulfilled").length;
      lastReport={generatedAt:new Date().toISOString(),target:target,resolvedObject:id,coordinates:ra.toFixed(7)+", "+dec.toFixed(7),objectType:get("otype")||null,spectralType:get("sp_type")||null,searchRadiusDegrees:radius,sources:archiveResults,sourceUrls:{simbad:"https://simbad.cds.unistra.fr/simbad/",gaia:"https://gea.esac.esa.int/archive/",vizier:"https://vizier.cds.unistra.fr/",eso:"https://archive.eso.org/"}};
      copyCoords.disabled=false;exportBtn.disabled=false;resultCount.textContent=(1+good)+"/4 source queries responded";
      status.textContent="Queries finished for "+id+". SIMBAD resolved the target; "+good+" of 3 independent archive queries returned successfully. Search radius: "+(radius*60).toFixed(0)+" arcmin. Nearby catalogue rows are cross-match candidates, not confirmed identities.";
      status.className="status-message "+(good===3?"success":"");
    } catch(err) {
      state("simbad","UNAVAILABLE","<p>"+esc(err.message||"Query failed.")+"</p>","error");
      for(const k of ["gaia","vizier","eso"])state(k,"NOT RUN","Coordinate query requires a successful SIMBAD resolution.");
      status.textContent="Target resolution failed: "+(err.message||"Unknown error")+". Check the spelling or use the official source link. No result is treated as a negative detection.";
      status.className="status-message error";
    } finally {busy=false;$("#mshRun").disabled=false;$("#mshRun").innerHTML='Query archives <span>→</span>';}
  }
  form.addEventListener("submit",run);
  targetInput.addEventListener("keydown",e=>{if(e.key==="Enter")run(e)});
})();