$("undoFile").onclick=async()=>{
  if(!projectId||!$("projectFile").value){$("projectStatus").textContent="Pilih file project terlebih dahulu.";return}
  if(!confirm("Pulihkan backup terakhir untuk file ini?"))return;
  try{
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/undo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:$("projectFile").value})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Undo gagal");
    $("projectStatus").textContent=data.message;
    $("loadFile").click();
  }catch(error){$("projectStatus").textContent=error.message}
};
$("replaceAsset").onclick=async()=>{
  if(!projectId){$("assetStatus").textContent="Decode APK dan buka project terlebih dahulu.";return}
  const file=$("assetFile").files[0],destination=$("assetPath").value.trim();
  if(!file||!destination){$("assetStatus").textContent="Pilih file aset dan isi path tujuan.";return}
  if(destination.startsWith("/")||destination.split(/[\\/]/).includes("..")){$("assetStatus").textContent="Path tujuan harus relatif dan tidak boleh memakai ..";return}
  const button=$("replaceAsset");button.disabled=true;$("assetStatus").textContent="Mengganti aset...";
  try{
    const form=new FormData();form.append("path",destination);form.append("file",file);
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/asset",{method:"PUT",body:form});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Penggantian aset gagal");
    $("assetStatus").textContent=data.message+" ("+data.size+" bytes)";
    await refreshFiles();
  }catch(error){$("assetStatus").textContent=error.message}finally{button.disabled=false}
};

$("undoAsset").onclick=async()=>{
  if(!projectId){$("assetStatus").textContent="Buka project APK terlebih dahulu.";return}
  const path=$("assetPath").value.trim();
  if(!path){$("assetStatus").textContent="Masukkan path aset yang ingin dipulihkan.";return}
  if(!confirm("Pulihkan backup terakhir untuk aset ini?"))return;
  try{
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/asset/undo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path})});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Undo aset gagal");
    $("assetStatus").textContent=data.message;
  }catch(error){$("assetStatus").textContent=error.message}
};

$("signApk").onclick=async()=>{
  if(!projectId){$("signResult").textContent="Decode dan build APK terlebih dahulu.";return}
  if(!confirm("Tandatangani APK menggunakan signing key yang dikonfigurasi di server?"))return;
  const button=$("signApk");button.disabled=true;$("signResult").textContent="Menandatangani dan memverifikasi APK...";
  try{
    const response=await fetch("/api/projects/"+encodeURIComponent(projectId)+"/sign",{method:"POST"});
    const data=await response.json();if(!response.ok)throw Error(data.error||"Signing gagal");
    $("signResult").textContent=data.message+" "+data.artifact.name+" ("+data.artifact.size+" bytes). ";
    const link=document.createElement("a");link.href="/api/projects/"+encodeURIComponent(projectId)+"/signed-artifact";link.textContent="Download APK signed";link.style.display="block";link.style.marginTop="8px";$("signResult").append(link);
  }catch(error){$("signResult").textContent=error.message}finally{button.disabled=false}
};
