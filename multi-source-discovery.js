/* AstroLens multi-archive discovery: live catalogue/observation queries with explicit provenance. */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const panel = document.createElement("section");
  panel.id = "multiSourceHub";
  panel.className = "multi-source-hub";
  panel.innerHTML = `
    <div class="msh-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> MULTI-ARCHIVE INTELLIGENCE</div><h2>Look beyond one observatory<span class="heading-period">.</span></h2><p>Resolve a target, compare independent catalogues, and find nearby archive observations. These are live source queries, not invented detections.</p></div><span class="msh-chip">LIVE SOURCES · ON DEMAND</span></div>
    <form id="mshForm" class="msh-search"><label for="mshTarget">Target name or catalogue identifier</label><div class="msh-input-row"><input id="mshTarget" value="TRAPPIST-1" maxlength="120" placeholder="e.g. M31, Vega, TIC 307210830" required><button class="primary" id="mshRun" type="submit">Query archives <span>→</span></button></div><p class="msh-help">SIMBAD resolves the object first. Gaia and VizieR search nearby catalogue entries; ESO searches observation metadata around the resolved sky position.</p></form>
    <div id="mshStatus" class="status-message" role="status">Ready. Queries run only when you ask, and results retain their source links.</div>
    <div id="mshResolved" class="msh-resolved" hidden></div>
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
  .multi-source-hub{margin:24px 0 30px;padding:clamp(16px,2.4vw,26px);border:1px solid #7dc9e526;border-radius:22px;background:linear-gradient(145deg,#0c1a2bdf,#081321ed 62%,#0b1725e8);box-shadow:inset 0 1px #ffffff0c,0 16px 44px #0002}
  .msh-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.msh-head h2{margin:8px 0;font-size:clamp(21px,2.5vw,30px);letter-spacing:-.04em}.msh-head p{max-width:700px;color:#9cb1c6;font-size:13px;line-height:1.65;margin:0}
  .msh-chip{white-space:nowrap;border:1px solid #67d6e52e;border-radius:999px;padding:8px 11px;color:#8fe8f3;font:10px 'DM Mono',monospace;letter-spacing:.08em}
  .msh-search{margin:22px 0 12px;padding:15px;border:1px solid #9cc9e51c;border-radius:15px;background:#030b16a8}.msh-search label{display:block;color:#c9d9e8;font-size:12px;font-weight:700;margin-bottom:9px}.msh-input-row{display:flex;gap:10px}.msh-input-row input{flex:1;min-width:0;background:#081626;border:1px solid #7db9d52d;border-radius:10px;color:#effaff;padding:12px 13px;font:inherit;outline:none}.msh-input-row input:focus{border-color:#68d5e8a6;box-shadow:0 0 0 3px #68d5e814}.msh-input-row button{white-space:nowrap}.msh-help,.msh-foot{font-size:11px;line-height:1.6;color:#8099af;margin:10px 0 0}.msh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:15px}.msh-source{min-width:0;padding:15px;border-radius:15px;border:1px solid #7ca6c21d;background:#071321b8}.msh-source-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.msh-mark{display:grid;place-items:center;width:31px;height:31px;flex:none;border-radius:9px;background:#163044;color:#8be3ef;font:11px 'DM Mono',monospace}.msh-source-head strong{display:block;font-size:13px;color:#e4f1fb}.msh-source-head small{display:block;color:#849db3;font-size:10px;margin-top:3px}.msh-state{margin-left:auto;color:#7f9bb1;font:9px 'DM Mono',monospace;letter-spacing:.07em}.msh-state.live{color:#76e0b5}.msh-state.error{color:#ff9a9a}.msh-output{min-height:52px;color:#a7bdcf;font-size:11px;line-height:1.55;overflow-wrap:anywhere}.msh-source>a{display:inline-block;margin-top:12px;color:#7bd7e8;font-size:11px;text-decoration:none}.msh-table-wrap{max-width:100%;overflow:auto;margin-top:8px}.msh-table{border-collapse:collapse;width:100%;font-size:10px;color:#bcd0e0}.msh-table th,.msh-table td{text-align:left;padding:7px 8px;border-bottom:1px solid #ffffff0b;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis}.msh-table th{color:#75d5e8;font:9px 'DM Mono',monospace;text-transform:uppercase}.msh-resolved{margin-top:12px;padding:13px 15px;border-radius:12px;border:1px solid #61dfb13b;background:#0b2b27a1;color:#c5f5e3;font-size:12px;line-height:1.6}.msh-resolved a{color:#8ee9ff}.msh-foot{margin-top:15px}
  @media(max-width:650px){.msh-head{display:block}.msh-chip{display:inline-block;margin-top:12px}.msh-grid{grid-template-columns:1fr}.msh-input-row{flex-direction:column}.msh-input-row button{width:100%}.msh-source{padding:13px}}
  `;
  document.head.appendChild(style);
  const status = $("#mshStatus");
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
      const simbadRaw=await tap("https://simbad.cds.unistra.fr/simbad/sim-tap/sync","SELECT TOP 5 main_id,ra,dec,otype,sp_type FROM basic WHERE ident='"+safe+"'","csv");
      const simbad=parseCSV(simbadRaw), sh=simbad[0].map(x=>x.toLowerCase().trim()), si=n=>sh.indexOf(n);
      if(si("ra")<0||si("dec")<0||simbad.length<2)throw Error("SIMBAD could not resolve this name. Try a standard object name or catalogue identifier.");
      const sr=simbad[1], get=n=>sr[si(n)]||"", ra=Number(get("ra")),dec=Number(get("dec"));
      if(!Number.isFinite(ra)||!Number.isFinite(dec))throw Error("SIMBAD returned invalid sky coordinates.");
      state("simbad","LIVE",table(simbad,3),"live");
      const id=get("main_id")||target, radius=0.0166666667;
      const resolved=$("#mshResolved");resolved.innerHTML="<strong>Resolved object: "+esc(id)+"</strong><br>ICRS coordinates: RA "+esc(get("ra"))+"°, Dec "+esc(get("dec"))+"°<br>Object type: "+esc(get("otype")||"not supplied")+" · Spectral type: "+esc(get("sp_type")||"not supplied")+"<br><a href=\"https://simbad.cds.unistra.fr/simbad/sim-id?Ident="+encodeURIComponent(id)+"\" target=\"_blank\" rel=\"noreferrer\">Open resolved object record ↗</a>";resolved.hidden=false;
      const circle="1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',"+adqlNum(ra)+","+adqlNum(dec)+","+radius+"))";
      const jobs=[
        ["gaia",()=>tap("https://gea.esac.esa.int/tap-server/tap/sync","SELECT TOP 12 source_id,ra,dec,parallax,parallax_error,pmra,pmdec,phot_g_mean_mag FROM gaiadr3.gaia_source WHERE "+circle+" ORDER BY phot_g_mean_mag ASC")],
        ["vizier",()=>tap("https://tapvizier1.cds.unistra.fr/TAPVizieR/tap/sync","SELECT TOP 12 * FROM \"II/246/out\" WHERE 1=CONTAINS(POINT('ICRS',RAJ2000,DEJ2000),CIRCLE('ICRS',"+adqlNum(ra)+","+adqlNum(dec)+","+radius+"))")],
        ["eso",()=>tap("https://archive.eso.org/tap_obs/sync","SELECT TOP 12 target_name,instrument_name,dataproduct_type,s_ra,s_dec FROM ivoa.ObsCore WHERE 1=CONTAINS(POINT('ICRS',s_ra,s_dec),CIRCLE('ICRS',"+adqlNum(ra)+","+adqlNum(dec)+",0.05))")]
      ];
      const settled=await Promise.allSettled(jobs.map(async ([key,fn])=>{const raw=await fn(),rows=parseCSV(raw);if(rows.length<2){state(key,"NO ROWS","The service responded, but no rows matched this search.");return;}state(key,"LIVE",table(rows,6),"live");}));
      settled.forEach((r,i)=>{if(r.status==="rejected"){const key=jobs[i][0];state(key,"UNAVAILABLE","<p>"+esc(r.reason?.message||"Query failed.")+"</p>","error");}});
      const good=settled.filter(x=>x.status==="fulfilled").length;
      status.textContent="Queries finished for "+id+". SIMBAD resolved the target; "+good+" of 3 independent archive queries returned successfully. Review each source and its angular search radius before interpreting a match.";
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