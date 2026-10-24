import { spawn } from "node:child_process";
import path from "node:path";

const TOOL_NAMES = { apktool:process.env.APKTOOL_BIN||"apktool", jadx:process.env.JADX_BIN||"jadx", apksigner:process.env.APKSIGNER_BIN||"apksigner" };

export function runAndroidTool(tool, args, { cwd, timeoutMs = 300000, env: extraEnv = {} } = {}) {
  if (!Object.hasOwn(TOOL_NAMES, tool)) throw new Error("Tool is not allowlisted");
  if (!Array.isArray(args) || args.some(arg => typeof arg !== "string")) throw new Error("Arguments must be an array of strings");
  if (!extraEnv || typeof extraEnv !== "object" || Array.isArray(extraEnv)) throw new Error("Tool environment must be an object");
  if (Object.entries(extraEnv).some(([key, value]) => !/^APKFORGE_[A-Z0-9_]+$/.test(key) || typeof value !== "string")) {
    throw new Error("Only explicitly scoped APKForge environment variables may be passed to tools");
  }
  return new Promise((resolve,reject)=>{
    const child=spawn(TOOL_NAMES[tool],args,{cwd:cwd?path.resolve(cwd):undefined,shell:false,stdio:["ignore","pipe","pipe"],env:{PATH:process.env.PATH||"",HOME:process.env.HOME||"",JAVA_HOME:process.env.JAVA_HOME||"",ANDROID_HOME:process.env.ANDROID_HOME||"",ANDROID_SDK_ROOT:process.env.ANDROID_SDK_ROOT||"",TMP:process.env.TMP||"",TEMP:process.env.TEMP||"",...extraEnv}});
    let stdout="",stderr="";
    const timer=setTimeout(()=>child.kill("SIGKILL"),timeoutMs);
    child.stdout.on("data",chunk=>{stdout+=chunk.toString();});
    child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
    child.on("error",error=>{clearTimeout(timer);reject(error);});
    child.on("close",code=>{clearTimeout(timer);if(code!==0)return reject(new Error(`${tool} exited ${code}: ${stderr.slice(-4000)}`));resolve({stdout,stderr});});
  });
}
