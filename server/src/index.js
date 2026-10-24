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
import { decodeApk, listProjectFiles, readProjectFile, editProjectFile, undoProjectFile, replaceProjectAsset, undoProjectAsset, buildApk, signBuiltApk } from "./services/project.js";
import { fileURLToPath } from "node:url";
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

const app=express();
const port=Number(process.env.PORT||8787);
const host=process.env.HOST||"127.0.0.1";
const workspace=path.resolve(process.env.WORKSPACE_DIR||"./workspace");
const maxUploadBytes=Number(process.env.MAX_UPLOAD_BYTES||0);
await fs.mkdir(path.join(workspace,"incoming"),{recursive:true});
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), "script-src": ["'self'", "'unsafe-inline'"], "style-src": ["'self'", "'unsafe-inline'"], "connect-src": ["'self'", "https:", "http://127.0.0.1:*", "http://localhost:*"] } } }));
app.use(cors({origin:process.env.CORS_ORIGIN||false}));
app.use(express.json({limit:"2mb"}));
app.use(express.static(publicDir, { extensions: ["html"] }));
const upload=multer({dest:path.join(workspace,"incoming"),limits:maxUploadBytes>0?{fileSize:maxUploadBytes,files:1}:{files:1}});
const assetUpload=multer({dest:path.join(workspace,"incoming"),limits:{fileSize:100*1024*1024,files:1}});

app.get("/api/health",(_req,res)=>res.json({name:"APKForge AI",status:"online",version:"0.1.0",uploadLimitBytes:maxUploadBytes||null,note:"Null means no application-level cap; infrastructure and disk limits still apply."}));
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
    const learnedContext=await loadRelevantLearning(workspace,request);
    const result=await proposeProjectPatch({request,currentFiles,learnedContext});
    await recordAiLearning(workspace,{request,summary:result.proposal?.summary||"Request analyzed; no code change proposed.",fileTypes:currentFiles.map(file=>path.extname(file.path)),approved:false});
    res.json({...result,learning:{usedExamples:learnedContext.length,mode:"local-approved-patterns"} });
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
    res.json(await proposePatch({request,fileInventory:Array.isArray(req.body?.fileInventory)?req.body.fileInventory.slice(0,1000):[],currentFiles:Array.isArray(req.body?.currentFiles)?req.body.currentFiles.slice(0,50):[]}));
  }catch(error){next(error);}
});
app.get("/api/formats",(_req,res)=>res.json({import:[".apk",".apks",".aab",".obb",".zip",".apfproj",".exe",".msi"],export:[".apk"],buildTargets:[".apk",".exe",".msi"],notes:{exe:"Requires a separate Windows port or compatible wrapper; APK cannot be directly converted to a native EXE.",mau:"Custom/unspecified format; a format specification or target application is required."}}));
app.use((error,_req,res,_next)=>res.status(error instanceof multer.MulterError?413:400).json({error:error.message||"Request failed"}));
app.listen(port,host,()=>console.log(`APKForge AI API listening on http://${host}:${port}`));
