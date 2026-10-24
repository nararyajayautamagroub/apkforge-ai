import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { validateUploadName, storeUpload } from "./services/archive.js";
import { proposePatch, proposeProjectPatch } from "./services/ai.js";
import { loadRelevantLearning, recordAiLearning } from "./services/ai-memory.js";
import { inspectUploadedArchive } from "./services/inspect.js";
import { decodeApk, listProjectFiles, readProjectFile, editProjectFile, undoProjectFile, applyProjectPatch, replaceProjectAsset, undoProjectAsset, buildApk, signBuiltApk } from "./services/project.js";
import { fileURLToPath } from "node:url";
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

const app=express();
const port=Number(process.env.PORT||8787);
const host=process.env.HOST||"127.0.0.1";
const workspace=path.resolve(process.env.WORKSPACE_DIR||"./workspace");
const maxUploadBytes=Number(process.env.MAX_UPLOAD_BYTES||100*1024*1024);
await fs.mkdir(path.join(workspace,"incoming"),{recursive:true});
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), "script-src": ["'self'", "'unsafe-inline'"], "style-src": ["'self'", "'unsafe-inline'"], "connect-src": ["'self'", "https:", "http://127.0.0.1:*", "http://localhost:*"] } } }));
app.use(cors({origin:process.env.CORS_ORIGIN||false}));
app.use(express.json({limit:"2mb"}));

// Lightweight per-process API rate limit. Excludes health polling so the UI can
// keep reporting live status. Configure a shared limiter and proxy limits for
// multi-instance/public deployments.
const apiRateWindowMs=Math.max(10000,Number(process.env.API_RATE_WINDOW_MS)||60000);
const apiRateMax=Math.max(10,Number(process.env.API_RATE_MAX)||120);
const apiRateBuckets=new Map();
let lastRateCleanup=Date.now();
app.use("/api",(req,res,next)=>{
  if(req.path==="/health")return next();
  const now=Date.now();
  if(now-lastRateCleanup>Math.min(apiRateWindowMs,300000)){
    for(const [key,bucket] of apiRateBuckets)if(now-bucket.startedAt>=apiRateWindowMs)apiRateBuckets.delete(key);
    lastRateCleanup=now;
  }
  const key=req.ip||req.socket.remoteAddress||"unknown";
  let bucket=apiRateBuckets.get(key);
  if(!bucket||now-bucket.startedAt>=apiRateWindowMs){bucket={startedAt:now,count:0};apiRateBuckets.set(key,bucket);}
  bucket.count++;
  res.set("RateLimit-Limit",String(apiRateMax));
  res.set("RateLimit-Remaining",String(Math.max(0,apiRateMax-bucket.count)));
  res.set("RateLimit-Reset",String(Math.ceil((bucket.startedAt+apiRateWindowMs)/1000)));
  if(bucket.count>apiRateMax){
    res.set("Retry-After",String(Math.max(1,Math.ceil((bucket.startedAt+apiRateWindowMs-now)/1000))));
    return res.status(429).json({error:"API request limit reached. Retry after the current rate-limit window.",retryAfterSeconds:Math.max(1,Math.ceil((bucket.startedAt+apiRateWindowMs-now)/1000))});
  }
  next();
});
app.use(express.static(publicDir, { extensions: ["html"] }));
const upload=multer({dest:path.join(workspace,"incoming"),limits:{fileSize:maxUploadBytes,files:1}});
const assetUpload=multer({dest:path.join(workspace,"incoming"),limits:{fileSize:maxUploadBytes,files:1}});

const serverStartedAt=Date.now();
app.get("/api/health",(_req,res)=>res.set("Cache-Control","no-store").json({name:"APKForge AI",status:"online",version:"0.1.0",serverTime:new Date().toISOString(),uptimeSeconds:Math.floor((Date.now()-serverStartedAt)/1000),memoryBytes:process.memoryUsage().rss,uploadLimitBytes:maxUploadBytes,note:"Application upload cap is enforced; configure MAX_UPLOAD_BYTES to override."}));
app.post("/api/uploads",upload.single("file"),async(req,res,next)=>{
  try{
    if(!req.file)return res.status(400).json({error:"Choose a file first."});
    validateUploadName(req.file.originalname);
    const item=await storeUpload(req.file,workspace);
    res.status(201).json({upload:{id:item.id,name:item.name,extension:item.extension,size:item.size},message:"Upload stored; binaries are not executed or automatically modified."});
  }catch(error){if(req.file?.path)await fs.rm(req.file.path,{force:true}).catch(()=>{});next(error);}
});
app.get("/api/uploads/:id/inspect",async(req,res,next)=>{ try { res.json(await inspectUploadedArchive(workspace, req.params.id)); } catch(error) { next(error); } });
app.post("/api/uploads/:id/decode",async(req,res,next)=>{ try { res.status(201).json(await decodeApk(workspace,req.params.id)); } catch(error) { next(error); } });
app.get("/api/projects/:id/files",async(req,res,next)=>{ try { res.json(await listProjectFiles(workspace,req.params.id)); } catch(error) { next(error); } });
app.get("/api/projects/:id/file",async(req,res,next)=>{ try { const filePath=String(req.query.path||""); if(!filePath)return res.status(400).json({error:"Provide a relative file path in the path query."}); res.json(await readProjectFile(workspace,req.params.id,filePath)); } catch(error) { next(error); } });
app.put("/api/projects/:id/file",async(req,res,next)=>{ try { const filePath=String(req.body?.path||""); if(!filePath)return res.status(400).json({error:"Provide a relative file path."}); res.json(await editProjectFile(workspace,req.params.id,filePath,req.body?.content)); } catch(error) { next(error); } });
app.post("/api/projects/:id/undo",async(req,res,next)=>{ try { const filePath=String(req.body?.path||""); if(!filePath)return res.status(400).json({error:"Provide a relative file path."}); res.json(await undoProjectFile(workspace,req.params.id,filePath)); } catch(error) { next(error); } });
app.put("/api/projects/:id/asset",assetUpload.single("file"),async(req,res,next)=>{ try { const filePath=String(req.body?.path||""); if(!filePath)return res.status(400).json({error:"Provide a relative destination path."}); res.json(await replaceProjectAsset(workspace,req.params.id,filePath,req.file)); } catch(error) { if(req.file?.path)await fs.rm(req.file.path,{force:true}).catch(()=>{}); next(error); } });
app.post("/api/projects/:id/asset/undo",async(req,res,next)=>{ try { const filePath=String(req.body?.path||""); if(!filePath)return res.status(400).json({error:"Provide a relative asset path."}); res.json(await undoProjectAsset(workspace,req.params.id,filePath)); } catch(error) { next(error); } });
app.post("/api/projects/:id/build",async(req,res,next)=>{ try { res.json(await buildApk(workspace,req.params.id)); } catch(error) { next(error); } });
app.post("/api/projects/:id/sign",async(req,res,next)=>{ try { res.json(await signBuiltApk(workspace,req.params.id)); } catch(error) { next(error); } });
app.post("/api/projects/:id/ai/patch-plan",async(req,res,next)=>{
  try{
    const request=String(req.body?.request||"").trim();
    const paths=Array.isArray(req.body?.paths)?[...new Set(req.body.paths.filter(p=>typeof p==="string"))].slice(0,5):[];
    if(!request)return res.status(400).json({error:"Describe the change you want the AI to propose."});
    if(request.length>8000)return res.status(400).json({error:"Prompt must be 8,000 characters or fewer."});
    if(paths.length<1)return res.status(400).json({error:"Select at least one editable text file."});
    const currentFiles=[];
    for(const filePath of paths){
      const file=await readProjectFile(workspace,req.params.id,filePath);
      currentFiles.push({path:file.path,content:file.content});
    }
    if(Buffer.byteLength(JSON.stringify(currentFiles),"utf8")>45000)return res.status(413).json({error:"Konteks file AI melebihi 45 KB. Pilih lebih sedikit file atau file yang lebih kecil agar AI tidak memotong kode dan merusak bagian yang tidak terlihat."});
    const learnedContext=await loadRelevantLearning(workspace,request);
    const result=await proposeProjectPatch({request,currentFiles,learnedContext});
    await recordAiLearning(workspace,{request,summary:result.proposal?.summary||"Request analyzed; no code change proposed.",fileTypes:currentFiles.map(file=>path.extname(file.path)),approved:false});
    res.json({...result,learning:{usedExamples:learnedContext.length,mode:"local-approved-patterns"} });
  }catch(error){next(error);}
});
app.post("/api/projects/:id/ai/apply-patch",async(req,res,next)=>{
  try{
    const files=Array.isArray(req.body?.files)?req.body.files:[];
    if(files.length<1||files.length>5)return res.status(400).json({error:"Submit between 1 and 5 reviewed file edits."});
    res.json(await applyProjectPatch(workspace,req.params.id,files));
  }catch(error){next(error);}
});
app.post("/api/ai/learn",async(req,res,next)=>{
  try{
    const request=String(req.body?.request||"").trim();
    const summary=String(req.body?.summary||"").trim();
    const fileTypes=Array.isArray(req.body?.fileTypes)?req.body.fileTypes.slice(0,8):[];
    if(!request)return res.status(400).json({error:"Provide the original AI request."});
    if(request.length>8000||summary.length>2000)return res.status(400).json({error:"Request or summary is too long."});
    res.status(201).json(await recordAiLearning(workspace,{request,summary,fileTypes,approved:true}));
  }catch(error){next(error);}
});
app.get("/api/projects/:id/artifact",async(req,res,next)=>{ try { if(!/^[0-9a-f-]{36}$/i.test(req.params.id))return res.status(400).json({error:"Invalid project id."}); const artifact=path.join(workspace,"builds",req.params.id+"-unsigned.apk"); await fs.access(artifact); res.download(artifact,path.basename(artifact)); } catch(error) { next(error); } });
app.get("/api/projects/:id/signed-artifact",async(req,res,next)=>{ try { if(!/^[0-9a-f-]{36}$/i.test(req.params.id))return res.status(400).json({error:"Invalid project id."}); const artifact=path.join(workspace,"builds",req.params.id+"-signed.apk"); await fs.access(artifact); res.download(artifact,path.basename(artifact)); } catch(error) { next(error); } });
app.post("/api/ai/plan",async(req,res,next)=>{
  try{
    const request=String(req.body?.request||"").trim();
    if(!request)return res.status(400).json({error:"Describe the feature you want to add."});
    if(request.length>8000)return res.status(400).json({error:"Prompt must be 8,000 characters or fewer."});
    const learnedContext=await loadRelevantLearning(workspace,request);
    const result=await proposePatch({request,fileInventory:Array.isArray(req.body?.fileInventory)?req.body.fileInventory.slice(0,1000):[],currentFiles:Array.isArray(req.body?.currentFiles)?req.body.currentFiles.slice(0,50):[],learnedContext});
    await recordAiLearning(workspace,{request,summary:"Feature planning request; not yet confirmed as implemented.",approved:false});
    res.json({...result,learning:{usedExamples:learnedContext.length,mode:"local-approved-patterns"}});
  }catch(error){next(error);}
});
app.get("/api/formats",(_req,res)=>res.json({import:[".apk",".apks",".aab",".obb",".zip",".apfproj",".exe",".msi"],export:[".apk"],buildTargets:[".apk",".exe",".msi"],notes:{exe:"Requires a separate Windows port or compatible wrapper; APK cannot be directly converted to a native EXE.",mau:"Custom/unspecified format; a format specification or target application is required."}}));
app.use((error,_req,res,_next)=>res.status(error instanceof multer.MulterError?413:400).json({error:error.message||"Request failed"}));
app.listen(port,host,()=>console.log(`APKForge AI API listening on http://${host}:${port}`));
