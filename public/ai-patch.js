function saveActiveProposalEditor(){
  const proposal=window.pendingAiProposal;
  if(!proposal||!proposal.activePath)return;
  const active=proposal.files.find(item=>item.path===proposal.activePath);
  if(active)active.proposedContent=$("proposalContent").value;
}
$("proposalFileSelect").onchange=()=>{
  saveActiveProposalEditor();
  const proposal=window.pendingAiProposal;
  if(!proposal)return;
  proposal.activePath=$("proposalFileSelect").value;
  const active=proposal.files.find(item=>item.path===proposal.activePath);
  if(active)$("proposalContent").value=active.proposedContent;
};
$("aiPatch").onclick=async()=>{
  if(!projectId||!$("projectFile").value){$("proposalStatus").textContent="Pilih file project terlebih dahulu.";return}
  const request=$("prompt").value.trim();
  if(!request){$("proposalStatus").textContent="Tulis instruksi di AI feature planner terlebih dahulu.";return}
  const selectedPaths=[...$("aiFiles").selectedOptions].map(option=>option.value).slice(0,5);
  const paths=selectedPaths.length?selectedPaths:[$("projectFile").value];
  const button=$("aiPatch");button.disabled=true;$("proposalStatus").textContent="AI sedang membaca konteks dan menyiapkan usulan lintas-file...";window.pendingAiProposal=null;
  try{
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/ai/patch-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request,paths})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Gagal membuat usulan");
    if(!data.configured||!data.proposal)throw Error(data.message||"Provider AI belum dikonfigurasi.");
    const files=data.proposal.files||[];
    if(!files.length)throw Error(data.proposal.summary||"AI tidak mengusulkan perubahan untuk file yang dipilih. Pilih file sumber yang lebih relevan.");
    window.pendingAiProposal={files:files.map(file=>({path:file.path,proposedContent:file.proposedContent,rationale:file.rationale||""})),request,summary:data.proposal.summary,activePath:files[0].path};
    const select=$("proposalFileSelect");select.replaceChildren();
    for(const file of files){const option=document.createElement("option");option.value=file.path;option.textContent=file.path;select.append(option)}
    select.hidden=files.length<2;
    $("proposalContent").value=files[0].proposedContent;
    $("proposalStatus").textContent=data.proposal.summary+" | File: "+files.map(file=>file.path).join(", ")+" | Asumsi: "+(data.proposal.assumptions||[]).join("; ")+" | Risiko: "+(data.proposal.risks||[]).join("; ")+" | Tes: "+(data.proposal.tests||[]).join("; ")+" | Memori dipakai: "+(data.learning?.usedExamples||0)+" pola disetujui sebelumnya. Tinjau setiap file melalui pilihan di atas sebelum menerapkan.";
  }catch(error){$("proposalStatus").textContent=error.message}finally{button.disabled=false}
};
$("applyProposal").onclick=async()=>{
  const proposal=window.pendingAiProposal;
  if(!projectId||!proposal){$("proposalStatus").textContent="Belum ada usulan AI yang tersedia.";return}
  saveActiveProposalEditor();
  if(!confirm("Terapkan seluruh "+proposal.files.length+" perubahan file yang sudah ditinjau? Perubahan akan memiliki backup."))return;
  try{
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/ai/apply-patch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({files:proposal.files})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Gagal menerapkan patch");
    const current=proposal.files.find(file=>file.path===$("projectFile").value);
    if(current)$("fileContent").value=current.proposedContent;
    $("projectStatus").textContent=data.message+" File: "+data.updated.map(file=>file.path).join(", ");
    let learned="";
    try{
      const memoryResponse=await fetch("/api/ai/learn",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request:proposal.request,summary:proposal.summary,fileTypes:proposal.files.map(file=>"."+file.path.split(".").pop())})});
      const memoryData=await memoryResponse.json();
      if(memoryResponse.ok)learned=" Pola request disimpan untuk membantu permintaan serupa berikutnya.";
    }catch{}
    $("proposalStatus").textContent="Patch diterapkan ke "+data.updated.length+" file. Build dan uji project sebelum digunakan."+learned;
    window.pendingAiProposal=null;$("proposalFileSelect").hidden=true;
  }catch(error){$("proposalStatus").textContent=error.message}
};
