const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("excelsisAutomation", {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  listMacros: () => ipcRenderer.invoke("automation:list-macros"),
  solidWorksStatus: () => ipcRenderer.invoke("automation:solidworks-status"),
  solidWorksConnect: () => ipcRenderer.invoke("automation:solidworks-connect"),
  killSolidWorks: () => ipcRenderer.invoke("automation:kill-solidworks"),
  copyCurrentDocLocation: () => ipcRenderer.invoke("automation:copy-current-doc-location"),
  getDriveMap: () => ipcRenderer.invoke("automation:get-drive-map"),
  retryRecentDocThumbnails: () => ipcRenderer.invoke("automation:retry-recent-doc-thumbnails"),
  retryRecentDocThumbnail: (docPath, options) => ipcRenderer.invoke("automation:retry-recent-doc-thumbnail", docPath, options),
  findSwAddins: (filter) => ipcRenderer.invoke("automation:find-sw-addins", filter),
  camAddinStatus: () => ipcRenderer.invoke("automation:cam-addin-status"),
  camAddinLoad: () => ipcRenderer.invoke("automation:cam-addin-load"),
  camSaveCloseDocs: () => ipcRenderer.invoke("automation:cam-save-close-docs"),
  camAddinUnload: () => ipcRenderer.invoke("automation:cam-addin-unload"),
  reloadCurrentDoc: () => ipcRenderer.invoke("automation:reload-current-doc"),
  createCamFolder: () => ipcRenderer.invoke("automation:create-cam-folder"),
  docSearch: (request) => ipcRenderer.invoke("automation:doc-search", request),
  deleteDocSearchCache: () => ipcRenderer.invoke("automation:delete-doc-search-cache"),
  cacheStats: () => ipcRenderer.invoke("automation:cache-stats"),
  openDocSearchResult: (docPath) => ipcRenderer.invoke("automation:open-doc-search-result", docPath),
  openContainingFolder: (docPath) => ipcRenderer.invoke("automation:open-containing-folder", docPath),
  copyDocumentPath: (docPath) => ipcRenderer.invoke("automation:copy-document-path", docPath),
  copyDocumentName: (docPath) => ipcRenderer.invoke("automation:copy-document-name", docPath),
  getSettings: () => ipcRenderer.invoke("automation:get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("automation:save-settings", settings),
  resetSettings: () => ipcRenderer.invoke("automation:reset-settings"),
  importSettings: () => ipcRenderer.invoke("automation:import-settings"),
  exportSettings: () => ipcRenderer.invoke("automation:export-settings"),
  runMacro: (options) => ipcRenderer.invoke("automation:run-macro", options),
  listMacroTiles: () => ipcRenderer.invoke("automation:list-macro-tiles"),
  saveMacroTile: (tile) => ipcRenderer.invoke("automation:save-macro-tile", tile),
  deleteMacroTile: (id) => ipcRenderer.invoke("automation:delete-macro-tile", id),
  openMacroFolder: () => ipcRenderer.invoke("automation:open-macro-folder"),
  pickSidebarImage: () => ipcRenderer.invoke("automation:pick-sidebar-image"),
  listRecentDocs: (request) => ipcRenderer.invoke("automation:list-recent-docs", request),
  openRecentDoc: (docPath) => ipcRenderer.invoke("automation:open-recent-doc", docPath),
  deleteRecentDoc: (docPath) => ipcRenderer.invoke("automation:delete-recent-doc", docPath),
  addRecentDoc: (docPath) => ipcRenderer.invoke("automation:add-recent-doc", docPath),
  gcodeListRecent: () => ipcRenderer.invoke("automation:gcode-list-recent"),
  gcodeOpenContainingFolder: (filePath) => ipcRenderer.invoke("automation:gcode-open-containing-folder", filePath),
  gcodeAnalyze: (request) => ipcRenderer.invoke("automation:gcode-analyze", request),
  gcodeMaterialOptions: (request) => ipcRenderer.invoke("automation:gcode-material-options", request),
  gcodeLocalAnalyze: (request) => ipcRenderer.invoke("automation:gcode-local-analyze", request),
  gcodeLocalRecalculate: (request) => ipcRenderer.invoke("automation:gcode-local-recalculate", request),
  gcodeLocalCreateCopy: (request) => ipcRenderer.invoke("automation:gcode-local-create-copy", request),
  gcodeListChecks: () => ipcRenderer.invoke("automation:gcode-list-checks"),
  gcodeOpenChecksFolder: () => ipcRenderer.invoke("automation:gcode-open-checks-folder"),
  gcodeOpenCheck: (filePath) => ipcRenderer.invoke("automation:gcode-open-check", filePath),
  listWorklogs: () => ipcRenderer.invoke("automation:list-worklogs"),
  listWorklogWorktypes: () => ipcRenderer.invoke("automation:list-worklog-worktypes"),
  exportWorklogs: (rules) => ipcRenderer.invoke("automation:export-worklogs", rules),
  exportLastDayWorklogs: (rules) => ipcRenderer.invoke("automation:export-last-day-worklogs", rules),
  getLastWorklogBackup: () => ipcRenderer.invoke("automation:get-last-worklog-backup"),
  setAutoExportSkip: (skip) => ipcRenderer.invoke("automation:set-auto-export-skip", { skip }),
  getWorklogExportRules: () => ipcRenderer.invoke("automation:get-worklog-export-rules"),
  saveWorklogExportRules: (rules) => ipcRenderer.invoke("automation:save-worklog-export-rules", rules),
  adjustWorklogProject: (projectKey, deltaMinutes) => ipcRenderer.invoke("automation:adjust-worklog-project", { projectKey, deltaMinutes }),
  deleteWorklogProject: (projectKey) => ipcRenderer.invoke("automation:delete-worklog-project", projectKey),
  resetWorklogsToday: () => ipcRenderer.invoke("automation:reset-worklogs-today"),
  onAutoExportLog: (cb) => {
    const handler = (_event, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("automation:auto-export-log", handler);
    return () => ipcRenderer.removeListener("automation:auto-export-log", handler);
  },
  onThumbnailsChanged: (cb) => {
    const handler = (_event, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("automation:thumbnails-changed", handler);
    return () => ipcRenderer.removeListener("automation:thumbnails-changed", handler);
  },
  onRecentDocsChanged: (cb) => {
    const handler = (_event, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("automation:recent-docs-changed", handler);
    return () => ipcRenderer.removeListener("automation:recent-docs-changed", handler);
  },
  onDocSearchChanged: (cb) => {
    const handler = (_event, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("automation:doc-search-changed", handler);
    return () => ipcRenderer.removeListener("automation:doc-search-changed", handler);
  },
});
