$("aiPatch").onclick=async()=>{
  if(!projectId||!$("projectFile").value){$("proposalStatus").textContent="Pilih file project terlebih dahulu.";return}
  const request=$("prompt").value.trim();
  if(!request){$("proposalStatus").textContent="Tulis instruksi di AI feature planner terlebih dahulu.";return}
  const button=$("aiPatch");button.disabled=true;$("proposalStatus").textContent="AI sedang menyiapkan usulan...";window.pendingAiProposal=null;
  try{
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/ai/patch-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request,paths:[$("projectFile").value]})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Gagal membuat usulan");
    if(!data.configured||!data.proposal)throw Error(data.message||"Provider AI belum dikonfigurasi.");
    const file=data.proposal.files.find(item=>item.path===$("projectFile").value);
    if(!file)throw Error(data.proposal.summary||"AI tidak mengusulkan perubahan untuk file ini.");
    window.pendingAiProposal={path:file.path,content:file.proposedContent};
    $("proposalContent").value=file.proposedContent;
    $("proposalStatus").textContent=data.proposal.summary+" | "+(file.rationale||"Periksa usulan sebelum diterapkan.")+" | Risiko: "+(data.proposal.risks||[]).join("; ")+" | Tes: "+(data.proposal.tests||[]).join("; ");
  }catch(error){$("proposalStatus").textContent=error.message}finally{button.disabled=false}
};
$("applyProposal").onclick=async()=>{
  const proposal=window.pendingAiProposal;
  if(!projectId||!proposal){$("proposalStatus").textContent="Belum ada usulan AI yang tersedia.";return}
  if(proposal.path!==$("projectFile").value){$("proposalStatus").textContent="File pilihan berubah. Buat usulan baru untuk file ini.";return}
  if(!confirm("Terapkan isi usulan yang sedang terlihat ke file project? Pastikan sudah diperiksa."))return;
  try{
    const content=$("proposalContent").value;
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/file",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:proposal.path,content})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Gagal menerapkan usulan");
    $("fileContent").value=content;$("projectStatus").textContent=data.message;$("proposalStatus").textContent="Usulan diterapkan. Build dan uji APK sebelum digunakan.";window.pendingAiProposal=null;
  }catch(error){$("proposalStatus").textContent=error.message}
};
