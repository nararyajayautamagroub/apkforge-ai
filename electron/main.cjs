const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let mainWindow;
const port = Number(process.env.PORT || 8787);
const origin = `http://127.0.0.1:${port}`;

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin + "/api/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error("APKForge AI local service did not start within 30 seconds.");
}

async function createWindow() {
  process.env.HOST = "127.0.0.1";
  process.env.PORT = String(port);
  process.env.WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(app.getPath("userData"), "workspace");
  await import(pathToFileURL(path.join(app.getAppPath(), "server/src/index.js")).href);
  await waitForServer();
  mainWindow = new BrowserWindow({
    width: 1320, height: 900, minWidth: 900, minHeight: 640,
    title: "APKForge AI",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  await mainWindow.loadURL(origin);
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(createWindow).catch(async error => {
  await dialog.showMessageBox({ type: "error", title: "APKForge AI gagal dimulai", message: error.message });
  app.quit();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
