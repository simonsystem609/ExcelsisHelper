"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("excelsisUpdater", {
  getCatalog: force => ipcRenderer.invoke("updates:catalog", { force: force === true }),
  install: key => ipcRenderer.invoke("updates:install", key),
  onProgress: callback => {
    const handler = (_event, data) => { if (typeof callback === "function") callback(data); };
    ipcRenderer.on("updates:progress", handler);
    return () => ipcRenderer.removeListener("updates:progress", handler);
  },
});
