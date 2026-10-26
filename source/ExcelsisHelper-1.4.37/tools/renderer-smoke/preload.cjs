const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("rendererSmoke", { ready: true });
