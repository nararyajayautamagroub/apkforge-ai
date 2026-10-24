import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { runAndroidTool } from "./android-tools.js";

const TEXT_EXTENSIONS = new Set([".xml", ".json", ".txt", ".properties", ".smali", ".html", ".js", ".css", ".kt", ".java", ".yml", ".yaml", ".ini", ".cfg"]);
const MAX_EDIT_BYTES = 2 * 1024 * 1024;

function safeProjectId(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid project id.");
  return id;
}
function inside(root, rel) {
  const base=path.resolve(root), target=path.resolve(base, rel);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error("Path traversal blocked.");
  return target;
}
async function locateUpload(workspace,id) {
  safeProjectId(id);
  const names=await fs.readdir(workspace);
  const filename=names.find(n=>n.startsWith(id+"-"));
  if(!filename) throw new Error("Uploaded file not found.");
  return path.join(workspace,filename);
}
export async function decodeApk(workspace,id) {
  const source=await locateUpload(workspace,id);
  if(path.extname(source).toLowerCase()!==".apk") throw new Error("Decode currently supports .apk files only.");
  const projects=path.join(workspace,"projects");
  await fs.mkdir(projects,{recursive:true});
  const projectId=crypto.randomUUID();
  const destination=path.join(projects,projectId);
  await fs.mkdir(destination,{recursive:false});
  try {
    await runAndroidTool("apktool",["d","-f",source,"-o",destination],{timeoutMs:Number(process.env.JOB_TIMEOUT_MS||300000)});
    await fs.writeFile(path.join(destination,".apkforge-project.json"),JSON.stringify({id:projectId,sourceUploadId:id,createdAt:new Date().toISOString(),format:"apktool-decoded"},null,2));
    return {project:{id:projectId,sourceUploadId:id},message:"APK decoded. Review edits before rebuilding; decode success does not guarantee the rebuilt app will run."};
  } catch(error) {
    await fs.rm(destination,{recursive:true,force:true});
    throw error;
  }
}
export async function listProjectFiles(workspace,id) {
  safeProjectId(id);
  const root=inside(path.join(workspace,"projects"),id);
  const marker=JSON.parse(await fs.readFile(path.join(root,".apkforge-project.json"),"utf8"));
  const results=[];
  async function walk(dir,rel="") {
    for(const ent of await fs.readdir(dir,{withFileTypes:true})) {
      if(ent.name===".apkforge-project.json") continue;
      const childRel=rel?rel+"/"+ent.name:ent.name;
      const full=inside(root,childRel);
      if(ent.isSymbolicLink()) continue;
      if(ent.isDirectory()) await walk(full,childRel);
      else {const st=await fs.stat(full);results.push({path:childRel,size:st.size,editable:TEXT_EXTENSIONS.has(path.extname(ent.name).toLowerCase())&&st.size<=MAX_EDIT_BYTES});}
      if(results.length>=10000) return;
    }
  }
  await walk(root);
  return {project:marker,files:results.slice(0,10000)};
}
export async function readProjectFile(workspace,id,relativePath) {
  const {files}=await listProjectFiles(workspace,id);
  const entry=files.find(f=>f.path===relativePath);
  if(!entry) throw new Error("File not found in project.");
  if(!entry.editable) throw new Error("This file is not an editable text file or exceeds the 2 MiB limit.");
  const target=inside(inside(path.join(workspace,"projects"),id),relativePath);
  return {path:relativePath,content:await fs.readFile(target,"utf8"),size:entry.size};
}
async function backupFile(workspace,id,relativePath,target) {
  const backupRoot=inside(path.join(workspace,"backups",id),relativePath);
  await fs.mkdir(path.dirname(backupRoot),{recursive:true});
  try { await fs.copyFile(target,backupRoot); }
  catch(error) { if(error.code!=="ENOENT") throw error; }
}
export async function editProjectFile(workspace,id,relativePath,content) {
  if(typeof content!=="string"||Buffer.byteLength(content,"utf8")>MAX_EDIT_BYTES) throw new Error("Edited content must be text up to 2 MiB.");
  await readProjectFile(workspace,id,relativePath);
  const root=inside(path.join(workspace,"projects"),id);
  const target=inside(root,relativePath);
  await backupFile(workspace,id,relativePath,target);
  await fs.writeFile(target,content,"utf8");
  return {path:relativePath,size:Buffer.byteLength(content,"utf8"),message:"Text file updated. Previous version backed up; use Undo to restore it."};
}
export async function applyProjectPatch(workspace,id,files) {
  if(!Array.isArray(files)||files.length<1||files.length>5) throw new Error("AI patch must contain between 1 and 5 files.");
  const seen=new Set();
  const prepared=[];
  for(const item of files) {
    if(!item||typeof item.path!=="string"||typeof item.proposedContent!=="string") throw new Error("Every patch item must contain a path and proposedContent.");
    if(seen.has(item.path)) throw new Error("AI patch contains a duplicate file path.");
    seen.add(item.path);
    if(Buffer.byteLength(item.proposedContent,"utf8")>MAX_EDIT_BYTES) throw new Error("Each proposed file must be 2 MiB or smaller.");
    const current=await readProjectFile(workspace,id,item.path);
    prepared.push({path:item.path,target:inside(inside(path.join(workspace,"projects"),id),item.path),oldContent:current.content,newContent:item.proposedContent});
  }
  for(const item of prepared) await backupFile(workspace,id,item.path,item.target);
  const written=[];
  try {
    for(const item of prepared) {
      await fs.writeFile(item.target,item.newContent,"utf8");
      written.push(item);
    }
  } catch(error) {
    for(const item of written.reverse()) await fs.writeFile(item.target,item.oldContent,"utf8").catch(()=>{});
    throw error;
  }
  return {updated:prepared.map(item=>({path:item.path,size:Buffer.byteLength(item.newContent,"utf8")})),message:"AI patch applied to all listed files. Review changes and run validation/build tests before use."};
}

export async function undoProjectFile(workspace,id,relativePath) {
  await readProjectFile(workspace,id,relativePath);
  const root=inside(path.join(workspace,"projects"),id);
  const target=inside(root,relativePath);
  const backup=inside(path.join(workspace,"backups",id),relativePath);
  await fs.access(backup);
  const current=await fs.readFile(target);
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const history=inside(path.join(workspace,"history",id),relativePath+"."+stamp+".bak");
  await fs.mkdir(path.dirname(history),{recursive:true});
  await fs.writeFile(history,current);
  await fs.copyFile(backup,target);
  await fs.rm(backup,{force:true});
  const restored=await fs.stat(target);
  return {path:relativePath,size:restored.size,message:"Previous version restored. The replaced version was saved in history."};
}

export async function buildApk(workspace,id) {
  safeProjectId(id);
  const root=inside(path.join(workspace,"projects"),id);
  await fs.access(path.join(root,".apkforge-project.json"));
  const outDir=path.join(workspace,"builds");
  await fs.mkdir(outDir,{recursive:true});
  const output=path.join(outDir,id+"-unsigned.apk");
  await fs.rm(output,{force:true});
  await runAndroidTool("apktool",["b",root,"-o",output],{timeoutMs:Number(process.env.JOB_TIMEOUT_MS||300000)});
  const stat=await fs.stat(output);
  return {projectId:id,artifact:{name:path.basename(output),size:stat.size,signed:false},message:"Unsigned APK built. Sign with a key you control, then install and test on a device. Build success does not prove runtime correctness."};
}

const ASSET_EXTENSIONS = new Set([".png",".jpg",".jpeg",".webp",".ktx",".ktx2",".dds",".obj",".fbx",".gltf",".glb",".bin",".dat",".wav",".ogg",".mp3"]);
export async function replaceProjectAsset(workspace,id,relativePath,uploadFile) {
  safeProjectId(id);
  if(!uploadFile?.path) throw new Error("Choose an asset file.");
  const ext=path.extname(relativePath).toLowerCase();
  if(!ASSET_EXTENSIONS.has(ext)) throw new Error("Unsupported asset extension. Supported: images, KTX/DDS textures, OBJ/FBX/GLTF/GLB models and common audio/data files.");
  if(path.extname(uploadFile.originalname).toLowerCase()!==ext) throw new Error("Uploaded asset extension must match the destination extension.");
  if(uploadFile.size>100*1024*1024) throw new Error("Asset limit is 100 MiB per file.");
  const root=inside(path.join(workspace,"projects"),id);
  await fs.access(path.join(root,".apkforge-project.json"));
  const target=inside(root,relativePath);
  await fs.mkdir(path.dirname(target),{recursive:true});
  const backup=inside(path.join(workspace,"backups",id),relativePath);
  try { await fs.mkdir(path.dirname(backup),{recursive:true}); await fs.copyFile(target,backup); }
  catch(error) { if(error.code!=="ENOENT") throw error; }
  await fs.rename(uploadFile.path,target);
  const stat=await fs.stat(target);
  return {path:relativePath,size:stat.size,message:"Asset replaced. Verify the target game supports this format, encoding, dimensions and internal naming before rebuilding."};
}

export async function undoProjectAsset(workspace,id,relativePath) {
  safeProjectId(id);
  if(!ASSET_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) throw new Error("Path is not a supported asset file.");
  const root=inside(path.join(workspace,"projects"),id);
  await fs.access(path.join(root,".apkforge-project.json"));
  const target=inside(root,relativePath);
  const backup=inside(path.join(workspace,"backups",id),relativePath);
  await fs.access(backup);
  const current=await fs.readFile(target).catch(error=>error.code==="ENOENT"?Buffer.alloc(0):Promise.reject(error));
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const history=inside(path.join(workspace,"history",id),relativePath+"."+stamp+".bak");
  await fs.mkdir(path.dirname(history),{recursive:true});
  await fs.writeFile(history,current);
  await fs.copyFile(backup,target);
  await fs.rm(backup,{force:true});
  const stat=await fs.stat(target);
  return {path:relativePath,size:stat.size,message:"Previous asset restored. The replaced version was saved in history."};
}

export async function signBuiltApk(workspace,id) {
  safeProjectId(id);
  const keystore=process.env.APKFORGE_KEYSTORE_PATH;
  const alias=process.env.APKFORGE_KEY_ALIAS;
  const storePassword=process.env.APKFORGE_KEYSTORE_PASSWORD;
  const keyPassword=process.env.APKFORGE_KEY_PASSWORD;
  if(!keystore||!alias||!storePassword||!keyPassword) throw new Error("APK signing is not configured. Set APKFORGE_KEYSTORE_PATH, APKFORGE_KEY_ALIAS, APKFORGE_KEYSTORE_PASSWORD and APKFORGE_KEY_PASSWORD on the server.");
  await fs.access(keystore);
  const outDir=path.join(workspace,"builds");
  const unsigned=path.join(outDir,id+"-unsigned.apk");
  await fs.access(unsigned);
  const signed=path.join(outDir,id+"-signed.apk");
  await fs.rm(signed,{force:true});
  await runAndroidTool("apksigner",["sign","--ks",path.resolve(keystore),"--ks-key-alias",alias,"--ks-pass","env:APKFORGE_KEYSTORE_PASSWORD","--key-pass","env:APKFORGE_KEY_PASSWORD","--out",signed,unsigned],{
    timeoutMs:Number(process.env.JOB_TIMEOUT_MS||300000),
    env:{APKFORGE_KEYSTORE_PASSWORD:storePassword,APKFORGE_KEY_PASSWORD:keyPassword}
  });
  await runAndroidTool("apksigner",["verify","--verbose",signed],{timeoutMs:Number(process.env.JOB_TIMEOUT_MS||300000)});
  const stat=await fs.stat(signed);
  return {projectId:id,artifact:{name:path.basename(signed),size:stat.size,signed:true},message:"APK signed and signature verification passed. Install and test on a device before distributing."};
}
