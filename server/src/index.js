import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { validateUploadName, storeUpload } from "./services/archive.js";
import { proposePatch } from "./services/ai.js";
import { inspectUploadedArchive } from "./services/inspect.js";
import { fileURLToPath } from "node:url";
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

const app=express();
const port=Number(process.env.PORT||8787);
const host=process.env.HOST||"127.0.0.1";
const workspace=path.resolve(process.env.WORKSPACE_DIR||"./workspace");
const maxUploadBytes=Number(process.env.MAX_UPLOAD_BYTES||0);
await fs.mkdir(path.join(workspace,"incoming"),{recursive:true});
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), "script-src": ["'self'", "'unsafe-inline'"], "style-src": ["'self'", "'unsafe-inline'"] } } }));
app.use(cors({origin:process.env.CORS_ORIGIN||false}));
app.use(express.json({limit:"2mb"}));
app.use(express.static(publicDir, { extensions: ["html"] }));
const upload=multer({dest:path.join(workspace,"incoming"),limits:maxUploadBytes>0?{fileSize:maxUploadBytes,files:1}:{files:1}});

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
app.post("/api/ai/plan",async(req,res,next)=>{
  try{
    const request=String(req.body?.request||"").trim();
    if(!request)return res.status(400).json({error:"Describe the feature you want to add."});
    if(request.length>8000)return res.status(400).json({error:"Prompt must be 8,000 characters or fewer."});
    res.json(await proposePatch({request,fileInventory:Array.isArray(req.body?.fileInventory)?req.body.fileInventory.slice(0,1000):[],currentFiles:Array.isArray(req.body?.currentFiles)?req.body.currentFiles.slice(0,50):[]}));
  }catch(error){next(error);}
});
app.get("/api/formats",(_req,res)=>res.json({import:[".apk",".apks",".aab",".obb",".zip",".apfproj"],export:[".apk",".apfproj"],notes:{exe:"Requires a separate Windows port or compatible wrapper; APK cannot be directly converted to a native EXE.",mau:"Custom/unspecified format; a format specification or target application is required."}}));
app.use((error,_req,res,_next)=>res.status(error instanceof multer.MulterError?413:400).json({error:error.message||"Request failed"}));
app.listen(port,host,()=>console.log(`APKForge AI API listening on http://${host}:${port}`));
