const api = window.excelsisAutomation;

const ui = {
  killSolidWorksBtn: document.getElementById("killSolidWorksBtn"),
  copyDocLocationBtn: document.getElementById("copyDocLocationBtn"),
  createCamFolderBtn: document.getElementById("createCamFolderBtn"),
  solidCamLoadStatus: document.getElementById("solidCamLoadStatus"),
  swStatus: document.getElementById("swStatus"),
  swHealthStatus: document.getElementById("swHealthStatus"),
  activeDoc: document.getElementById("activeDoc"),
  navButtons: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  refreshMacroTilesBtn: document.getElementById("refreshMacroTilesBtn"),
  openMacroFolderBtn: document.getElementById("openMacroFolderBtn"),
  macroFolderState: document.getElementById("macroFolderState"),
  macroTileGrid: document.getElementById("macroTileGrid"),

  clearLogBtn: document.getElementById("clearLogBtn"),
  logOutput: document.getElementById("logOutput"),
  appVersion: document.getElementById("appVersion"),
  sidebarBottom: document.getElementById("sidebarBottom"),
  sidebarBottomImage: document.getElementById("sidebarBottomImage"),
  recentDocsList: document.getElementById("recentDocsList"),
  recentDocsFilter: document.getElementById("recentDocsFilter"),
  recentDocsSearch: document.getElementById("recentDocsSearch"),
  recentDocsMore: document.getElementById("recentDocsMore"),
  recentDocsMoreState: document.getElementById("recentDocsMoreState"),
  showAllRecentDocsBtn: document.getElementById("showAllRecentDocsBtn"),
  refreshRecentDocsBtn: document.getElementById("refreshRecentDocsBtn"),
  retryThumbnailsBtn: document.getElementById("retryThumbnailsBtn"),
  workLoggerCountingStatus: document.getElementById("workLoggerCountingStatus"),
  workLoggerState: document.getElementById("workLoggerState"),
  workLoggerAutoExport: document.getElementById("workLoggerAutoExport"),
  worklogAutoExportSkip: document.getElementById("worklogAutoExportSkip"),
  workLoggerList: document.getElementById("workLoggerList"),
  refreshWorkLoggerBtn: document.getElementById("refreshWorkLoggerBtn"),
  resetWorkLoggerBtn: document.getElementById("resetWorkLoggerBtn"),
  exportWorkLoggerBtn: document.getElementById("exportWorkLoggerBtn"),
  worklogExportDialog: document.getElementById("worklogExportDialog"),
  worklogExportForm: document.getElementById("worklogExportForm"),
  closeWorklogExportBtn: document.getElementById("closeWorklogExportBtn"),
  cancelWorklogExportBtn: document.getElementById("cancelWorklogExportBtn"),
  confirmWorklogExportBtn: document.getElementById("confirmWorklogExportBtn"),
  worklogExportCutoffMinutes: document.getElementById("worklogExportCutoffMinutes"),
  worklogExportMultiplier: document.getElementById("worklogExportMultiplier"),
  worklogExportRoundToMinutes: document.getElementById("worklogExportRoundToMinutes"),
  worklogExportDefaultWorkType: document.getElementById("worklogExportDefaultWorkType"),
  worklogExportSecondWorkTypeWrap: document.getElementById("worklogExportSecondWorkTypeWrap"),
  worklogExportSecondWorkType: document.getElementById("worklogExportSecondWorkType"),
  worklogExportPerProjectWorkTypes: document.getElementById("worklogExportPerProjectWorkTypes"),
  worklogExportSplitByWorkType: document.getElementById("worklogExportSplitByWorkType"),
  worklogExportProjectWorkTypes: document.getElementById("worklogExportProjectWorkTypes"),
  worklogExportSummary: document.getElementById("worklogExportSummary"),
  worklogExportState: document.getElementById("worklogExportState"),
  worklogExportTitle: document.getElementById("worklogExportTitle"),
  exportLastDayWorkLoggerBtn: document.getElementById("exportLastDayWorkLoggerBtn"),
  setWorklogExportBtn: document.getElementById("setWorklogExportBtn"),
  worklogExportTargetHoursMode: document.getElementById("worklogExportTargetHoursMode"),
  worklogExportTargetHours: document.getElementById("worklogExportTargetHours"),
  worklogExportTargetHoursWrap: document.getElementById("worklogExportTargetHoursWrap"),
  docSearchInput: document.getElementById("docSearchInput"),
  docSearchTypeFilter: document.getElementById("docSearchTypeFilter"),
  docSearchState: document.getElementById("docSearchState"),
  docSearchList: document.getElementById("docSearchList"),
  docSearchPager: document.getElementById("docSearchPager"),
  docSearchPrevPageBtn: document.getElementById("docSearchPrevPageBtn"),
  docSearchNextPageBtn: document.getElementById("docSearchNextPageBtn"),
  gcodeState: document.getElementById("gcodeState"),
  gcodeFileList: document.getElementById("gcodeFileList"),
  gcodeAnalyzePanel: document.getElementById("gcodeAnalyzePanel"),
  gcodeSelectedFile: document.getElementById("gcodeSelectedFile"),
  gcodeChangeFileBtn: document.getElementById("gcodeChangeFileBtn"),
  gcodeMethodAiBtn: document.getElementById("gcodeMethodAiBtn"),
  gcodeMethodLocalBtn: document.getElementById("gcodeMethodLocalBtn"),
  gcodeAiInputs: document.getElementById("gcodeAiInputs"),
  gcodeLocalInputs: document.getElementById("gcodeLocalInputs"),
  gcodeMaterialInput: document.getElementById("gcodeMaterialInput"),
  gcodeMaterialOptions: document.getElementById("gcodeMaterialOptions"),
  gcodeToolMaterialInput: document.getElementById("gcodeToolMaterialInput"),
  gcodeToolMaterialOptions: document.getElementById("gcodeToolMaterialOptions"),
  gcodeAnalyzeBtn: document.getElementById("gcodeAnalyzeBtn"),
  gcodeMaterialFamilyInput: document.getElementById("gcodeMaterialFamilyInput"),
  gcodeMaterialGradeInput: document.getElementById("gcodeMaterialGradeInput"),
  gcodeMaterialGradeOptions: document.getElementById("gcodeMaterialGradeOptions"),
  gcodeHardnessInput: document.getElementById("gcodeHardnessInput"),
  gcodeHardnessScale: document.getElementById("gcodeHardnessScale"),
  gcodeMachineMaxRpm: document.getElementById("gcodeMachineMaxRpm"),
  gcodeAggressiveness: document.getElementById("gcodeAggressiveness"),
  gcodeAePercent: document.getElementById("gcodeAePercent"),
  gcodeCoolingMode: document.getElementById("gcodeCoolingMode"),
  gcodeContactMode: document.getElementById("gcodeContactMode"),
  gcodeFluteCount: document.getElementById("gcodeFluteCount"),
  gcodeLocalAnalyzeBtn: document.getElementById("gcodeLocalAnalyzeBtn"),
  gcodeLocalActions: document.getElementById("gcodeLocalActions"),
  gcodeOptimizedSuffix: document.getElementById("gcodeOptimizedSuffix"),
  gcodeLocalRecalculateBtn: document.getElementById("gcodeLocalRecalculateBtn"),
  gcodeLocalUpdateEstimateBtn: document.getElementById("gcodeLocalUpdateEstimateBtn"),
  gcodeLocalCreateCopyBtn: document.getElementById("gcodeLocalCreateCopyBtn"),
  gcodeAnalyzeState: document.getElementById("gcodeAnalyzeState"),
  gcodeResults: document.getElementById("gcodeResults"),
  gcodeHistory: document.getElementById("gcodeHistory"),
  refreshGcodeBtn: document.getElementById("refreshGcodeBtn"),
  gcodeOpenChecksFolderBtn: document.getElementById("gcodeOpenChecksFolderBtn"),
  settingsGcodeSearchRoot: document.getElementById("settingsGcodeSearchRoot"),
  settingsGcodeMaterials: document.getElementById("settingsGcodeMaterials"),
  settingsGcodeToolMaterials: document.getElementById("settingsGcodeToolMaterials"),
  settingsGcodeDefaultMillingToolMaterial: document.getElementById("settingsGcodeDefaultMillingToolMaterial"),
  settingsGcodeDefaultDrillToolMaterial: document.getElementById("settingsGcodeDefaultDrillToolMaterial"),
  settingsGcodeDefaultTapToolMaterial: document.getElementById("settingsGcodeDefaultTapToolMaterial"),
  settingsGcodeMachineMaxRpm: document.getElementById("settingsGcodeMachineMaxRpm"),
  settingsGcodeMachineMaxFeed: document.getElementById("settingsGcodeMachineMaxFeed"),
  settingsGcodeAggressiveness: document.getElementById("settingsGcodeAggressiveness"),
  settingsGcodeAePercent: document.getElementById("settingsGcodeAePercent"),
  settingsGcodeCoolingMode: document.getElementById("settingsGcodeCoolingMode"),
  settingsGcodeContactMode: document.getElementById("settingsGcodeContactMode"),
  settingsGcodeFluteCount: document.getElementById("settingsGcodeFluteCount"),
  settingsGcodeOptimizedSuffix: document.getElementById("settingsGcodeOptimizedSuffix"),
  settingsUiLanguage: document.getElementById("settingsUiLanguage"),
  settingsBomLanguage: document.getElementById("settingsBomLanguage"),
  settingsHotkeysEnabled: document.getElementById("settingsHotkeysEnabled"),
  settingsPasteProjectDateHotkey: document.getElementById("settingsPasteProjectDateHotkey"),
  settingsCopyPathHotkey: document.getElementById("settingsCopyPathHotkey"),
  settingsProjectDateTemplate: document.getElementById("settingsProjectDateTemplate"),
  settingsGroupResetButtons: document.querySelectorAll("[data-settings-reset]"),
  settingsSolidWorksIdlePauseMinutes: document.getElementById("settingsSolidWorksIdlePauseMinutes"),
  settingsRecentDocsNewEntryBurstSeconds: document.getElementById("settingsRecentDocsNewEntryBurstSeconds"),
  settingsDiagnosticsEnabled: document.getElementById("settingsDiagnosticsEnabled"),
  settingsErpWorklogInbox: document.getElementById("settingsErpWorklogInbox"),
  settingsErpWorklogWorktypes: document.getElementById("settingsErpWorklogWorktypes"),
  settingsErpWorklogDocMinMinutes: document.getElementById("settingsErpWorklogDocMinMinutes"),
  settingsErpWorklogUserName: document.getElementById("settingsErpWorklogUserName"),
  settingsErpOvertimeStartTime: document.getElementById("settingsErpOvertimeStartTime"),
  settingsCamOutputRoot: document.getElementById("settingsCamOutputRoot"),
  settingsCamFolderMode: document.getElementById("settingsCamFolderMode"),
  settingsCamSearchRoots: document.getElementById("settingsCamSearchRoots"),
  settingsLocationsProjectRoots: document.getElementById("settingsLocationsProjectRoots"),
  settingsLocationsProjectPrefixes: document.getElementById("settingsLocationsProjectPrefixes"),
  settingsLocationsSearchRoots: document.getElementById("settingsLocationsSearchRoots"),
  settingsLocationsExclusions: document.getElementById("settingsLocationsExclusions"),
  settingsMacroDrawingTemplate: document.getElementById("settingsMacroDrawingTemplate"),
  settingsMacroDxfOutputPrefix: document.getElementById("settingsMacroDxfOutputPrefix"),
  settingsMacroDefaultMaterial: document.getElementById("settingsMacroDefaultMaterial"),
  searchCamAddinsBtn: document.getElementById("searchCamAddinsBtn"),
  camAddinsList: document.getElementById("camAddinsList"),
  camSelectionState: document.getElementById("camSelectionState"),
  deleteDocSearchCacheBtn: document.getElementById("deleteDocSearchCacheBtn"),
  startCamBtn: document.getElementById("startCamBtn"),
  reloadCamDocBtn: document.getElementById("reloadCamDocBtn"),
  stopCamBtn: document.getElementById("stopCamBtn"),
  settingsSaveBtn: document.getElementById("settingsSaveBtn"),
  settingsResetBtn: document.getElementById("settingsResetBtn"),
  settingsImportBtn: document.getElementById("settingsImportBtn"),
  settingsExportBtn: document.getElementById("settingsExportBtn"),
  settingsState: document.getElementById("settingsState"),
  settingsCacheState: document.getElementById("settingsCacheState"),
};

const state = {
  macroTiles: [],
  macroRoot: "",
  solidWorksStatusInFlight: false,
  killSolidWorksInFlight: false,
  lastSolidWorksHealth: null,
  lastSolidWorksHealthSignature: "",
  lastSolidWorksDocument: null,
  settings: null,
  defaults: null,
  settingsPath: "",
  lastSettingsState: null,
  lastCacheStats: null,
  solidCamSettings: { selectedDllPath: "", selectedTitle: "", selectedClsid: "" },
  solidCamAddins: [],
  solidCamStatusInFlight: false,
  solidCamLoaded: null,
  lastSolidCamHealth: null,
  docSearchInFlight: false,
  docSearchRequestSeq: 0,
  docSearchPage: 0,
  docSearchHasMore: false,
  docSearchLastKey: "",
  docSearchLastSignature: "",
  docSearchPollTimer: null,
  recentDocsRefreshTimer: null,
  gcodeFiles: [],
  gcodeSelectedPath: "",
  gcodeMethod: "ai",
  gcodeMaterialGroups: [],
  gcodeLocalSessionId: "",
  gcodeLocalProposal: null,
  gcodeLocalControlsDirty: false,
  gcodeAnalyzeInFlight: false,
  gcodeListInFlight: false,
  // After a file is picked the list collapses so the analyze form sits at the
  // top without scrolling; "Select different MPF" reopens it.
  gcodeListCollapsed: false,
};

const SOLIDWORKS_STATUS_INTERVAL_MS = 3000;
const SOLIDCAM_STATUS_INTERVAL_MS = 15000;

function log(message, payload = null) {
  const time = new Date().toLocaleTimeString();
  const detail = payload ? `\n${JSON.stringify(payload, null, 2)}` : "";
  ui.logOutput.textContent = `[${time}] ${message}${detail}\n\n${ui.logOutput.textContent}`.trim();
  ui.logOutput.scrollTop = 0;
}

function setActiveDocText(text) {
  ui.activeDoc.textContent = text;
  ui.activeDoc.title = String(text || "").replace(/\s*\n\s*/g, " ");
}

function setActiveDocHtml(html) {
  ui.activeDoc.innerHTML = html;
  ui.activeDoc.title = ui.activeDoc.textContent.replace(/\s+/g, " ").trim();
}

function updateSolidWorksKillButton(health) {
  if (!ui.killSolidWorksBtn) return;
  const canKill = Boolean(health?.canKill);
  ui.killSolidWorksBtn.disabled = state.killSolidWorksInFlight || !canKill;
  ui.killSolidWorksBtn.title = ta(canKill
    ? "Kill all SLDWORKS.exe processes for the unhealthy session"
    : "Enabled only when Excelsis detects an unhealthy SOLIDWORKS session");
}

function renderSolidWorksHealth(result) {
  const health = result?.solidWorksHealth || null;
  state.lastSolidWorksHealth = health;
  updateSolidWorksKillButton(health);
  if (!ui.swHealthStatus) return;

  const stateKey = ["healthy", "stopped", "loading", "unhealthy"].includes(health?.state)
    ? health.state
    : "unknown";
  ui.swHealthStatus.classList.remove("healthy", "stopped", "loading", "unhealthy", "unknown");
  ui.swHealthStatus.classList.add(stateKey);
  ui.swHealthStatus.textContent = t(health?.label || "SW health: checking...");
  const reasons = Array.isArray(health?.reasons) ? health.reasons.filter(Boolean) : [];
  ui.swHealthStatus.title = [health?.message || "", ...reasons].filter(Boolean).join("\n");
}

function maybeLogSolidWorksHealthIssue(result) {
  const health = result?.solidWorksHealth;
  if (!health || health.state !== "unhealthy") {
    state.lastSolidWorksHealthSignature = "";
    return;
  }
  const signature = health.signature || JSON.stringify({
    state: health.state,
    reasons: health.reasons || [],
    processCount: health.processCount || 0,
    error: result?.error || "",
  });
  if (signature === state.lastSolidWorksHealthSignature) return;
  state.lastSolidWorksHealthSignature = signature;
  log("SOLIDWORKS health issue detected.", {
    message: health.message,
    reasons: health.reasons || [],
    processCount: health.processCount || 0,
    processes: health.processes || [],
    bridgeError: result?.error || "",
    reconcileInfo: result?.reconcileInfo || null,
  });
}

const driveMap = new Map();

async function refreshDriveMapFromMain() {
  try {
    const result = await api.getDriveMap();
    driveMap.clear();
    if (result && result.entries) {
      for (const [unc, letter] of result.entries) driveMap.set(unc, letter);
    }
  } catch {}
}

function displayPathOf(p) {
  if (!p) return "";
  const s = String(p);
  if (!s.startsWith("\\\\")) return s;
  if (driveMap.size === 0) return s;
  const after = s.substring(2);
  const slash1 = after.indexOf("\\");
  if (slash1 < 0) return s;
  const slash2 = after.indexOf("\\", slash1 + 1);
  const shareRoot = "\\\\" + (slash2 < 0 ? after : after.substring(0, slash2));
  const mapped = driveMap.get(shareRoot.toLowerCase());
  if (!mapped) return s;
  const remainder = slash2 < 0 ? "" : s.substring(2 + slash2);
  return mapped + remainder;
}

function basenameOf(p) {
  return String(p || "").split(/[\\/]/).pop() || "";
}

function extOf(p) {
  const name = basenameOf(p).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

function fileTypeForPath(p) {
  const ext = extOf(p);
  if (ext === ".sldprt") return { key: "part", label: "PRT" };
  if (ext === ".sldasm") return { key: "assembly", label: "ASS" };
  if (ext === ".slddrw") return { key: "drawing", label: "DRW" };
  if (ext === ".prz" || ext === ".prt") return { key: "solidcam", label: "CAM" };
  if (ext === ".dxf") return { key: "dxf", label: "DXF" };
  if (ext === ".dwg") return { key: "dwg", label: "DWG" };
  if (ext === ".pdf") return { key: "pdf", label: "PDF" };
  if (ext === ".mpf") return { key: "code", label: "MPF" };
  if (ext === ".txt") return { key: "text", label: "TXT" };
  return { key: "other", label: "File" };
}

function activeSolidWorksSeedPath() {
  const doc = state.lastSolidWorksDocument;
  if (!doc?.hasActiveDocument) return "";
  const candidate = doc.path || doc.title || "";
  return [".sldprt", ".sldasm", ".slddrw"].includes(extOf(candidate)) ? candidate : "";
}

function setStatus(result) {
  renderSolidWorksHealth(result);
  maybeLogSolidWorksHealthIssue(result);
  ui.swStatus.classList.remove("ok", "error", "idle");
  if (!result) {
    ui.swStatus.textContent = t("Not checked");
    ui.swStatus.classList.add("idle");
    setActiveDocText(t("No active document loaded."));
    return;
  }
  if (result.ok && result.connected) {
    ui.swStatus.textContent = t(result.solidWorksBusy ? "Busy" : (result.startedSolidWorks ? "Started" : "Connected"));
    ui.swStatus.classList.add("ok");
  } else {
    ui.swStatus.textContent = t("Disconnected");
    ui.swStatus.classList.add("error");
  }
  const doc = result.activeDocument;
  if (doc?.hasActiveDocument) {
    const previousDocPath = state.lastSolidWorksDocument?.path || "";
    state.lastSolidWorksDocument = doc;
    if (
      previousDocPath !== (doc.path || "") &&
      ui.docSearchList &&
      document.getElementById("docSearchView")?.classList.contains("active") &&
      !ui.docSearchInput?.value?.trim()
    ) {
      scheduleDocSearchRefresh(250);
    }
    if (doc.path) {
      const full = displayPathOf(doc.path);
      setActiveDocHtml(`<span class="active-doc-title">${escapeHtml(doc.title)}</span><span class="active-doc-root">${escapeHtml(full)}</span>`);
    } else {
      const source = doc.inferred ? "window" : "active";
      setActiveDocText(`${doc.title} (${source})`);
    }
    return;
  }
  if (result.solidWorksBusy && state.lastSolidWorksDocument) {
    const last = state.lastSolidWorksDocument;
    const full = displayPathOf(last.path);
    setActiveDocText(`${t("SOLIDWORKS busy. Last seen:")} ${last.title}${full ? `  ${full}` : ""}`);
    return;
  }
  setActiveDocText(result.connected
    ? t("Connected, but no foreground SOLIDWORKS document was found.")
    : t("No active document loaded."));
}

function switchView(viewName) {
  for (const button of ui.navButtons) button.classList.toggle("active", button.dataset.view === viewName);
  for (const view of ui.views) view.classList.toggle("active", view.id === `${viewName}View`);
  if (viewName !== "docSearch" && state.docSearchPollTimer) {
    clearTimeout(state.docSearchPollTimer);
    state.docSearchPollTimer = null;
  }
  if (viewName !== "recentDocs" && state.recentDocsRefreshTimer) {
    clearTimeout(state.recentDocsRefreshTimer);
    state.recentDocsRefreshTimer = null;
  }
  if (viewName === "recentDocs") scheduleRecentDocsRefresh(0);
  if (viewName === "docSearch") scheduleDocSearchRefresh(0);
  if (viewName === "workLogger") refreshWorkLoggerList().catch(() => {});
  if (viewName === "gcode") refreshGcodeView().catch(() => {});
  if (viewName === "settings") refreshCacheStats().catch(() => {});
}

function defaultNamesFor(filePath) {
  return String(filePath || "").toLowerCase().endsWith(".dll")
    ? { moduleName: "", procedureName: "Main" }
    : { moduleName: "", procedureName: "main" };
}

function renderMacroTiles() {
  ui.macroTileGrid.innerHTML = "";
  ui.macroFolderState.textContent = state.macroRoot
    ? `Macro folder: ${state.macroRoot}`
    : "Macro folder: Documents\\Excelsis\\Macros";
  if (!state.macroTiles.length) {
    const empty = document.createElement("div");
    empty.className = "response-preview muted";
    empty.textContent = t("No SOLIDWORKS macros found in the macro folder.");
    ui.macroTileGrid.appendChild(empty);
    return;
  }
  for (const tile of state.macroTiles) {
    const card = document.createElement("div");
    card.className = "macro-tile";
    card.tabIndex = 0;
    card.role = "button";
    card.innerHTML = `
      <div>
        <div class="macro-tile-title">${escapeHtml(tile.displayName || tile.name)}</div>
        <textarea class="macro-desc-edit" data-description="${escapeHtml(tile.id)}" rows="3" spellcheck="true">${escapeHtml(tile.description || "")}</textarea>
      </div>
      <div>
        <div class="macro-tile-path">${escapeHtml(tile.relativePath || tile.filePath)}</div>
        <div class="macro-tile-actions">
          <button type="button" class="run" data-run="${escapeHtml(tile.id)}">Run</button>
          <button type="button" data-save-description="${escapeHtml(tile.id)}">Save Description</button>
        </div>
      </div>
    `;
    card.addEventListener("click", (event) => {
      const runId = event.target?.dataset?.run;
      const saveId = event.target?.dataset?.saveDescription;
      if (runId) {
        event.stopPropagation();
        runMacroTile(tile);
        return;
      }
      if (saveId) {
        event.stopPropagation();
        const textarea = card.querySelector("[data-description]");
        saveMacroDescription(tile, textarea?.value || "");
        return;
      }
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target?.tagName === "TEXTAREA") return;
      event.preventDefault();
      runMacroTile(tile);
    });
    ui.macroTileGrid.appendChild(card);
  }
}

async function refreshMacroTiles() {
  const result = await api.listMacroTiles();
  state.macroTiles = result.tiles || [];
  state.macroRoot = result.root || state.macroRoot;
  renderMacroTiles();
}

async function saveMacroDescription(tile, description) {
  const result = await api.saveMacroTile({
    filePath: tile.filePath,
    description,
  });
  if (!result.ok) {
    log("Macro description was not saved.", result);
    return;
  }
  state.macroTiles = result.tiles || state.macroTiles;
  state.macroRoot = result.root || state.macroRoot;
  renderMacroTiles();
  log("Macro description saved.");
}

async function openMacroFolder() {
  const result = await api.openMacroFolder();
  if (result.root) state.macroRoot = result.root;
  renderMacroTiles();
  if (!result.ok) log("Could not open macro folder.", result);
}

async function runMacroTile(tile) {
  log(`Running ${tile.name}...`);
  const result = await api.runMacro({
    filePath: tile.filePath,
    moduleName: tile.moduleName || defaultNamesFor(tile.filePath).moduleName,
    procedureName: tile.procedureName || defaultNamesFor(tile.filePath).procedureName,
  });
  setStatus(result);
  log(result.ok ? "Macro finished." : "Macro failed.", result);
}

async function refreshSolidWorksStatus({ writeLog = false } = {}) {
  if (state.solidWorksStatusInFlight) return;
  state.solidWorksStatusInFlight = true;
  try {
    const result = await api.solidWorksStatus();
    setStatus(result);
    if (writeLog) log(result.ok ? "SOLIDWORKS status updated." : "SOLIDWORKS connection failed.", result);
    if (!document.hidden && document.getElementById("workLoggerView")?.classList.contains("active")) {
      refreshWorkLoggerList().catch(() => {});
    }
  } catch (error) {
    setStatus({ ok: false, connected: false });
    if (writeLog) log("SOLIDWORKS connection failed.", { error: error.message });
  } finally {
    state.solidWorksStatusInFlight = false;
  }
}

async function copyCurrentDocLocation() {
  if (!ui.copyDocLocationBtn) return;
  const originalLabel = ui.copyDocLocationBtn.textContent;
  ui.copyDocLocationBtn.disabled = true;
  ui.copyDocLocationBtn.textContent = "Copying...";
  try {
    const result = await api.copyCurrentDocLocation();
    if (result?.status) setStatus(result.status);
    if (!result?.ok) throw new Error(result?.error || "Could not copy the active document folder.");
    log("Current document folder copied to clipboard.", {
      documentPath: result.documentPath,
      folderPath: result.folderPath,
    });
    ui.copyDocLocationBtn.textContent = "Copied";
    setTimeout(() => {
      if (!ui.copyDocLocationBtn.disabled) ui.copyDocLocationBtn.textContent = originalLabel;
    }, 900);
  } catch (error) {
    log("Copy current document folder failed.", { error: error.message });
    ui.copyDocLocationBtn.textContent = "Copy Failed";
    setTimeout(() => {
      if (!ui.copyDocLocationBtn.disabled) ui.copyDocLocationBtn.textContent = originalLabel;
    }, 1200);
  } finally {
    ui.copyDocLocationBtn.disabled = false;
    if (ui.copyDocLocationBtn.textContent === "Copying...") ui.copyDocLocationBtn.textContent = originalLabel;
  }
}

const recentDocsState = {
  filter: "all",
  search: "",
  lastSignature: "",
  contextMenu: null,
  contextEntry: null,
  filteredEntries: [],
  renderedCount: 0,
  resetRender: false,
  showAll: false,
  totalCount: 0,
  filteredCount: 0,
};

const RECENT_DOCS_RENDER_BATCH_SIZE = 50;
const WORKLOG_RENDER_BATCH_SIZE = 80;
const DEFAULT_WORKLOG_EXPORT_RULES = {
  cutoffMinutes: 9,
  multiplier: 2,
  roundToMinutes: 30,
};
const MIN_WORKLOG_EXPORT_ENTRY_MINUTES = 30;
const TARGET_HOURS_STEP_MINUTES = 30;
const DEFAULT_WORKLOG_EXPORT_WORKTYPE = "Rajzk\u00e9sz\u00edt\u00e9s/CAM programoz\u00e1s";

const workLoggerState = {
  entries: [],
  path: "",
  activeDate: "",
  counterStatus: null,
  lastSignature: "",
  renderedCount: 0,
  workTypes: [DEFAULT_WORKLOG_EXPORT_WORKTYPE],
  defaultWorkType: DEFAULT_WORKLOG_EXPORT_WORKTYPE,
  workTypesCatalog: null,
  projectWorkTypes: {},
  lastDayMode: false,
  lastDayProjects: [],
  lastDayBackup: null,
  exportDraftEntries: [],
  exportProjectMinuteOverrides: {},
  exportExcludedProjectKeys: new Set(),
};

function recentDocsScrollContainer() {
  return document.querySelector(".content") || document.scrollingElement || document.documentElement;
}

function workLoggerIsActive() {
  return document.getElementById("workLoggerView")?.classList.contains("active");
}

async function refreshRecentDocsList() {
  if (!ui.recentDocsList) return;
  try {
    const result = await api.listRecentDocs({
      filter: recentDocsState.filter,
      query: recentDocsState.search,
      showAll: recentDocsState.showAll,
    });
    if (!result || !result.ok) return;
    recentDocsState.totalCount = Number(result.totalCount || 0);
    recentDocsState.filteredCount = Number(result.filteredCount || 0);
    if (ui.recentDocsMore) ui.recentDocsMore.classList.toggle("hidden", !result.limited);
    if (ui.recentDocsMoreState) {
      const shown = (result.entries || []).length;
      ui.recentDocsMoreState.textContent = result.limited
        ? `${shown} / ${recentDocsState.filteredCount}`
        : "";
    }
    renderRecentDocs(result.entries || []);
  } catch {}
}

function scheduleRecentDocsRefresh(delay = 150) {
  if (state.recentDocsRefreshTimer) clearTimeout(state.recentDocsRefreshTimer);
  if (document.hidden || !document.getElementById("recentDocsView")?.classList.contains("active")) {
    state.recentDocsRefreshTimer = null;
    return;
  }
  state.recentDocsRefreshTimer = setTimeout(() => {
    state.recentDocsRefreshTimer = null;
    if (document.hidden || !document.getElementById("recentDocsView")?.classList.contains("active")) return;
    recentDocsState.lastSignature = "";
    refreshRecentDocsList().catch(() => {});
  }, delay);
}

function hideRecentDocContextMenu() {
  if (!recentDocsState.contextMenu) return;
  recentDocsState.contextMenu.remove();
  recentDocsState.contextMenu = null;
  recentDocsState.contextEntry = null;
}

async function deleteRecentDoc(entry) {
  if (!entry?.path) return;
  hideRecentDocContextMenu();
  try {
    const result = await api.deleteRecentDoc(entry.path);
    if (!result?.ok) {
      log("Could not delete recent document tile.", result);
      return;
    }
    recentDocsState.lastSignature = "";
    log("Recent SOLIDWORKS tile removed.", { path: entry.path, deleted: result.deleted });
    await refreshRecentDocsList();
  } catch (error) {
    log("Could not delete recent document tile.", { error: error.message, path: entry.path });
  }
}

async function retryRecentDocThumbnail(entry, { renderOnly = false } = {}) {
  if (!entry?.path) return;
  hideRecentDocContextMenu();
  try {
    let result;
    if (typeof api.retryRecentDocThumbnail === "function") {
      // Regular retry: shell -> sw-api. "SW render retry": force the
      // view-reorienting SOLIDWORKS render (renderOnly).
      result = await api.retryRecentDocThumbnail(entry.path, { renderOnly });
    } else {
      log("Per-document thumbnail retry needs the updated app core. Rebuild/install or restart after updating the core files.", { path: entry.path });
      return;
    }
    if (!result?.ok) {
      log("Could not retry thumbnail.", result);
      return;
    }
    recentDocsState.lastSignature = "";
    log(renderOnly ? "SW render retry for document (opens/reorients in SOLIDWORKS)." : "Deleted and retrying thumbnail for document.", {
      path: entry.path,
      deletedThumbnail: result.deletedThumbnail,
      renderOnly: result.renderOnly,
    });
    await refreshRecentDocsList();
  } catch (error) {
    log("Could not retry thumbnail.", { error: error.message, path: entry.path });
  }
}

// Doc Search → "Add to recent (as opened)": inject the doc at the top of the
// Recent SOLIDWORKS list with a current timestamp, as if it had just been opened.
async function addDocToRecent(entry) {
  if (!entry?.path) return;
  hideRecentDocContextMenu();
  try {
    if (typeof api.addRecentDoc !== "function") {
      log("Add-to-recent needs the updated app core. Rebuild/install or restart after updating the core files.", { path: entry.path });
      return;
    }
    const result = await api.addRecentDoc(entry.path);
    if (!result?.ok) {
      log("Could not add document to recent.", result);
      return;
    }
    recentDocsState.lastSignature = "";
    log("Added document to the top of Recent SOLIDWORKS docs.", { path: entry.path });
    await refreshRecentDocsList();
  } catch (error) {
    log("Could not add document to recent.", { error: error.message, path: entry.path });
  }
}

async function openContainingFolderForEntry(entry) {
  if (!entry?.path) return;
  hideRecentDocContextMenu();
  try {
    const result = await api.openContainingFolder(entry.path);
    if (!result?.ok) {
      log("Could not open containing folder.", result);
      return;
    }
    log(result.selected ? "Opened folder and selected document." : "Opened containing folder.", {
      path: entry.path,
      folder: result.folder,
    });
  } catch (error) {
    log("Could not open containing folder.", { error: error.message, path: entry.path });
  }
}

async function copyPathForEntry(entry) {
  if (!entry?.path) return;
  hideRecentDocContextMenu();
  try {
    const result = await api.copyDocumentPath(entry.path);
    if (!result?.ok) {
      log("Could not copy document path.", result);
      return;
    }
    log("Document path copied.", { path: result.clipboardText || entry.path });
  } catch (error) {
    log("Could not copy document path.", { error: error.message, path: entry.path });
  }
}

async function copyNameForEntry(entry) {
  if (!entry?.path) return;
  hideRecentDocContextMenu();
  try {
    const result = await api.copyDocumentName(entry.path);
    if (!result?.ok) {
      log("Could not copy document name.", result);
      return;
    }
    log("Document name copied.", { name: result.clipboardText || "" });
  } catch (error) {
    log("Could not copy document name.", { error: error.message, path: entry.path });
  }
}

function showRecentDocContextMenu(event, entry) {
  event.preventDefault();
  event.stopPropagation();
  hideRecentDocContextMenu();

  const menu = document.createElement("div");
  menu.className = "recent-docs-context-menu";
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.innerHTML = `
    <button type="button" data-action="open-folder">${escapeHtml(t("Open folder"))}</button>
    <button type="button" data-action="copy-path">${escapeHtml(t("Copy path"))}</button>
    <button type="button" data-action="copy-name">${escapeHtml(t("Copy document name"))}</button>
    <button type="button" data-action="retry-thumbnail">${escapeHtml(t("Delete + retry thumbnail"))}</button>
    <button type="button" data-action="render-retry">${escapeHtml(t("SW render retry"))}</button>
    <button type="button" data-action="delete">${escapeHtml(t("Delete from recent"))}</button>
  `;
  menu.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    const action = clickEvent.target?.dataset?.action;
    if (action === "open-folder") openContainingFolderForEntry(entry);
    if (action === "copy-path") copyPathForEntry(entry);
    if (action === "copy-name") copyNameForEntry(entry);
    if (action === "retry-thumbnail") retryRecentDocThumbnail(entry);
    if (action === "render-retry") retryRecentDocThumbnail(entry, { renderOnly: true });
    if (action === "delete") deleteRecentDoc(entry);
  });
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const pad = 8;
  const left = Math.min(event.clientX, window.innerWidth - rect.width - pad);
  const top = Math.min(event.clientY, window.innerHeight - rect.height - pad);
  menu.style.left = `${Math.max(pad, left)}px`;
  menu.style.top = `${Math.max(pad, top)}px`;
  recentDocsState.contextMenu = menu;
  recentDocsState.contextEntry = entry;
}

function showDocSearchContextMenu(event, entry) {
  event.preventDefault();
  event.stopPropagation();
  hideRecentDocContextMenu();

  const menu = document.createElement("div");
  menu.className = "recent-docs-context-menu";
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  menu.innerHTML = `
    <button type="button" data-action="add-recent">${escapeHtml(t("Add to recent (as opened)"))}</button>
    <button type="button" data-action="open-folder">${escapeHtml(t("Open folder"))}</button>
    <button type="button" data-action="copy-path">${escapeHtml(t("Copy path"))}</button>
    <button type="button" data-action="copy-name">${escapeHtml(t("Copy document name"))}</button>
    <button type="button" data-action="retry-thumbnail">${escapeHtml(t("Delete + retry thumbnail"))}</button>
    <button type="button" data-action="render-retry">${escapeHtml(t("SW render retry"))}</button>
  `;
  menu.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    const action = clickEvent.target?.dataset?.action;
    if (action === "add-recent") addDocToRecent(entry);
    if (action === "open-folder") openContainingFolderForEntry(entry);
    if (action === "copy-path") copyPathForEntry(entry);
    if (action === "copy-name") copyNameForEntry(entry);
    if (action === "retry-thumbnail") retryRecentDocThumbnail(entry);
    if (action === "render-retry") retryRecentDocThumbnail(entry, { renderOnly: true });
  });
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const pad = 8;
  const left = Math.min(event.clientX, window.innerWidth - rect.width - pad);
  const top = Math.min(event.clientY, window.innerHeight - rect.height - pad);
  menu.style.left = `${Math.max(pad, left)}px`;
  menu.style.top = `${Math.max(pad, top)}px`;
  recentDocsState.contextMenu = menu;
  recentDocsState.contextEntry = entry;
}

function filterRecentDocs(entries) {
  let filtered = recentDocsState.filter === "all"
    ? entries
    : entries.filter((e) => String(e.type || "").toLowerCase() === recentDocsState.filter);
  const query = recentDocsState.search.trim().toLowerCase();
  if (query) {
    const tokens = query.split(/\s+/).filter(Boolean);
    const matchesAll = (value) => tokens.every((tok) => String(value || "").toLowerCase().includes(tok));
    const filenameMatches = filtered.filter((e) => {
      const filename = e.title || basenameOf(e.path || "");
      return matchesAll(filename);
    });
    if (filenameMatches.length) return filenameMatches;
    filtered = filtered.filter((e) => matchesAll(`${e.displayPath || ""} ${e.path || ""}`));
  }
  return filtered;
}

function formatProjectActivity(summary) {
  const minutes = Math.max(0, Math.round(Number(summary?.minutes || 0)));
  const hours = Number(summary?.hours || 0).toFixed(1);
  const overtimeMinutes = Math.max(0, Math.round(Number(
    summary?.overtimeMinutes ?? (Number(summary?.overtimeMs || 0) / 60000),
  )));
  return overtimeMinutes > 0
    ? `${minutes} min (${hours} h), OT ${overtimeMinutes} min`
    : `${minutes} min (${hours} h)`;
}

function formatShortDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return "";
  const minutes = value / 60000;
  if (minutes < 1) return "<1 min";
  if (minutes < 10) return `${minutes.toFixed(1)} min`;
  return `${Math.round(minutes)} min`;
}

function worklogWorkTypeOptions() {
  const seen = new Set();
  const result = [];
  for (const item of workLoggerState.workTypes || []) {
    const text = String(item || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result.length ? result : [DEFAULT_WORKLOG_EXPORT_WORKTYPE];
}

function pickWorklogWorkType(value, fallback = DEFAULT_WORKLOG_EXPORT_WORKTYPE) {
  const options = worklogWorkTypeOptions();
  const requested = String(value || "").trim();
  if (requested && options.includes(requested)) return requested;
  if (fallback && options.includes(fallback)) return fallback;
  if (workLoggerState.defaultWorkType && options.includes(workLoggerState.defaultWorkType)) {
    return workLoggerState.defaultWorkType;
  }
  return options[0] || DEFAULT_WORKLOG_EXPORT_WORKTYPE;
}

function defaultWorklogWorkType() {
  return pickWorklogWorkType(workLoggerState.defaultWorkType, DEFAULT_WORKLOG_EXPORT_WORKTYPE);
}

function populateWorklogWorkTypeSelect(select, selected) {
  if (!select) return;
  const chosen = pickWorklogWorkType(selected, defaultWorklogWorkType());
  const fragment = document.createDocumentFragment();
  for (const workType of worklogWorkTypeOptions()) {
    const option = document.createElement("option");
    option.value = workType;
    option.textContent = workType;
    fragment.appendChild(option);
  }
  select.replaceChildren(fragment);
  select.value = chosen;
}

async function loadWorklogWorkTypes() {
  const fallback = {
    ok: false,
    defaultWorkType: DEFAULT_WORKLOG_EXPORT_WORKTYPE,
    workTypes: [DEFAULT_WORKLOG_EXPORT_WORKTYPE],
  };
  let result = fallback;
  if (typeof api.listWorklogWorktypes === "function") {
    try {
      result = await api.listWorklogWorktypes();
    } catch (error) {
      result = { ...fallback, error: error.message };
    }
  }
  const types = Array.isArray(result?.workTypes)
    ? result.workTypes.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  workLoggerState.workTypes = types.length ? types : [DEFAULT_WORKLOG_EXPORT_WORKTYPE];
  workLoggerState.defaultWorkType = pickWorklogWorkType(result?.defaultWorkType, DEFAULT_WORKLOG_EXPORT_WORKTYPE);
  workLoggerState.workTypesCatalog = result;
  populateWorklogWorkTypeSelect(ui.worklogExportDefaultWorkType, workLoggerState.defaultWorkType);
  populateWorklogWorkTypeSelect(ui.worklogExportSecondWorkType, workLoggerState.defaultWorkType);
  return result;
}

function worklogProjectExportKey(entry) {
  return String(entry?.key || entry?.name || "unknown project").trim().toLowerCase();
}

function syncWorklogProjectWorkTypeState() {
  if (!ui.worklogExportProjectWorkTypes) return;
  const selects = ui.worklogExportProjectWorkTypes.querySelectorAll("select[data-worklog-project-key]");
  const next = { ...workLoggerState.projectWorkTypes };
  for (const select of selects) {
    const key = String(select.dataset.worklogProjectKey || "").trim();
    if (!key) continue;
    const index = select.dataset.worklogWorkTypeSlot === "secondary" ? 1 : 0;
    const current = Array.isArray(next[key]) ? next[key].slice(0, 2) : [];
    current[index] = select.value;
    next[key] = current;
  }
  workLoggerState.projectWorkTypes = next;
}

function readWorklogExportRules(options = {}) {
  if (!options.skipProjectSync) syncWorklogProjectWorkTypeState();
  const cutoffMinutes = Math.max(0, Math.min(1440, Math.round(
    Number(ui.worklogExportCutoffMinutes?.value || DEFAULT_WORKLOG_EXPORT_RULES.cutoffMinutes),
  )));
  const multiplierValue = Number(ui.worklogExportMultiplier?.value || DEFAULT_WORKLOG_EXPORT_RULES.multiplier);
  const multiplier = Number((Number.isFinite(multiplierValue)
    ? Math.max(0.01, Math.min(24, multiplierValue))
    : DEFAULT_WORKLOG_EXPORT_RULES.multiplier).toFixed(3));
  const roundToMinutesValue = Number(ui.worklogExportRoundToMinutes?.value || DEFAULT_WORKLOG_EXPORT_RULES.roundToMinutes);
  const roundToMinutes = [5, 10, 15, 30, 60].includes(roundToMinutesValue)
    ? roundToMinutesValue
    : DEFAULT_WORKLOG_EXPORT_RULES.roundToMinutes;
  const defaultWorkType = pickWorklogWorkType(ui.worklogExportDefaultWorkType?.value, defaultWorklogWorkType());
  const splitByWorkType = Boolean(ui.worklogExportSplitByWorkType?.checked);
  const splitWorkTypes = [
    defaultWorkType,
    pickWorklogWorkType(ui.worklogExportSecondWorkType?.value, defaultWorkType),
  ];
  const targetHoursMode = Boolean(ui.worklogExportTargetHoursMode?.checked);
  const targetHoursValue = Number(ui.worklogExportTargetHours?.value || 8);
  const targetHours = Math.max(0.5, Math.round((Number.isFinite(targetHoursValue) ? targetHoursValue : 8) * 2) / 2);
  const rules = {
    cutoffMinutes,
    multiplier,
    roundToMinutes,
    defaultWorkType,
    splitByWorkType,
    splitWorkTypes,
    perProjectWorkTypes: Boolean(ui.worklogExportPerProjectWorkTypes?.checked),
    projectWorkTypes: { ...workLoggerState.projectWorkTypes },
    targetHoursMode,
    targetHours,
  };
  if (options.includeTransient !== false) {
    rules.excludedProjectKeys = Array.from(workLoggerState.exportExcludedProjectKeys);
    rules.projectMinuteOverrides = { ...workLoggerState.exportProjectMinuteOverrides };
  }
  return rules;
}

function resetWorklogExportRuleInputs() {
  if (ui.worklogExportCutoffMinutes) ui.worklogExportCutoffMinutes.value = String(DEFAULT_WORKLOG_EXPORT_RULES.cutoffMinutes);
  if (ui.worklogExportMultiplier) ui.worklogExportMultiplier.value = String(DEFAULT_WORKLOG_EXPORT_RULES.multiplier);
  if (ui.worklogExportRoundToMinutes) ui.worklogExportRoundToMinutes.value = String(DEFAULT_WORKLOG_EXPORT_RULES.roundToMinutes);
  workLoggerState.projectWorkTypes = {};
  const defaultType = defaultWorklogWorkType();
  populateWorklogWorkTypeSelect(ui.worklogExportDefaultWorkType, defaultType);
  populateWorklogWorkTypeSelect(ui.worklogExportSecondWorkType, defaultType);
  if (ui.worklogExportPerProjectWorkTypes) ui.worklogExportPerProjectWorkTypes.checked = false;
  if (ui.worklogExportSplitByWorkType) ui.worklogExportSplitByWorkType.checked = false;
  if (ui.worklogExportSecondWorkTypeWrap) ui.worklogExportSecondWorkTypeWrap.classList.add("hidden");
  if (ui.worklogExportProjectWorkTypes) {
    ui.worklogExportProjectWorkTypes.classList.add("hidden");
    ui.worklogExportProjectWorkTypes.replaceChildren();
  }
  if (ui.worklogExportTargetHoursMode) ui.worklogExportTargetHoursMode.checked = false;
  if (ui.worklogExportTargetHours) ui.worklogExportTargetHours.value = "8";
  workLoggerState.exportProjectMinuteOverrides = {};
  workLoggerState.exportExcludedProjectKeys = new Set();
}

// Load a saved/remembered rules object into the dialog inputs.
function applyWorklogExportRules(rules) {
  const r = rules || {};
  if (ui.worklogExportCutoffMinutes) ui.worklogExportCutoffMinutes.value = String(r.cutoffMinutes ?? DEFAULT_WORKLOG_EXPORT_RULES.cutoffMinutes);
  if (ui.worklogExportMultiplier) ui.worklogExportMultiplier.value = String(r.multiplier ?? DEFAULT_WORKLOG_EXPORT_RULES.multiplier);
  const roundTo = [5, 10, 15, 30, 60].includes(Number(r.roundToMinutes)) ? Number(r.roundToMinutes) : DEFAULT_WORKLOG_EXPORT_RULES.roundToMinutes;
  if (ui.worklogExportRoundToMinutes) ui.worklogExportRoundToMinutes.value = String(roundTo);
  workLoggerState.projectWorkTypes = (r.projectWorkTypes && typeof r.projectWorkTypes === "object") ? { ...r.projectWorkTypes } : {};
  const defaultType = pickWorklogWorkType(r.defaultWorkType, defaultWorklogWorkType());
  populateWorklogWorkTypeSelect(ui.worklogExportDefaultWorkType, defaultType);
  const secondType = pickWorklogWorkType(Array.isArray(r.splitWorkTypes) ? r.splitWorkTypes[1] : undefined, defaultType);
  populateWorklogWorkTypeSelect(ui.worklogExportSecondWorkType, secondType);
  if (ui.worklogExportPerProjectWorkTypes) ui.worklogExportPerProjectWorkTypes.checked = Boolean(r.perProjectWorkTypes);
  if (ui.worklogExportSplitByWorkType) ui.worklogExportSplitByWorkType.checked = Boolean(r.splitByWorkType);
  if (ui.worklogExportSecondWorkTypeWrap) ui.worklogExportSecondWorkTypeWrap.classList.toggle("hidden", !r.splitByWorkType);
  if (ui.worklogExportTargetHoursMode) ui.worklogExportTargetHoursMode.checked = Boolean(r.targetHoursMode);
  if (ui.worklogExportTargetHours) ui.worklogExportTargetHours.value = String(r.targetHours ?? 8);
  if (ui.worklogExportProjectWorkTypes) {
    ui.worklogExportProjectWorkTypes.classList.toggle("hidden", !r.perProjectWorkTypes);
    if (!r.perProjectWorkTypes) ui.worklogExportProjectWorkTypes.replaceChildren();
  }
  // Per-project hour edits and omissions are intentionally one-export-only.
  workLoggerState.exportProjectMinuteOverrides = {};
  workLoggerState.exportExcludedProjectKeys = new Set();
}

// Show the target input and grey out multiplier/round-up when target mode owns
// the totals.
function syncWorklogTargetHoursUi() {
  const on = Boolean(ui.worklogExportTargetHoursMode?.checked);
  if (ui.worklogExportTargetHoursWrap) ui.worklogExportTargetHoursWrap.classList.toggle("hidden", !on);
  for (const el of [ui.worklogExportMultiplier, ui.worklogExportRoundToMinutes]) {
    if (!el) continue;
    el.disabled = on;
    const label = el.closest("label");
    if (label) label.classList.toggle("worklog-export-disabled", on);
  }
}

// The dialog previews/exports today's live list, or the recovered last-day
// backup when opened via "Export last day".
function resetWorklogExportTransientState(entries = []) {
  workLoggerState.exportDraftEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({ ...entry }));
  workLoggerState.exportProjectMinuteOverrides = {};
  workLoggerState.exportExcludedProjectKeys = new Set();
}

function worklogExportSourceEntries() {
  return workLoggerState.exportDraftEntries || [];
}

function worklogProjectTimeBucketsJs(entry) {
  const totalMs = Math.max(0, Number(entry?.totalMs || 0));
  const overtimeMs = Math.max(0, Math.min(totalMs, Number(entry?.overtimeMs || 0)));
  const regularMs = Math.max(0, totalMs - overtimeMs);
  const buckets = [];
  if (regularMs > 0) buckets.push({ id: "regular", overtime: false, totalMs: regularMs });
  if (overtimeMs > 0) buckets.push({ id: "overtime", overtime: true, totalMs: overtimeMs });
  return buckets;
}

function worklogTimeBucketKeyJs(entry, bucket) {
  return `${worklogProjectExportKey(entry)}\u0000${bucket.overtime ? "overtime" : "regular"}`;
}

function roundWorklogTimeBucketJs(bucket, rules) {
  const originalMinutes = Math.max(0, Number(bucket?.totalMs || 0) / 60000);
  if (originalMinutes + 1e-9 < rules.cutoffMinutes) {
    return { ...bucket, exportable: false, originalMinutes, roundedMinutes: 0 };
  }
  const roundedMinutes = Math.max(
    MIN_WORKLOG_EXPORT_ENTRY_MINUTES,
    rules.roundToMinutes,
    Math.round((originalMinutes * rules.multiplier) / rules.roundToMinutes) * rules.roundToMinutes,
  );
  return { ...bucket, exportable: true, originalMinutes, roundedMinutes };
}

// Mirror of the backend target allocator. Regular and overtime are independent
// 0.5 h buckets once each has passed the shared cutoff.
function allocateTargetHoursMinutesJs(entries, rules) {
  const result = new Map();
  const qualifying = [];
  for (const entry of entries || []) {
    for (const bucket of worklogProjectTimeBucketsJs(entry)) {
      if ((bucket.totalMs / 60000) + 1e-9 < rules.cutoffMinutes) continue;
      qualifying.push({ ...bucket, key: worklogTimeBucketKeyJs(entry, bucket) });
    }
  }
  if (!qualifying.length) return result;
  const targetBlocks = Math.round((rules.targetHours * 60) / TARGET_HOURS_STEP_MINUTES);
  const totalBlocks = Math.max(qualifying.length, targetBlocks);
  const blocks = new Map(qualifying.map((bucket) => [bucket.key, 1]));
  let remaining = totalBlocks - qualifying.length;
  if (remaining > 0) {
    const totalMs = qualifying.reduce((sum, bucket) => sum + bucket.totalMs, 0) || 1;
    const shares = qualifying.map((bucket) => {
      const exact = remaining * (bucket.totalMs / totalMs);
      const floor = Math.floor(exact);
      return { key: bucket.key, floor, frac: exact - floor };
    });
    for (const share of shares) {
      blocks.set(share.key, blocks.get(share.key) + share.floor);
      remaining -= share.floor;
    }
    shares.sort((a, b) => (b.frac - a.frac) || a.key.localeCompare(b.key));
    for (let index = 0; index < shares.length && remaining > 0; index++) {
      blocks.set(shares[index].key, blocks.get(shares[index].key) + 1);
      remaining -= 1;
    }
  }
  for (const bucket of qualifying) {
    result.set(bucket.key, blocks.get(bucket.key) * TARGET_HOURS_STEP_MINUTES);
  }
  return result;
}

function allocatePreviewOverrideBuckets(timeBuckets, requestedMinutes) {
  const buckets = (timeBuckets || []).filter((bucket) => bucket.exportable);
  if (!buckets.length) return timeBuckets || [];
  const targetMinutes = Math.max(
    buckets.length * MIN_WORKLOG_EXPORT_ENTRY_MINUTES,
    Math.round(Number(requestedMinutes) || 0),
  );
  const remainingMinutes = targetMinutes - (buckets.length * MIN_WORKLOG_EXPORT_ENTRY_MINUTES);
  const totalWeight = buckets.reduce((sum, bucket) => sum + Math.max(0, Number(bucket.roundedMinutes || 0)), 0) || 1;
  const shares = buckets.map((bucket) => {
    const exact = remainingMinutes * (Math.max(0, Number(bucket.roundedMinutes || 0)) / totalWeight);
    const floor = Math.floor(exact);
    return { id: bucket.id, minutes: MIN_WORKLOG_EXPORT_ENTRY_MINUTES + floor, frac: exact - floor };
  });
  let unassigned = targetMinutes - shares.reduce((sum, share) => sum + share.minutes, 0);
  shares.sort((a, b) => (b.frac - a.frac) || a.id.localeCompare(b.id));
  for (let index = 0; index < shares.length && unassigned > 0; index = (index + 1) % shares.length) {
    shares[index].minutes += 1;
    unassigned -= 1;
  }
  const minutesById = new Map(shares.map((share) => [share.id, share.minutes]));
  return (timeBuckets || []).map((bucket) => bucket.exportable
    ? { ...bucket, roundedMinutes: minutesById.get(bucket.id) }
    : bucket);
}

function previewWorklogSegmentCount(minutes, rules) {
  if (!rules.splitByWorkType || minutes < MIN_WORKLOG_EXPORT_ENTRY_MINUTES * 2) return 1;
  const step = Math.max(1, Number(rules.roundToMinutes) || 30);
  let first = Math.ceil((minutes / 2) / step) * step;
  let second = minutes - first;
  if (second < MIN_WORKLOG_EXPORT_ENTRY_MINUTES) {
    first = Math.floor((minutes - MIN_WORKLOG_EXPORT_ENTRY_MINUTES) / step) * step;
    second = minutes - first;
  }
  return first >= MIN_WORKLOG_EXPORT_ENTRY_MINUTES && second >= MIN_WORKLOG_EXPORT_ENTRY_MINUTES ? 2 : 1;
}

function previewWorklogExport(entries, rules) {
  const result = {
    exported: 0,
    entryCount: 0,
    skipped: 0,
    exportedMinutes: 0,
    overtimeMinutes: 0,
    overLimit: 0,
    exportableEntries: [],
  };
  const maxMinutes = rules.splitByWorkType ? 48 * 60 : 24 * 60;
  const excluded = new Set((rules.excludedProjectKeys || []).map((key) => String(key || "").trim().toLowerCase()));
  const activeEntries = (entries || []).filter((entry) => !excluded.has(worklogProjectExportKey(entry)));
  const targetAllocation = rules.targetHoursMode
    ? allocateTargetHoursMinutesJs(activeEntries, rules)
    : null;

  for (const entry of entries || []) {
    const key = worklogProjectExportKey(entry);
    if (excluded.has(key)) {
      result.skipped++;
      continue;
    }
    const originalMinutes = Math.max(0, Number(entry?.totalMs || 0) / 60000);
    let timeBuckets = worklogProjectTimeBucketsJs(entry).map((bucket) => {
      if (!rules.targetHoursMode) return roundWorklogTimeBucketJs(bucket, rules);
      const allocationKey = worklogTimeBucketKeyJs(entry, bucket);
      if (!targetAllocation.has(allocationKey)) {
        return { ...bucket, exportable: false, originalMinutes: bucket.totalMs / 60000, roundedMinutes: 0 };
      }
      return {
        ...bucket,
        exportable: true,
        originalMinutes: bucket.totalMs / 60000,
        roundedMinutes: targetAllocation.get(allocationKey),
      };
    });
    let exportableBuckets = timeBuckets.filter((bucket) => bucket.exportable);
    if (!exportableBuckets.length) {
      result.skipped++;
      continue;
    }
    let roundedMinutes = exportableBuckets.reduce((sum, bucket) => sum + bucket.roundedMinutes, 0);
    if (Object.prototype.hasOwnProperty.call(rules.projectMinuteOverrides || {}, key)) {
      const requested = Number(rules.projectMinuteOverrides[key]);
      if (Number.isFinite(requested) && requested > 0 && requested <= maxMinutes) {
        timeBuckets = allocatePreviewOverrideBuckets(timeBuckets, requested);
        exportableBuckets = timeBuckets.filter((bucket) => bucket.exportable);
        roundedMinutes = exportableBuckets.reduce((sum, bucket) => sum + bucket.roundedMinutes, 0);
      }
    }
    if (!Number.isFinite(roundedMinutes) || roundedMinutes <= 0 || roundedMinutes > maxMinutes) {
      result.skipped++;
      if (roundedMinutes > maxMinutes) result.overLimit++;
      continue;
    }
    const roundedOvertimeMinutes = exportableBuckets
      .filter((bucket) => bucket.overtime)
      .reduce((sum, bucket) => sum + bucket.roundedMinutes, 0);
    result.exported++;
    result.exportedMinutes += roundedMinutes;
    result.overtimeMinutes += roundedOvertimeMinutes;
    result.entryCount += exportableBuckets.reduce(
      (sum, bucket) => sum + previewWorklogSegmentCount(bucket.roundedMinutes, rules),
      0,
    );
    result.exportableEntries.push({
      ...entry,
      originalMinutes,
      roundedMinutes,
      roundedOvertimeMinutes,
      minimumRoundedMinutes: exportableBuckets.length * MIN_WORKLOG_EXPORT_ENTRY_MINUTES,
      timeBuckets,
    });
  }
  return result;
}

function createWorklogProjectWorkTypeSelect(projectKey, slot, selected) {
  const select = document.createElement("select");
  select.dataset.worklogProjectKey = projectKey;
  select.dataset.worklogWorkTypeSlot = slot;
  select.title = slot === "secondary" ? "Second worktype" : "Worktype";
  populateWorklogWorkTypeSelect(select, selected);
  select.addEventListener("change", () => {
    syncWorklogProjectWorkTypeState();
    updateWorklogExportPreview();
  });
  return select;
}

function formatWorklogExportHours(minutes) {
  return (Number(minutes || 0) / 60).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function renderWorklogExportProjectWorkTypes(options = {}) {
  syncWorklogProjectWorkTypeState();
  const split = Boolean(ui.worklogExportSplitByWorkType?.checked);
  if (ui.worklogExportSecondWorkTypeWrap) ui.worklogExportSecondWorkTypeWrap.classList.toggle("hidden", !split);
  if (!ui.worklogExportProjectWorkTypes) return;
  const perProject = Boolean(ui.worklogExportPerProjectWorkTypes?.checked);
  ui.worklogExportProjectWorkTypes.classList.toggle("hidden", !perProject);
  if (!perProject) {
    ui.worklogExportProjectWorkTypes.replaceChildren();
    return;
  }

  const previousScrollTop = options.preserveScroll === false
    ? 0
    : ui.worklogExportProjectWorkTypes.scrollTop;
  const rules = readWorklogExportRules({ skipProjectSync: true });
  const entries = worklogExportSourceEntries();
  const preview = previewWorklogExport(entries, rules);
  // Keep omitted rows visible so an accidental cross can be undone. Their
  // displayed hours come from a preview with omissions disabled; active rows
  // use the real preview because target-hours allocation may have changed.
  const displayPreview = previewWorklogExport(entries, { ...rules, excludedProjectKeys: [] });
  const actualByKey = new Map(preview.exportableEntries.map((entry) => [worklogProjectExportKey(entry), entry]));
  const fragment = document.createDocumentFragment();
  for (const displayEntry of displayPreview.exportableEntries) {
    const key = worklogProjectExportKey(displayEntry);
    const excluded = workLoggerState.exportExcludedProjectKeys.has(key);
    const entry = actualByKey.get(key) || displayEntry;
    const saved = Array.isArray(workLoggerState.projectWorkTypes[key])
      ? workLoggerState.projectWorkTypes[key]
      : [];
    const row = document.createElement("div");
    row.className = `worklog-export-project-type-row${split ? " split" : ""}`;
    row.classList.toggle("excluded", excluded);
    const info = document.createElement("div");
    info.className = "worklog-export-project-name";
    info.innerHTML = `
      <span>Project</span>
      <strong title="${escapeAttr(entry.name || "")}">${escapeHtml(entry.name || "Unknown project")}</strong>
      <small>${escapeHtml(`${formatProjectActivity(entry)} -> ${formatWorklogExportHours(entry.roundedMinutes)} h`)}</small>
    `;
    row.appendChild(info);

    const hourControl = document.createElement("div");
    hourControl.className = "worklog-export-hour-control";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "worklog-export-hour-button";
    minus.textContent = "-";
    minus.title = "Subtract 0.5 hours from this export";
    minus.setAttribute("aria-label", minus.title);
    const hourValue = document.createElement("span");
    hourValue.className = "worklog-export-hour-value";
    hourValue.textContent = `${formatWorklogExportHours(entry.roundedMinutes)} h`;
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "worklog-export-hour-button";
    plus.textContent = "+";
    plus.title = "Add 0.5 hours to this export";
    plus.setAttribute("aria-label", plus.title);
    const minimumRoundedMinutes = Math.max(
      MIN_WORKLOG_EXPORT_ENTRY_MINUTES,
      Number(entry.minimumRoundedMinutes || MIN_WORKLOG_EXPORT_ENTRY_MINUTES),
    );
    minus.disabled = excluded || entry.roundedMinutes <= minimumRoundedMinutes;
    plus.disabled = excluded || entry.roundedMinutes >= (split ? 48 * 60 : 24 * 60);
    const adjustHours = (deltaMinutes) => {
      const current = Object.prototype.hasOwnProperty.call(workLoggerState.exportProjectMinuteOverrides, key)
        ? Number(workLoggerState.exportProjectMinuteOverrides[key])
        : Number(entry.roundedMinutes);
      const maxMinutes = split ? 48 * 60 : 24 * 60;
      workLoggerState.exportProjectMinuteOverrides[key] = Math.max(
        minimumRoundedMinutes,
        Math.min(maxMinutes, current + deltaMinutes),
      );
      renderWorklogExportProjectWorkTypes({ preserveScroll: true });
      updateWorklogExportPreview();
    };
    minus.addEventListener("click", () => adjustHours(-30));
    plus.addEventListener("click", () => adjustHours(30));
    hourControl.append(minus, hourValue, plus);
    row.appendChild(hourControl);

    const primarySelect = createWorklogProjectWorkTypeSelect(key, "primary", saved[0] || rules.defaultWorkType);
    primarySelect.disabled = excluded;
    row.appendChild(primarySelect);
    if (split) {
      const secondarySelect = createWorklogProjectWorkTypeSelect(key, "secondary", saved[1] || rules.splitWorkTypes[1]);
      secondarySelect.disabled = excluded;
      row.appendChild(secondarySelect);
    }

    const excludeButton = document.createElement("button");
    excludeButton.type = "button";
    excludeButton.className = "worklog-export-exclude-button";
    excludeButton.textContent = "\u00d7";
    excludeButton.title = excluded ? "Restore to this export" : "Exclude from this export";
    excludeButton.setAttribute("aria-label", excludeButton.title);
    excludeButton.setAttribute("aria-pressed", String(excluded));
    excludeButton.addEventListener("click", () => {
      if (excluded) workLoggerState.exportExcludedProjectKeys.delete(key);
      else workLoggerState.exportExcludedProjectKeys.add(key);
      renderWorklogExportProjectWorkTypes({ preserveScroll: true });
      updateWorklogExportPreview();
    });
    row.appendChild(excludeButton);
    fragment.appendChild(row);
  }
  ui.worklogExportProjectWorkTypes.replaceChildren(fragment);
  ui.worklogExportProjectWorkTypes.scrollTop = previousScrollTop;
}

function updateWorklogExportPreview() {
  if (!ui.worklogExportSummary) return;
  const rules = readWorklogExportRules();
  const preview = previewWorklogExport(worklogExportSourceEntries(), rules);
  const hours = (preview.exportedMinutes / 60).toFixed(2);
  const overtimeText = preview.overtimeMinutes > 0
    ? ` Overtime: ${(preview.overtimeMinutes / 60).toFixed(2)} h.`
    : "";
  const skippedText = preview.skipped ? ` Skipped: ${preview.skipped}.` : "";
  const overLimitText = preview.overLimit ? ` Over 24 h limit: ${preview.overLimit}.` : "";
  ui.worklogExportSummary.textContent = preview.exported
    ? `Ready: ${preview.exported} project(s), ${preview.entryCount} log(s), ${hours} h.${overtimeText}${skippedText}${overLimitText}`
    : `No projects meet these rules.${skippedText}${overLimitText}`;
  if (ui.confirmWorklogExportBtn) ui.confirmWorklogExportBtn.disabled = preview.exported <= 0;
}

function updateWorklogExportControls(options = {}) {
  syncWorklogTargetHoursUi();
  renderWorklogExportProjectWorkTypes(options);
  updateWorklogExportPreview();
}

function setWorklogExportDialogOpen(open) {
  if (!ui.worklogExportDialog) return;
  ui.worklogExportDialog.classList.toggle("hidden", !open);
  if (!open) {
    workLoggerState.lastDayMode = false;
    resetWorklogExportTransientState();
    return;
  }
  if (ui.worklogExportTitle) {
    ui.worklogExportTitle.textContent = workLoggerState.lastDayMode ? "Export last day (recovered)" : "Export Work Logs";
  }
  if (ui.confirmWorklogExportBtn) {
    ui.confirmWorklogExportBtn.textContent = workLoggerState.lastDayMode ? "Export last day" : "Export";
  }
  if (ui.worklogExportState) {
    const backup = workLoggerState.lastDayBackup;
    if (workLoggerState.lastDayMode && backup) {
      const when = backup.activeDate || "the last reset";
      ui.worklogExportState.textContent = `Recovering ${backup.count} project(s) from ${when}${backup.reason ? ` (${backup.reason})` : ""}. Today's running totals are untouched.`;
      ui.worklogExportState.classList.remove("muted");
    } else {
      ui.worklogExportState.textContent = "";
      ui.worklogExportState.classList.add("muted");
    }
  }
  updateWorklogExportControls({ preserveScroll: false });
  requestAnimationFrame(() => ui.worklogExportCutoffMinutes?.focus());
}

async function openWorklogExportDialog(options = {}) {
  workLoggerState.lastDayMode = Boolean(options.lastDay);
  resetWorklogExportTransientState();
  await loadWorklogWorkTypes();
  // Restore the last-used settings (from a previous export or the Set button),
  // falling back to defaults the first time.
  let savedRules = null;
  if (typeof api.getWorklogExportRules === "function") {
    try {
      const res = await api.getWorklogExportRules();
      if (res?.ok && res.rules) savedRules = res.rules;
    } catch {}
  }
  if (savedRules) applyWorklogExportRules(savedRules);
  else resetWorklogExportRuleInputs();
  if (workLoggerState.lastDayMode) {
    workLoggerState.lastDayProjects = Array.isArray(options.projects)
      ? options.projects
      : (workLoggerState.lastDayBackup?.projects || []);
    resetWorklogExportTransientState(workLoggerState.lastDayProjects);
  } else {
    await refreshWorkLoggerList();
    resetWorklogExportTransientState(workLoggerState.entries);
  }
  setWorklogExportDialogOpen(true);
}

function createRecentDocTile(entry) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = `recent-docs-tile${entry.missing ? " missing" : ""}`;
  tile.dataset.path = entry.path;
  tile.title = `${entry.path}${entry.missing ? "\n(file missing)" : ""}`;
  const typeKey = String(entry.type || "other");
  const typeLabel = typeKey === "part" ? "PRT"
    : typeKey === "assembly" ? "ASS"
    : typeKey === "drawing" ? "DRW"
    : typeKey === "solidcam" ? "CAM"
    : "?";
  const filename = entry.title || entry.path.split(/[\\/]/).pop();
  const fullPath = entry.displayPath || displayPathOf(entry.path);
  const thumbHtml = entry.thumbnail
    ? `<img class="recent-docs-tile-image" src="${escapeAttr(entry.thumbnail)}" alt="" loading="lazy">`
    : `<div class="recent-docs-tile-thumb type-${typeKey}">${escapeHtml(typeLabel)}</div>`;
  tile.innerHTML = `
    <div class="document-thumb-wrap">
      ${thumbHtml}
      <span class="document-type-badge type-${escapeAttr(typeKey)}">${escapeHtml(typeLabel)}</span>
    </div>
    <div class="recent-docs-tile-name">${escapeHtml(filename)}</div>
    <div class="recent-docs-tile-path" title="${escapeAttr(fullPath)}">${escapeHtml(fullPath)}</div>
  `;
  tile.addEventListener("click", () => {
    hideRecentDocContextMenu();
    if (entry.missing) return;
    api.openRecentDoc(entry.path).then((r) => {
      if (!r.ok) log("Failed to open recent document.", r);
      else if (r.thumbnailRetryScheduled) {
        log("Opened recent document. Retrying thumbnail after SOLIDWORKS loads it.", { path: entry.path });
      }
    });
  });
  tile.addEventListener("contextmenu", (event) => showRecentDocContextMenu(event, entry));
  return tile;
}

function appendRecentDocsBatch(batchSize = RECENT_DOCS_RENDER_BATCH_SIZE) {
  if (!ui.recentDocsList) return;
  const start = recentDocsState.renderedCount;
  const end = Math.min(recentDocsState.filteredEntries.length, start + batchSize);
  if (end <= start) return;
  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    fragment.appendChild(createRecentDocTile(recentDocsState.filteredEntries[i]));
  }
  ui.recentDocsList.appendChild(fragment);
  recentDocsState.renderedCount = end;
}

function maybeLoadMoreRecentDocs() {
  if (!ui.recentDocsList) return;
  if (!document.getElementById("recentDocsView")?.classList.contains("active")) return;
  if (recentDocsState.renderedCount >= recentDocsState.filteredEntries.length) return;
  const scroller = recentDocsScrollContainer();
  if (!scroller) return;
  const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  if (remaining < 900) appendRecentDocsBatch();
}

function renderRecentDocs(entries) {
  if (!ui.recentDocsList) return;
  const filtered = filterRecentDocs(entries);
  const query = recentDocsState.search.trim().toLowerCase();
  const signature = `${recentDocsState.filter}::${query}::` + filtered.map((e) =>
    `${e.path}|${e.missing ? 1 : 0}|${e.thumbnail || ""}|${e.displayPath || ""}`
  ).join(";");
  if (signature === recentDocsState.lastSignature) return;
  const previouslyRendered = recentDocsState.renderedCount || RECENT_DOCS_RENDER_BATCH_SIZE;
  recentDocsState.lastSignature = signature;
  recentDocsState.filteredEntries = filtered;
  const scroller = recentDocsScrollContainer();
  const scrollTop = scroller ? scroller.scrollTop : 0;
  ui.recentDocsList.replaceChildren();
  recentDocsState.renderedCount = 0;
  const targetCount = recentDocsState.resetRender
    ? RECENT_DOCS_RENDER_BATCH_SIZE
    : Math.max(RECENT_DOCS_RENDER_BATCH_SIZE, previouslyRendered);
  recentDocsState.resetRender = false;
  appendRecentDocsBatch(targetCount);
  if (scroller && scrollTop > 0) {
    requestAnimationFrame(() => {
      scroller.scrollTop = scrollTop;
      maybeLoadMoreRecentDocs();
    });
  }
}

function formatWorklogDate(value) {
  const ts = Number(value || 0);
  if (!ts) return "never";
  return new Date(ts).toLocaleString();
}

// One active +/- gesture at a time (single pointer). Module-scope so a global
// pointer-release net can always stop a runaway repeat, and so the list can be
// frozen from re-rendering while a gesture (and its pending backend flush) runs
// - otherwise the held button gets detached and the display lags.
const worklogAdjust = { holdTimer: null, repeatTimer: null, flushTimer: null, holding: false, busy: false };

// holding = button currently pressed; cleared on ANY release/cancel/blur so the
// +10/0.5s ramp can never loop forever.
function stopWorklogHold() {
  if (worklogAdjust.holdTimer) { clearTimeout(worklogAdjust.holdTimer); worklogAdjust.holdTimer = null; }
  if (worklogAdjust.repeatTimer) { clearInterval(worklogAdjust.repeatTimer); worklogAdjust.repeatTimer = null; }
  worklogAdjust.holding = false;
}
window.addEventListener("pointerup", stopWorklogHold, true);
window.addEventListener("pointercancel", stopWorklogHold, true);
window.addEventListener("blur", stopWorklogHold);

// Instant, purely-optimistic display update on every click/tick. The backend is
// NOT touched here - we only accumulate the net delta and flush once per burst,
// so the visible number changes immediately with zero round-trip latency.
function bumpWorklogEntry(entry, strongEl, deltaMinutes) {
  if (!entry) return;
  worklogAdjust.busy = true;
  entry.totalMs = Math.max(0, Number(entry.totalMs || 0) + deltaMinutes * 60000);
  // formatProjectActivity reads minutes/hours, not totalMs - keep them in sync so
  // the optimistic update is actually visible.
  entry.minutes = Math.round(entry.totalMs / 60000);
  entry.hours = Number((entry.totalMs / 3600000).toFixed(1));
  entry._pendingAdjust = Number(entry._pendingAdjust || 0) + deltaMinutes;
  if (strongEl) strongEl.textContent = formatProjectActivity(entry);
  scheduleWorklogFlush(entry);
}

// Debounced: once the gesture settles (button released, ~0.45s idle), send the
// accumulated delta to the backend in ONE call, then refresh for server truth +
// re-sort and unfreeze rendering. A 5s hold or a burst of clicks = one round trip.
function scheduleWorklogFlush(entry) {
  if (worklogAdjust.flushTimer) clearTimeout(worklogAdjust.flushTimer);
  worklogAdjust.flushTimer = setTimeout(async () => {
    worklogAdjust.flushTimer = null;
    if (worklogAdjust.holding) { scheduleWorklogFlush(entry); return; } // still pressed - wait
    const delta = Number(entry?._pendingAdjust || 0);
    entry._pendingAdjust = 0;
    if (delta && entry?.key && typeof api.adjustWorklogProject === "function") {
      try { await api.adjustWorklogProject(entry.key, delta); } catch {}
    }
    worklogAdjust.busy = false;
    refreshWorkLoggerList().catch(() => {});
  }, 450);
}

// Wire one +/- button: a plain click steps by 1 min; press-and-hold ramps by
// 10 min every 0.5 s. The display updates instantly on every tick; the list is
// frozen from re-rendering while holding/flushing (see renderWorkLogger) so the
// button can't be detached mid-gesture, and pointer capture keeps events here.
function attachWorklogAdjuster(entry, strongEl, btn, sign) {
  if (!btn || !entry) return;
  let didRepeat = false;
  btn.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopWorklogHold();
    didRepeat = false;
    worklogAdjust.holding = true;
    try { btn.setPointerCapture(event.pointerId); } catch {}
    worklogAdjust.holdTimer = setTimeout(() => {
      worklogAdjust.holdTimer = null;
      didRepeat = true;
      bumpWorklogEntry(entry, strongEl, sign * 10);
      worklogAdjust.repeatTimer = setInterval(() => bumpWorklogEntry(entry, strongEl, sign * 10), 500);
    }, 450);
  });
  btn.addEventListener("pointerup", (event) => {
    event.stopPropagation();
    const wasRepeating = didRepeat;
    stopWorklogHold();
    if (!wasRepeating) bumpWorklogEntry(entry, strongEl, sign * 1);
    didRepeat = false;
  });
}

function createWorklogRow(entry) {
  const row = document.createElement("div");
  row.className = "worklog-row";
  row.role = "listitem";
  row.title = entry.lastDocPath || entry.name || "";
  const name = entry.name || "Unknown project";
  const lastDoc = entry.lastDocPath || "";
  row.innerHTML = `
    <div class="worklog-main">
      <div class="worklog-name">${escapeHtml(name)}</div>
      <div class="worklog-meta">${escapeHtml(lastDoc ? `Last file: ${displayPathOf(lastDoc)}` : "No last file recorded.")}</div>
    </div>
    <div class="worklog-adjust" role="group" aria-label="Adjust logged time">
      <button class="worklog-adjust-btn worklog-adjust-minus" type="button" title="Subtract time (click -1 min, hold for -10 min/0.5s)">&minus;</button>
      <button class="worklog-adjust-btn worklog-adjust-plus" type="button" title="Add time (click +1 min, hold for +10 min/0.5s)">+</button>
    </div>
    <div class="worklog-time">
      <strong>${escapeHtml(formatProjectActivity(entry))}</strong>
      <span>${escapeHtml(formatWorklogDate(entry.lastActiveAt))}</span>
    </div>
    <button class="worklog-delete" type="button" title="Delete only this project's work log">Delete</button>
  `;
  const strongEl = row.querySelector(".worklog-time strong");
  attachWorklogAdjuster(entry, strongEl, row.querySelector(".worklog-adjust-minus"), -1);
  attachWorklogAdjuster(entry, strongEl, row.querySelector(".worklog-adjust-plus"), 1);
  const deleteBtn = row.querySelector(".worklog-delete");
  deleteBtn?.addEventListener("click", async (event) => {
    event.stopPropagation();
    const ok = window.confirm(`Delete work log for ${name}? CAD files and recent documents are not deleted.`);
    if (!ok) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
    try {
      const result = await api.deleteWorklogProject(entry.key);
      if (!result?.ok || !result.deleted) {
        log("Work log was not deleted.", { project: name, result });
      } else {
        log("Deleted project work log.", {
          project: result.name || name,
          minutes: Math.round(Number(result.totalMs || 0) / 60000),
        });
      }
      workLoggerState.lastSignature = `deleted:${Date.now()}`;
      await refreshWorkLoggerList();
    } catch (error) {
      log("Could not delete project work log.", { project: name, error: error.message });
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete";
    }
  });
  return row;
}

function appendWorklogBatch(batchSize = WORKLOG_RENDER_BATCH_SIZE) {
  if (!ui.workLoggerList) return;
  const start = workLoggerState.renderedCount;
  const end = Math.min(workLoggerState.entries.length, start + batchSize);
  if (end <= start) return;
  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    fragment.appendChild(createWorklogRow(workLoggerState.entries[i]));
  }
  ui.workLoggerList.appendChild(fragment);
  workLoggerState.renderedCount = end;
  updateWorkLoggerStateText();
}

function renderWorkLoggerCountingStatus(counter = null) {
  if (!ui.workLoggerCountingStatus) return;
  const status = counter || workLoggerState.counterStatus || {};
  const isCounting = Boolean(status.isCounting);
  let headline = status.headline || (isCounting ? "Counting now" : "Nothing is being counted");
  let message = status.message || (isCounting
    ? "Counting the active SOLIDWORKS document."
    : "Nothing is being counted. Waiting for SOLIDWORKS activity.");
  if (status.code === "counting-unsaved") {
    headline = t("Tracking unsaved document");
    message = t("Time is held provisionally and will be added after this document is saved.");
  } else if (status.code === "unsaved-paused") {
    headline = t("Unsaved document paused");
    message = t("Pending time is preserved, but activity is currently paused.");
  } else if (status.code === "unsaved-waiting") {
    headline = t("Unsaved document waiting");
    message = t("Waiting for a trusted SOLIDWORKS watcher sample before holding time.");
  }
  const meta = [];
  if (status.projectName) meta.push(`Project: ${status.projectName}`);
  if (status.docTitle) meta.push(`Document: ${status.docTitle}`);
  if (status.provisional) {
    meta.push(`${t("Pending")}: ${formatShortDuration(status.pendingUnsavedMs)}`);
    meta.push(`${t("Save threshold")}: ${formatShortDuration(status.promotionMinMs)}`);
  }
  if (!isCounting && status.pauseMinutes) meta.push(`Grace: ${status.pauseMinutes} min`);
  if (status.idleMs != null && !isCounting) {
    const idleText = formatShortDuration(status.idleMs);
    if (idleText) meta.push(`Idle: ${idleText}`);
  }
  if (status.docPath) meta.push(displayPathOf(status.docPath));
  ui.workLoggerCountingStatus.className = `worklog-current-status ${isCounting ? "counting" : "paused"}`;
  ui.workLoggerCountingStatus.innerHTML = `
    <div class="worklog-current-dot" aria-hidden="true"></div>
    <div class="worklog-current-copy">
      <strong>${escapeHtml(headline)}</strong>
      <span>${escapeHtml(message)}</span>
      ${meta.length ? `<small>${escapeHtml(meta.join(" | "))}</small>` : ""}
    </div>
  `;
}

function updateWorkLoggerStateText(result = null) {
  if (!ui.workLoggerState) return;
  if (result?.path) workLoggerState.path = result.path;
  if (result?.activeDate) workLoggerState.activeDate = result.activeDate;
  const entries = workLoggerState.entries || [];
  const dateText = workLoggerState.activeDate ? `${t("Today:")} ${workLoggerState.activeDate}. ` : "";
  if (!entries.length) {
    ui.workLoggerState.textContent = `${dateText}${t("No project work logs yet. Open a SOLIDWORKS document and work with SOLIDWORKS foreground to start counting.")}`;
    return;
  }
  const shown = Math.min(workLoggerState.renderedCount, entries.length);
  const pathText = workLoggerState.path ? `\n${t("Log file:")} ${workLoggerState.path}` : "";
  ui.workLoggerState.textContent = `${dateText}${t("Projects:")} ${entries.length}. ${t("Sorted by last work done.")} ${t("Showing")} ${shown}/${entries.length}.${pathText}`;
}

function maybeLoadMoreWorklogs() {
  if (!ui.workLoggerList || !workLoggerIsActive()) return;
  if (workLoggerState.renderedCount >= workLoggerState.entries.length) return;
  const scroller = recentDocsScrollContainer();
  if (!scroller) return;
  const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  if (remaining < 900) appendWorklogBatch();
}

function renderWorkLogger(projects, result = {}) {
  if (!ui.workLoggerList) return;
  // Never rebuild rows mid +/- gesture (or during its pending flush) - it would
  // detach the held button and wipe the optimistic display.
  if (worklogAdjust.holding || worklogAdjust.busy) return;
  const entries = Array.isArray(projects) ? projects : [];
  if (result.path) workLoggerState.path = result.path;
  if (result.activeDate) workLoggerState.activeDate = result.activeDate;
  if (result.counterStatus) workLoggerState.counterStatus = result.counterStatus;
  renderWorkLoggerCountingStatus(workLoggerState.counterStatus);
  const signature = entries.map((entry) =>
    `${entry.key}|${entry.totalMs}|${entry.overtimeMs || 0}|${entry.lastActiveAt}|${entry.lastDocPath || ""}`
  ).join(";");
  const staleEmptyList = entries.length === 0 && ui.workLoggerList.childElementCount > 0;
  if (signature !== workLoggerState.lastSignature || staleEmptyList) {
    workLoggerState.lastSignature = signature;
    workLoggerState.entries = entries;
    workLoggerState.renderedCount = 0;
    ui.workLoggerList.replaceChildren();
    appendWorklogBatch();
  }
  if (ui.workLoggerState) {
    updateWorkLoggerStateText(result);
  }
  renderAutoExportStatus(result.autoExport);
}

// Reassuring one-liner about the nightly auto-export: last outcome + next run.
function renderAutoExportStatus(ax) {
  if (!ui.workLoggerAutoExport) return;
  const el = ui.workLoggerAutoExport;
  if (!ax || !ax.enabled) {
    el.textContent = "Auto-export: off.";
    el.className = "worklog-autoexport muted";
    return;
  }
  if (ui.worklogAutoExportSkip) ui.worklogAutoExportSkip.checked = Boolean(ax.skippedToday);
  if (ax.skippedToday) {
    el.textContent = "Auto-export is OFF for tonight (skipped). It re-enables automatically tomorrow.";
    el.className = "worklog-autoexport warn";
    return;
  }
  const nextStr = ax.nextRunAt ? new Date(ax.nextRunAt).toLocaleString() : (ax.startLabel || "23:50");
  let head;
  let cls = "worklog-autoexport";
  if (!ax.lastAttemptAt) {
    head = `Auto-export armed for ${ax.startLabel || "23:50"} nightly (retries every min to ${ax.endLabel || "23:58"}). Not run yet.`;
    cls += " pending";
  } else {
    const when = new Date(ax.lastAttemptAt).toLocaleString();
    if (ax.lastOutcome === "success") {
      head = `Auto-export OK ✓ ${when} — ${ax.projectCount || 0} log(s), ${ax.hours || 0} h.`;
      cls += " ok";
    } else if (ax.lastOutcome === "nothing") {
      head = `Auto-export — nothing to export on ${ax.lastDate || when}.`;
      cls += " pending";
    } else if (ax.lastOutcome === "retrying") {
      head = `Auto-export retrying… last error: ${ax.error || "failed"}.`;
      cls += " warn";
    } else if (ax.lastOutcome === "skipped") {
      head = `Auto-export was skipped on ${ax.lastDate || when}.`;
      cls += " pending";
    } else {
      head = `Auto-export FAILED ✗ ${when} — ${ax.error || "unknown error"}.`;
      cls += " warn";
    }
  }
  el.textContent = `${head} Next run: ${nextStr}.`;
  el.className = cls;
}

// Enable/disable the "Export last day" button based on whether a recoverable
// reset backup exists, and cache it for the dialog.
async function refreshLastDayAvailability() {
  if (!ui.exportLastDayWorkLoggerBtn || typeof api.getLastWorklogBackup !== "function") return;
  try {
    const backup = await api.getLastWorklogBackup();
    const available = Boolean(backup?.ok && backup.available && (backup.projects || []).length);
    workLoggerState.lastDayBackup = available ? backup : null;
    ui.exportLastDayWorkLoggerBtn.disabled = !available;
    ui.exportLastDayWorkLoggerBtn.title = available
      ? `Recover and export ${backup.count} project(s) from ${backup.activeDate || "the last reset"}${backup.reason ? ` (${backup.reason})` : ""}`
      : "No reset day is available to recover yet";
  } catch {
    ui.exportLastDayWorkLoggerBtn.disabled = true;
  }
}

async function refreshWorkLoggerList() {
  if (!ui.workLoggerList || typeof api.listWorklogs !== "function") return;
  try {
    const result = await api.listWorklogs();
    if (!result?.ok) return;
    renderWorkLogger(result.projects || [], result);
    refreshLastDayAvailability().catch(() => {});
  } catch (error) {
    if (ui.workLoggerState) ui.workLoggerState.textContent = `Work Logger failed: ${error.message}`;
  }
}

function docSearchStatusText(result) {
  const idx = result?.index || {};
  const scan = idx.scan || {};
  const bits = [];
  if (result?.mode === "latest") bits.push("Newest indexed files.");
  else if (result?.mode === "active-part") bits.push(`Similar files for ${basenameOf(result.seedPath)}.`);
  else if (result?.mode === "type-recent") bits.push(`Newest ${result.fileTypeLabel || "matching"} files.`);
  else if (result?.query) bits.push(result?.matchSource === "path"
    ? `Path search: ${result.query}`
    : `Search: ${result.query}`);
  if (result?.fileTypeLabel && result?.mode !== "type-recent") bits.push(`Type filter: ${result.fileTypeLabel}`);
  if (idx.targetScan?.roots?.length) {
    const limitText = idx.targetScan.limited ? " (limited)" : "";
    const runningText = idx.targetScan.scanning ? " running" : "";
    bits.push(`Target scan${runningText}: ${idx.targetScan.entries?.length || 0} files matched from ${idx.targetScan.dirs || 0} nearby folders${limitText}.`);
  } else if (idx.targetScan?.scanning) {
    bits.push("Target scan running near the active SOLIDWORKS document.");
  }
  if (idx.scanning) bits.push(`Indexing ${scan.mode || ""}: ${scan.entries || 0} files, ${scan.directoriesScanned || 0} folders scanned.`);
  else if (idx.count != null) bits.push(`Indexed ${idx.count} files.`);
  if (result?.pageSize) bits.push(`Showing page ${(result.page || 0) + 1}; ${result.entries?.length || 0}/${result.pageSize} loaded${result.hasMore ? ", more available" : ""}.`);
  if (idx.cacheRoot) bits.push(`Cache: ${idx.cacheRoot}`);
  return bits.filter(Boolean).join("\n");
}

function setDocSearchPager(result, loading = false) {
  if (!ui.docSearchPager || !ui.docSearchPrevPageBtn || !ui.docSearchNextPageBtn) return;
  const page = Math.max(0, Number(result?.page || 0) || 0);
  const hasPrevious = page > 0;
  const hasMore = !!result?.hasMore;
  ui.docSearchPager.classList.toggle("hidden", !hasPrevious && !hasMore);
  ui.docSearchPrevPageBtn.disabled = loading || !hasPrevious;
  ui.docSearchNextPageBtn.disabled = loading || !hasMore;
  ui.docSearchPrevPageBtn.textContent = loading ? "Loading..." : "Previous page";
  ui.docSearchNextPageBtn.textContent = loading ? "Loading..." : "Next page";
}

function clearDocSearchTiles(message = "Loading...") {
  state.docSearchLastSignature = "";
  state.docSearchPage = 0;
  state.docSearchHasMore = false;
  if (ui.docSearchList) ui.docSearchList.replaceChildren();
  if (ui.docSearchState) ui.docSearchState.textContent = message;
  setDocSearchPager(null);
}

function renderDocSearchResults(result) {
  if (!ui.docSearchList) return;
  const entries = result?.entries || [];
  const signature = `${result?.page || 0}|${result?.query || ""}|${result?.seedPath || ""}|${result?.fileType || ""}|${result?.mode || ""}|${result?.index?.count || 0}|${result?.index?.scanning ? 1 : 0}|` + entries.map((entry) =>
    `${entry.path}|${entry.thumbnail || ""}|${entry.score || ""}`
  ).join(";");
  if (signature === state.docSearchLastSignature) {
    if (ui.docSearchState) ui.docSearchState.textContent = docSearchStatusText(result);
    setDocSearchPager(result);
    return;
  }
  state.docSearchLastSignature = signature;
  if (ui.docSearchState) ui.docSearchState.textContent = docSearchStatusText(result);

  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "recent-docs-tile";
    tile.dataset.path = entry.path;
    const fileType = fileTypeForPath(entry.path);
    const filename = entry.name || basenameOf(entry.path);
    const fullPath = entry.displayPath || displayPathOf(entry.path);
    const thumbHtml = entry.thumbnail
      ? `<img class="recent-docs-tile-image" src="${escapeAttr(entry.thumbnail)}" alt="" loading="lazy">`
      : `<div class="recent-docs-tile-thumb type-${fileType.key}">${escapeHtml(fileType.label)}</div>`;
    tile.title = fullPath;
    tile.innerHTML = `
      <div class="document-thumb-wrap">
        ${thumbHtml}
        <span class="document-type-badge type-${escapeAttr(fileType.key)}">${escapeHtml(fileType.label)}</span>
      </div>
      <div class="recent-docs-tile-name">${escapeHtml(filename)}</div>
      <div class="recent-docs-tile-path" title="${escapeAttr(fullPath)}">${escapeHtml(fullPath)}</div>
    `;
    tile.addEventListener("click", () => {
      api.openDocSearchResult(entry.path).then((r) => {
        if (!r?.ok) log("Failed to open document-search result.", r);
      }).catch((error) => log("Failed to open document-search result.", { error: error.message, path: entry.path }));
    });
    tile.addEventListener("contextmenu", (event) => showDocSearchContextMenu(event, entry));
    fragment.appendChild(tile);
  }
  ui.docSearchList.replaceChildren(fragment);
  state.docSearchPage = result?.page || 0;
  state.docSearchHasMore = !!result?.hasMore;
  setDocSearchPager(result);
}

function scheduleDocSearchRefresh(delay = 250, options = {}) {
  if (state.docSearchPollTimer) clearTimeout(state.docSearchPollTimer);
  if (document.hidden || !document.getElementById("docSearchView")?.classList.contains("active")) {
    state.docSearchPollTimer = null;
    return;
  }
  state.docSearchPollTimer = setTimeout(() => {
    state.docSearchPollTimer = null;
    if (document.hidden || !document.getElementById("docSearchView")?.classList.contains("active")) return;
    refreshDocSearch(options).catch(() => {});
  }, delay);
}

async function refreshDocSearch(options = {}) {
  if (!ui.docSearchList) return;
  if (document.hidden || !document.getElementById("docSearchView")?.classList.contains("active")) return;
  const query = ui.docSearchInput?.value?.trim() || "";
  const fileType = ui.docSearchTypeFilter?.value || "all";
  const useActiveSeed = !query && fileType === "all";
  let seedPath = useActiveSeed ? activeSolidWorksSeedPath() : "";
  const page = Math.max(0, Number(options.page || 0) || 0);
  const requestKey = `${query}|${fileType}|${seedPath}|${page}`;
  const requestSeq = ++state.docSearchRequestSeq;
  state.docSearchInFlight = true;
  setDocSearchPager({ page, hasMore: state.docSearchHasMore }, true);
  try {
    if (useActiveSeed && !seedPath) {
      const status = await api.solidWorksStatus();
      if (requestSeq !== state.docSearchRequestSeq) return;
      setStatus(status);
      seedPath = activeSolidWorksSeedPath();
    }
    const result = await api.docSearch({
      query,
      seedPath,
      fileType,
      page,
      pageSize: 40,
    });
    if (requestSeq !== state.docSearchRequestSeq) return;
    if (!result?.ok) {
      if (ui.docSearchState) ui.docSearchState.textContent = result?.error || "Doc Search failed.";
      return;
    }
    state.docSearchLastKey = requestKey;
    renderDocSearchResults(result);
    if (result.index?.scanning || result.index?.targetScan?.scanning) {
      scheduleDocSearchRefresh(2500, { page });
    }
  } catch (error) {
    if (requestSeq === state.docSearchRequestSeq && ui.docSearchState) ui.docSearchState.textContent = `Doc Search failed: ${error.message}`;
  } finally {
    if (requestSeq === state.docSearchRequestSeq) {
      state.docSearchInFlight = false;
      setDocSearchPager({ page: state.docSearchPage, hasMore: state.docSearchHasMore }, false);
    }
  }
}

function escapeAttr(value) {
  return String(value).replace(/["&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

async function killSolidWorks() {
  if (!ui.killSolidWorksBtn) return;
  if (!state.lastSolidWorksHealth?.canKill) {
    log("Kill SW is disabled because SOLIDWORKS is not marked unhealthy.", state.lastSolidWorksHealth || {});
    refreshSolidWorksStatus().catch(() => {});
    return;
  }
  const confirmed = window.confirm("Kill all SLDWORKS.exe processes for the unhealthy session? Unsaved SOLIDWORKS work may be lost.");
  if (!confirmed) return;
  state.killSolidWorksInFlight = true;
  ui.killSolidWorksBtn.disabled = true;
  const originalLabel = ui.killSolidWorksBtn.textContent;
  ui.killSolidWorksBtn.textContent = "Killing...";
  try {
    const result = await api.killSolidWorks();
    if (result && result.ok) {
      const total = Number(result.totalInstances ?? result.orphansFound ?? 0) || 0;
      const killed = result.killed?.length || 0;
      if (total === 0) {
        log("No SLDWORKS.exe processes found to kill.", result);
      } else {
        log(`Killed ${killed}/${total} SLDWORKS.exe processes.`, result);
        for (const killedProcess of result.killed || []) {
          log(`  SLDWORKS PID ${killedProcess.id} killed`, {
            reason: killedProcess.reason,
            startTime: killedProcess.startTime,
            parentPid: killedProcess.parentProcessId,
            parentName: killedProcess.parentProcessName,
            parentPath: killedProcess.parentProcessPath,
            commandLine: killedProcess.commandLine,
            workingSetMb: killedProcess.workingSetMb,
          });
        }
        for (const failure of result.failed || []) {
          log(`  SLDWORKS PID ${failure.id} could NOT be killed: ${failure.error}`, failure.hint);
        }
      }
    } else {
      log("Kill SW failed.", result);
    }
  } catch (error) {
    log("Kill SW failed.", { error: error.message });
  } finally {
    state.killSolidWorksInFlight = false;
    ui.killSolidWorksBtn.textContent = originalLabel;
    await refreshSolidWorksStatus().catch(() => {});
    updateSolidWorksKillButton(state.lastSolidWorksHealth);
  }
}

async function createCamFolder() {
  ui.createCamFolderBtn.disabled = true;
  ui.createCamFolderBtn.textContent = "Creating...";
  try {
    const result = await api.createCamFolder();
    if (result.ok) {
      log(result.createdPartFolder ? "CAM folder created." : "CAM folder already exists.", {
        sourcePath: result.sourcePath,
        camPartFolder: result.camPartFolder,
        copiedToClipboard: result.copiedToClipboard,
        projectName: result.projectName,
        partFolderName: result.partFolderName,
      });
    } else {
      log("CAM folder creation failed.", result);
    }
    await refreshSolidWorksStatus();
  } catch (error) {
    log("CAM folder creation failed.", { error: error.message });
  } finally {
    ui.createCamFolderBtn.disabled = false;
    ui.createCamFolderBtn.textContent = "Create CAM Folder";
  }
}

// --- UI localization (en/hu) ------------------------------------------------
// Static-UI translation table keyed by the English text. applyUiLanguage swaps
// the text of leaf elements (and placeholders/titles) that have an entry, and
// can revert to English. Dynamic status text is localized separately.
const I18N_HU = {
  // Runtime status, accessibility, and settings strings.
  "Add to recent (as opened)": "Hozzáadás a legutóbbiakhoz (megnyitottként)",
  "Open folder": "Mappa megnyitása",
  "Copy path": "Elérési út másolása",
  "Copy document name": "Dokumentumnév másolása",
  "Delete + retry thumbnail": "Bélyegkép törlése és újrapróbálása",
  "SW render retry": "SW renderelés újrapróbálása",
  "Delete from recent": "Törlés a legutóbbiakból",
  "Not checked": "Nincs ellen\u0151rizve",
  "Busy": "Foglalt",
  "Selected:": "Kiv\u00e1lasztva:",
  "(no title)": "(nincs c\u00edm)",
  "Started": "Elind\u00edtva",
  "Connected": "Kapcsol\u00f3dva",
  "Disconnected": "Nincs kapcsolat",
  "No active document loaded.": "Nincs bet\u00f6ltve akt\u00edv dokumentum.",
  "Connected, but no foreground SOLIDWORKS document was found.": "Kapcsol\u00f3dva, de nem tal\u00e1lhat\u00f3 el\u0151t\u00e9rben l\u00e9v\u0151 SOLIDWORKS dokumentum.",
  "SOLIDWORKS busy. Last seen:": "A SOLIDWORKS foglalt. Utolj\u00e1ra l\u00e1tva:",
  "SW health: checking...": "SW \u00e1llapot: ellen\u0151rz\u00e9s...",
  "SW health: healthy": "SW \u00e1llapot: rendben",
  "SW health: unhealthy": "SW \u00e1llapot: hib\u00e1s",
  "SW health: loading": "SW \u00e1llapot: bet\u00f6lt\u00e9s",
  "SW health: not running": "SW \u00e1llapot: nem fut",
  "SW health: stopped": "SW \u00e1llapot: le\u00e1ll\u00edtva",
  "SW health: busy": "SW \u00e1llapot: foglalt",
  "Auto-export status loading...": "Automatikus export \u00e1llapot\u00e1nak bet\u00f6lt\u00e9se...",
  "SolidCAM: checking": "SolidCAM: ellen\u0151rz\u00e9s",
  "SolidCAM: not selected": "SolidCAM: nincs kiv\u00e1lasztva",
  "SolidCAM: status error": "SolidCAM: \u00e1llapothiba",
  "SolidCAM: loaded": "SolidCAM: bet\u00f6ltve",
  "SolidCAM: not loaded": "SolidCAM: nincs bet\u00f6ltve",
  "SolidCAM: SW not running": "SolidCAM: a SW nem fut",
  "SolidCAM: unknown": "SolidCAM: ismeretlen",
  "No SOLIDWORKS macros found in the macro folder.": "Nem tal\u00e1lhat\u00f3 SOLIDWORKS makr\u00f3 a makr\u00f3mapp\u00e1ban.",
  "No project work logs yet. Open a SOLIDWORKS document and work with SOLIDWORKS foreground to start counting.":
    "M\u00e9g nincs projekt-munkanapl\u00f3. Nyiss meg egy SOLIDWORKS dokumentumot, majd dolgozz vele el\u0151t\u00e9rben a sz\u00e1mol\u00e1s elind\u00edt\u00e1s\u00e1hoz.",
  "Today:": "Ma:",
  "Projects:": "Projektek:",
  "Sorted by last work done.": "Az utols\u00f3 munkav\u00e9gz\u00e9s szerint rendezve.",
  "Showing": "Megjelen\u00edtve",
  "Log file:": "Napl\u00f3f\u00e1jl:",
  "Project locations": "Projekt-helyek",
  "How projects are recognized \u2014 change these to run Excelsis Helper at another shop":
    "A projektek felismer\u00e9s\u00e9nek szab\u00e1lyai; m\u00f3dos\u00edtsd ezeket, ha az Excelsis Helpert m\u00e1sik c\u00e9gn\u00e9l haszn\u00e1lod",
  "Project root folder names (one per line)": "Projektgy\u00f6k\u00e9r-mapp\u00e1k nevei (soronk\u00e9nt egy)",
  "Click Search to enumerate SolidCAM add-ins registered with SOLIDWORKS.":
    "Kattints a Keres\u00e9s gombra a SOLIDWORKS-ben regisztr\u00e1lt SolidCAM b\u0151v\u00edtm\u00e9nyek list\u00e1z\u00e1s\u00e1hoz.",
  "Settings loaded.": "Be\u00e1ll\u00edt\u00e1sok bet\u00f6ltve.",
  "Settings saved.": "Be\u00e1ll\u00edt\u00e1sok mentve.",
  "Settings imported.": "Be\u00e1ll\u00edt\u00e1sok import\u00e1lva.",
  "Settings reset to defaults.": "Be\u00e1ll\u00edt\u00e1sok vissza\u00e1ll\u00edtva az alap\u00e9rt\u00e9kekre.",
  "Settings group reset:": "Be\u00e1ll\u00edt\u00e1scsoport vissza\u00e1ll\u00edtva:",
  "Settings file:": "Be\u00e1ll\u00edt\u00e1sf\u00e1jl:",
  "Settings exported.": "Be\u00e1ll\u00edt\u00e1sok export\u00e1lva.",
  "Settings load failed:": "A be\u00e1ll\u00edt\u00e1sok bet\u00f6lt\u00e9se nem siker\u00fclt:",
  "Settings save failed:": "A be\u00e1ll\u00edt\u00e1sok ment\u00e9se nem siker\u00fclt:",
  "Settings import canceled.": "A be\u00e1ll\u00edt\u00e1sok import\u00e1l\u00e1sa megszak\u00edtva.",
  "Settings import failed:": "A be\u00e1ll\u00edt\u00e1sok import\u00e1l\u00e1sa nem siker\u00fclt:",
  "Settings export canceled.": "A be\u00e1ll\u00edt\u00e1sok export\u00e1l\u00e1sa megszak\u00edtva.",
  "Settings export failed:": "A be\u00e1ll\u00edt\u00e1sok export\u00e1l\u00e1sa nem siker\u00fclt:",
  "Settings group reset failed:": "A be\u00e1ll\u00edt\u00e1scsoport vissza\u00e1ll\u00edt\u00e1sa nem siker\u00fclt:",
  "Settings reset failed:": "A be\u00e1ll\u00edt\u00e1sok vissza\u00e1ll\u00edt\u00e1sa nem siker\u00fclt:",
  "Cache size check failed:": "A gyors\u00edt\u00f3t\u00e1r m\u00e9ret\u00e9nek ellen\u0151rz\u00e9se nem siker\u00fclt:",
  "File:": "F\u00e1jl:",
  "Total cache:": "Teljes gyors\u00edt\u00f3t\u00e1r:",
  "Doc Search:": "Dokumentumkeres\u00e9s:",
  "indexed files; updated": "indexelt f\u00e1jl; friss\u00edtve",
  "Recent thumbnails:": "Legut\u00f3bbi b\u00e9lyegk\u00e9pek:",
  "files": "f\u00e1jl",
  "Background workers:": "H\u00e1tt\u00e9rfolyamatok:",
  "active;": "akt\u00edv;",
  "queued": "v\u00e1rakozik",
  "Doc Search path:": "Dokumentumkeres\u00e9s helye:",
  "never": "soha",
  // Header + sidebar
  "SOLIDWORKS workflow helper": "SOLIDWORKS munkafolyamat-segéd",
  "Copy Doc Location": "Dok. hely másolása",
  "Kill SW": "SW leállítása",
  "Recent SW Docs": "Legutóbbi SW dok.",
  "Macro Runner": "Makró futtató",
  "Doc Search": "Dokumentumkeresés",
  "Work Logger": "Munkaidő-napló",
  // G-code checker
  "G-code Check": "G-kód ellenőrzés",
  "Open Checks Folder": "Ellenőrzések mappája",
  "Newest .MPF programs from the CNC drive.": "A legújabb .MPF programok a CNC meghajtóról.",
  "Analyze program": "Program elemzése",
  "Material": "Anyag",
  "Tool material override (optional)": "Szersz\u00e1manyag fel\u00fclb\u00edr\u00e1l\u00e1sa (opcion\u00e1lis)",
  "Default milling tool material": "Mar\u00f3szersz\u00e1m alap\u00e9rtelmezett anyaga",
  "Default drill/tap material": "F\u00far\u00f3/menetf\u00far\u00f3 alap\u00e9rtelmezett anyaga",
  "Remembered tool material overrides (one per line)": "Megjegyzett szersz\u00e1manyag-fel\u00fclb\u00edr\u00e1l\u00e1sok (soronk\u00e9nt egy)",
  "Open file location": "F\u00e1jl hely\u00e9nek megnyit\u00e1sa",
  "Milling": "Mar\u00e1s",
  "drills": "f\u00far\u00f3k",
  "Tool type": "Szerszámtípus",
  "Analyze + Create AI Prompt": "Elemzés + AI prompt készítése",
  "Select different MPF": "Másik MPF választása",
  "Recent checks": "Legutóbbi ellenőrzések",
  "Last 10 generated prompts - click one to open it": "Az utolsó 10 generált prompt - kattints rá a megnyitáshoz",
  "G-code Checker": "G-kód ellenőrző",
  "MPF search root": "MPF keresési gyökér",
  "Remembered materials (one per line)": "Megjegyzett anyagok (soronként egy)",
  "Remembered tool types (one per line)": "Megjegyzett szerszámtípusok (soronként egy)",
  "Recent .MPF scan root and the remembered analyze inputs": "MPF keresési hely és a megjegyzett elemzési adatok",
  // G-code checker dynamic statuses (used via t(), not the DOM sweep)
  "Scanning for recent .MPF programs...": "Friss .MPF programok keresése...",
  "Refreshing list...": "Lista frissítése...",
  "No .MPF files found yet. Check the search root in Settings.": "Még nincs .MPF fájl. Ellenőrizd a keresési gyökeret a Beállításokban.",
  "newest .MPF under": "legújabb .MPF itt:",
  "(scan budget hit - deep folders may be missing)": "(keresési korlát elérve - mély mappák hiányozhatnak)",
  "Scan failed:": "A keresés nem sikerült:",
  "Select a .MPF file from the list first.": "Először válassz egy .MPF fájlt a listából.",
  "Analyzing program...": "Program elemzése...",
  "Analyze failed:": "Az elemzés nem sikerült:",
  "tool(s) found.": "szerszám található a programban.",
  "Give the saved prompt file to an AI for recommendations.": "Add oda a mentett prompt fájlt egy AI-nak a javaslatokért.",
  "Prompt saved:": "Prompt mentve:",
  "No checks generated yet.": "Még nem készült ellenőrzés.",
  "Settings": "Beállítások",
  "Start CAM": "CAM indítása",
  "CAM Reload": "CAM újratöltés",
  "Stop CAM": "CAM leállítása",
  "Create CAM Folder": "CAM mappa létrehozása",
  // Common buttons
  "Refresh": "Frissítés",
  "Export": "Exportálás",
  "Cancel": "Mégse",
  "Close": "Bezárás",
  "Set": "Beállítás",
  "Reset": "Visszaállítás",
  "Clear": "Törlés",
  "All": "Mind",
  "Type:": "Típus:",
  "Filter:": "Szűrő:",
  // Macro view
  "Open Macro Folder": "Makró mappa megnyitása",
  // Doc Search
  "Parts": "Alkatrészek",
  "Assemblies": "Összeállítások",
  "Drawings": "Rajzok",
  "Open a SOLIDWORKS document or type a search.": "Nyiss meg egy SOLIDWORKS dokumentumot, vagy írj be keresést.",
  "Previous page": "Előző oldal",
  "Next page": "Következő oldal",
  // Work Logger
  "Export last day": "Előző nap exportálása",
  "Reset Today": "Mai nap nullázása",
  "Waiting for SOLIDWORKS activity status.": "Várakozás a SOLIDWORKS aktivitási állapotra.",
  "Project time is counted while SOLIDWORKS is active, using the Settings grace period.":
    "A projektidő számolása a SOLIDWORKS aktív állapotában történik, a Beállítások türelmi idejét használva.",
  "Tracking unsaved document": "Nem mentett dokumentum követése",
  "Unsaved document paused": "A nem mentett dokumentum követése szünetel",
  "Unsaved document waiting": "A nem mentett dokumentum várakozik",
  "Time is held provisionally and will be added after this document is saved.":
    "Az idő ideiglenesen gyűlik, és a dokumentum mentése után kerül hozzáadásra.",
  "Pending time is preserved, but activity is currently paused.":
    "A függő idő megmarad, de az aktivitás követése jelenleg szünetel.",
  "Waiting for a trusted SOLIDWORKS watcher sample before holding time.":
    "Várakozás megbízható SOLIDWORKS figyelőmintára az idő gyűjtése előtt.",
  "Pending": "Függő",
  "Save threshold": "Mentési küszöb",
  "Skip tonight": "Ma este kihagyása",
  // Export dialog
  "Export Work Logs": "Munkaidő-naplók exportálása",
  "Cutoff minutes": "Levágási percek",
  "Multiplier": "Szorzó",
  "Round to nearest": "Kerekítés a legközelebbire",
  "Half hour": "Fél óra",
  "Whole hour": "Egész óra",
  "Quarter hour": "Negyed óra",
  "10 minutes": "10 perc",
  "5 minutes": "5 perc",
  "Target hours mode": "Cél óra mód",
  "Target hours": "Cél órák",
  "Fills the target across projects in 0.5 h blocks; the cutoff still applies. Overrides multiplier and rounding.":
    "A cél órákat 0,5 órás blokkokban osztja szét a projektek között; a levágás továbbra is érvényes. Felülírja a szorzót és a kerekítést.",
  "Default worktype": "Alapértelmezett munkatípus",
  "Second worktype": "Második munkatípus",
  "Per project": "Projektenként",
  "Split into 2 work logs": "Felosztás 2 naplóra",
  // Recent docs
  "Show all": "\u00d6sszes mutat\u00e1sa",
  "Enable background diagnostics": "H\u00e1tt\u00e9r-diagnosztika bekapcsol\u00e1sa",
  "Recent SOLIDWORKS Documents": "Legutóbbi SOLIDWORKS dokumentumok",
  "Retry Missing Thumbnails": "Hiányzó bélyegképek újra",
  "Newest first. Documents opened in SOLIDWORKS while Excelsis is running.":
    "Legújabb elöl. A SOLIDWORKS-ben megnyitott dokumentumok, amíg az Excelsis fut.",
  // Settings
  "Import": "Importálás",
  "Reset Defaults": "Alapértékek visszaállítása",
  "Save Settings": "Beállítások mentése",
  "Language": "Nyelv",
  "Defaults: app and BOM Excel English": "Alapértékek: a felület és a BOM Excel angol",
  "UI language": "Felület nyelve",
  "BOM Excel language": "BOM Excel nyelve",
  "English": "Angol",
  "Hungarian": "Magyar",
  "Hotkeys": "Gyorsbillentyűk",
  "Active while Excelsis Helper is running": "Aktív, amíg az Excelsis Helper fut",
  "Enable helper hotkeys": "Segéd gyorsbillentyűk bekapcsolása",
  "Paste project/date text": "Projekt/dátum szöveg beillesztése",
  "Copy Explorer selection path": "Explorer kijelölés útvonalának másolása",
  "Pasted text template": "Beillesztett szöveg sablon",
  "SOLIDWORKS Activity": "SOLIDWORKS aktivitás",
  "Default pauses after 3 minutes away from SOLIDWORKS": "Alapból 3 perc SOLIDWORKS-távollét után szünetel",
  "Defaults: 3 min idle pause, 4 s new-document cutoff": "Alapértékek: 3 perc tétlenségi szünet, 4 mp új dokumentum határidő",
  "Pause automatic SW/project counting after": "Automatikus SW/projekt számolás szüneteltetése ennyi után",
  "Recent SW new-document cutoff (seconds)": "Legutóbbi SW új dokumentum határidő (másodperc)",
  "Recent SOLIDWORKS activity and project time are only refreshed while SOLIDWORKS is foreground, or during this short grace period after leaving it. If Windows input is idle past this value, counting pauses too.":
    "A legutóbbi SOLIDWORKS aktivitás és a projektidő csak akkor frissül, amíg a SOLIDWORKS előtérben van, vagy az utána következő rövid türelmi idő alatt. Ha a Windows bevitel ennél tovább tétlen, a számolás is szünetel.",
  "ERP Worklog Export": "ERP munkaidő-export",
  "Where Work Logger exports drop files and read work types (per shop / drive)":
    "Hova írja a Munkaidő-napló az exportot, és honnan olvassa a munkatípusokat (cégenként / meghajtónként)",
  "Worklog drop folder (inbox)": "Munkaidő-napló célmappa (bejövő)",
  "Work types file": "Munkatípusok fájl",
  "ERP worklog user name": "ERP munkaidő-felhasználónév",
  "Your ERP display name": "Az ERP-ben látható neved",
  "Overtime starts at": "Túlóra kezdete",
  "Min. minutes per doc to list in export": "Min. perc dokumentumonként az exportban",
  "Work Logger exports write JSON into the inbox folder for the ERP to import, and read the valid work types from the work types file. Both paths and the ERP user name are required. Tracked time at or after the local overtime start is exported separately with the overtime flag. A document only appears in an export line's description once it has been worked on for at least this many minutes (0 = list every document worked on).":
    "A Munkaidő-napló JSON-t exportál az ERP bejövő mappájába, és a munkatípus-fájlból olvassa az érvényes munkatípusokat. Mindkét útvonal és az ERP felhasználónév kötelező. A helyi túlóra-kezdettől mért idő külön, túlóraként kerül exportálásra. Egy dokumentum csak akkor jelenik meg a leírásban, ha legalább ennyi percet dolgoztak rajta (0 = minden dokumentum).",
  "Work Logger exports write JSON into the inbox folder for the ERP to import, and read the valid work types from the work types file. Both paths are required. A document only appears in an export line's description once it has been worked on for at least this many minutes (0 = list every document worked on).":
    "A Munkaidő-napló exportja JSON-t ír a bejövő mappába az ERP importjához, és a munkatípus-fájlból olvassa az érvényes munkatípusokat. Mindkét útvonal kötelező. Egy dokumentum csak akkor jelenik meg egy export sor leírásában, ha legalább ennyi percet dolgoztak rajta (0 = minden dokumentum listázása).",
  "CAM Folder": "CAM mappa",
  "Destination and source locations are configurable per shop": "A cél- és forráshelyek cégenként beállíthatók",
  "CAM destination root": "CAM célmappa gyökér",
  "Created folder structure": "Létrehozott mappaszerkezet",
  "Project folder + part folder": "Projekt mappa + alkatrész mappa",
  "Project folder + source subfolders + part folder": "Projekt mappa + forrás almappák + alkatrész mappa",
  "CAM source folders (Create CAM folder lookup)": "CAM forrásmappák (CAM mappa létrehozása kereséshez)",
  "Search locations": "Keresési helyek",
  "Which drives/folders the document search crawls, and what to skip":
    "Mely meghajtókat és mappákat járja be a dokumentumkeresés, és mit hagyjon ki",
  "Search locations (one drive or folder per line)": "Keresési helyek (soronként egy meghajtó vagy mappa)",
  "Excluded locations (one drive or folder per line)": "Kizárt helyek (soronként egy meghajtó vagy mappa)",
  "Project code prefixes (optional; e.g. PRJ, JOB)": "Projektkód-előtagok (opcionális; pl. PRJ, JOB)",
  "Macro defaults": "Makró alapértékek",
  "Values synchronized into the bundled CNCDXF and DXF macros": "A csomagolt CNCDXF és DXF makrókba szinkronizált értékek",
  "Drawing template path": "Rajzsablon útvonala",
  "DXF filename prefix": "DXF fájlnév előtag",
  "Default DXF material": "Alapértelmezett DXF anyag",
  "CNCDXF uses the CAM destination root and project-code prefixes configured above.":
    "A CNCDXF a fent beállított CAM célgyökeret és projektkód-előtagokat használja.",
  "Pick which SolidCAM build the sidebar Start/Stop CAM buttons toggle":
    "Válaszd ki, melyik SolidCAM build-et kapcsolják az oldalsáv Start/Stop CAM gombjai",
  "Search for SolidCAM Add-ins": "SolidCAM bővítmények keresése",
  "Searches HKLM/HKCU for SOLIDWORKS add-ins matching \"solidcam\".":
    "A HKLM/HKCU kulcsokban keres \"solidcam\" nevű SOLIDWORKS bővítményeket.",
  "No SolidCAM add-in selected.": "Nincs kiválasztott SolidCAM bővítmény.",
  "Doc Search Index": "Dokumentumkeresési index",
  "Cache lives beside the Automation app and can be rebuilt safely":
    "A gyorsítótár az alkalmazás mellett van, és biztonságosan újraépíthető",
  "Delete Index Cache": "Indexgyorsítótár törlése",
  "Deletes only Excelsis Helper's own document-search cache, never source files.":
    "Csak az Excelsis Helper saját dokumentumkeresési gyorsítótárát törli, a forrásfájlokat soha.",
  "Cache size not checked yet.": "A gyorsítótár mérete még nincs ellenőrizve.",
  "Settings not loaded yet.": "A beállítások még nincsenek betöltve.",
  "Log": "Napló",
  // Local G-code method
  "AI prompt": "AI prompt",
  "Local method": "Helyi m\u00f3dszer",
  "Material group": "Anyagcsoport",
  "Choose material group": "V\u00e1lassz anyagcsoportot",
  "Steel": "Ac\u00e9l",
  "Aluminium": "Alum\u00ednium",
  "Copper and copper alloys": "R\u00e9z \u00e9s r\u00e9z\u00f6tv\u00f6zetek",
  "Plastic": "M\u0171anyag",
  "Exact material / grade (optional)": "Pontos anyag / min\u0151s\u00e9g (opcion\u00e1lis)",
  "Hardness (optional)": "Kem\u00e9nys\u00e9g (opcion\u00e1lis)",
  "Machine maximum RPM": "G\u00e9p maxim\u00e1lis fordulatsz\u00e1ma",
  "Aggressiveness": "Terhel\u00e9si szint",
  "Conservative": "Konzervat\u00edv",
  "Balanced": "Kiegyens\u00falyozott",
  "Slightly aggressive": "Enyh\u00e9n agressz\u00edv",
  "Radial engagement ae (%)": "Radi\u00e1lis fog\u00e1s ae (%)",
  "Cooling": "H\u0171t\u00e9s",
  "Dry": "Sz\u00e1raz",
  "Air": "Leveg\u0151",
  "Mist": "K\u00f6dken\u00e9s",
  "Air + MQL": "Leveg\u0151 + MQL",
  "Flood": "B\u0151s\u00e9ges h\u0171t\u00e9s",
  "Through-tool": "Szersz\u00e1mon kereszt\u00fcl",
  "Contact mode": "Kapcsol\u00f3d\u00e1si m\u00f3d",
  "Side milling": "Oldalmar\u00e1s",
  "Floor / tip": "Fen\u00e9k / cs\u00facs",
  "Wall / side": "Fal / oldal",
  "Mixed 3D": "Vegyes 3D",
  "Unknown": "Ismeretlen",
  "Other": "Egy\u00e9b",
  "Default flute / edge count": "Alap\u00e9rtelmezett \u00e9lsz\u00e1m",
  "Calculate local proposal": "Helyi javaslat sz\u00e1m\u00edt\u00e1sa",
  "Copy suffix": "M\u00e1solat ut\u00f3tagja",
  "Recalculate": "\u00dajrasz\u00e1m\u00edt\u00e1s",
  "Update estimate": "Becsl\u00e9s friss\u00edt\u00e9se",
  "Create optimized copy": "Optimaliz\u00e1lt m\u00e1solat l\u00e9trehoz\u00e1sa",
  "Default drill tool material": "F\u00far\u00f3 alap\u00e9rtelmezett anyaga",
  "Default tap tool material": "Menetf\u00far\u00f3 alap\u00e9rtelmezett anyaga",
  "Machine maximum feed (mm/min)": "G\u00e9p maxim\u00e1lis el\u0151tol\u00e1sa (mm/min)",
  "Default aggressiveness": "Alap\u00e9rtelmezett terhel\u00e9si szint",
  "Default ae (%)": "Alap\u00e9rtelmezett ae (%)",
  "Default cooling": "Alap\u00e9rtelmezett h\u0171t\u00e9s",
  "Default contact mode": "Alap\u00e9rtelmezett kapcsol\u00f3d\u00e1si m\u00f3d",
  "Optimized copy suffix": "Optimaliz\u00e1lt m\u00e1solat ut\u00f3tagja",
  "Choose a material group.": "V\u00e1lassz anyagcsoportot.",
  "Calculating local proposal...": "Helyi javaslat sz\u00e1m\u00edt\u00e1sa...",
  "tool(s) need operator input.": "szersz\u00e1m kezel\u0151i adatot ig\u00e9nyel.",
  "accepted change group(s).": "elfogadott m\u00f3dos\u00edt\u00e1si csoport.",
  "Update failed:": "A friss\u00edt\u00e9s nem siker\u00fclt:",
  "Estimate updated.": "A becsl\u00e9s friss\u00fclt.",
  "Verifying proposed changes...": "Javasolt m\u00f3dos\u00edt\u00e1sok ellen\u0151rz\u00e9se...",
  "Copy failed:": "A m\u00e1sol\u00e1s nem siker\u00fclt:",
  "Copy canceled.": "A m\u00e1sol\u00e1s megszak\u00edtva.",
  "Optimized copy created:": "Optimaliz\u00e1lt m\u00e1solat elk\u00e9sz\u00fclt:",
  "Estimated time": "Becs\u00fclt id\u0151",
  "Change": "V\u00e1ltoz\u00e1s",
  "Accepted edits": "Elfogadott m\u00f3dos\u00edt\u00e1sok",
  "Required": "K\u00f6telez\u0151",
  "Current program": "Jelenlegi program",
  "Calculated target": "Sz\u00e1m\u00edtott c\u00e9l\u00e9rt\u00e9k",
  "Tool material": "Szersz\u00e1manyag",
  "Diameter (mm)": "\u00c1tm\u00e9r\u0151 (mm)",
  "Flute / edge count": "\u00c9lsz\u00e1m",
  "Axial depth ap (mm)": "Axi\u00e1lis fog\u00e1s ap (mm)",
  "MPF Z-level estimate": "MPF Z-szint becsl\u00e9s",
  "MPF entry-motion estimate": "MPF bel\u00e9p\u00e9si mozg\u00e1s becsl\u00e9s",
  "Operator value": "Kezel\u0151i \u00e9rt\u00e9k",
  "High confidence": "Magas megb\u00edzhat\u00f3s\u00e1g",
  "Medium confidence": "K\u00f6zepes megb\u00edzhat\u00f3s\u00e1g",
  "Low confidence - verify": "Alacsony megb\u00edzhat\u00f3s\u00e1g - ellen\u0151rizd",
  "samples": "minta",
  "Inputs changed. Recalculate before creating the copy.": "Az adatok megv\u00e1ltoztak. A m\u00e1solat l\u00e9trehoz\u00e1sa el\u0151tt sz\u00e1m\u00edtsd \u00fajra.",
  "Feature depth (mm)": "Alakzatm\u00e9lys\u00e9g (mm)",
  "Hole depth (mm)": "Furatm\u00e9lys\u00e9g (mm)",
  "Thread depth (mm)": "Menetm\u00e9lys\u00e9g (mm)",
  "Pitch (mm)": "Menetemelked\u00e9s (mm)",
  "Detected pitch (mm)": "Felismert menetemelked\u00e9s (mm)",
  "Operator-confirmed pitch (mm)": "Kezel\u0151 \u00e1ltal meger\u0151s\u00edtett menetemelked\u00e9s (mm)",
  "Tap style": "Menetf\u00far\u00f3 t\u00edpusa",
  "Hole type": "Furat t\u00edpusa",
  "Pre-drill diameter (mm)": "El\u0151f\u00far\u00e1s \u00e1tm\u00e9r\u0151je (mm)",
  "Select": "V\u00e1lassz",
  "Cut tap": "Forg\u00e1csol\u00f3 menetf\u00far\u00f3",
  "Form tap": "Menetform\u00e1z\u00f3",
  "Blind": "Zs\u00e1kfurat",
  "Through": "\u00c1tmen\u0151 furat",
  "milling": "mar\u00e1s",
  "drilling": "f\u00far\u00e1s",
  "tapping": "menetf\u00far\u00e1s",
  "provisional": "ideiglenes",
  "needs_input": "adat kell",
  "needs_confirmation": "meger\u0151s\u00edt\u00e9s kell",
  "unsupported": "nem t\u00e1mogatott",
  "unsafe": "nem biztons\u00e1gos",
  "conflict": "ellentmond\u00e1s",
  "error": "hiba",
  "spindle": "ors\u00f3fordulat",
  "synchronized_tapping": "szinkron menetf\u00far\u00e1s",
  "cutting": "megmunk\u00e1l\u00e1s",
  "canned_cycle": "f\u00far\u00f3ciklus",
  "plunge": "f\u00fcgg\u0151leges bel\u00e9p\u00e9s",
  "ramp": "r\u00e1mpa",
  "helix": "helik\u00e1lis bel\u00e9p\u00e9s",
  "lead": "be- / kivezet\u00e9s",
  "mixed": "vegyes",
  "apMm": "ap (mm)",
  "featureDepthMm": "alakzatm\u00e9lys\u00e9g",
  "diameterMm": "\u00e1tm\u00e9r\u0151",
  "fluteCount": "\u00e9lsz\u00e1m",
  "holeDepthMm": "furatm\u00e9lys\u00e9g",
  "Axial depth ap": "Axi\u00e1lis fog\u00e1s ap",
  "Radial engagement ae": "Radi\u00e1lis fog\u00e1ssz\u00e9less\u00e9g ae",
  "Supported tool type": "T\u00e1mogatott szersz\u00e1mt\u00edpus",
  "Thread depth": "Menetm\u00e9lys\u00e9g",
  "Tap style and hole type": "Menetf\u00far\u00f3- \u00e9s furatt\u00edpus",
  "Thread pitch": "Menetemelked\u00e9s",
};
const I18N_HU_ATTR = {
  "Automation sections": "Automatiz\u00e1l\u00e1si ter\u00fcletek",
  "Assembly tools": "\u00d6ssze\u00e1ll\u00edt\u00e1si eszk\u00f6z\u00f6k",
  "Analysis method": "Elemz\u00e9si m\u00f3dszer",
  "SolidCAM add-ins": "SolidCAM b\u0151v\u00edtm\u00e9nyek",
  "Kill all SLDWORKS.exe processes for the unhealthy session": "Az \u00f6sszes SLDWORKS.exe folyamat le\u00e1ll\u00edt\u00e1sa a hib\u00e1s munkamenethez",
  "Enabled only when Excelsis detects an unhealthy SOLIDWORKS session": "Csak akkor akt\u00edv, ha az Excelsis hib\u00e1s SOLIDWORKS munkamenetet \u00e9szlel",
  "Load the selected SolidCAM add-in into SOLIDWORKS": "A kiv\u00e1lasztott SolidCAM b\u0151v\u00edtm\u00e9ny bet\u00f6lt\u00e9se a SOLIDWORKS-be",
  "Unload the selected SolidCAM add-in from SOLIDWORKS": "A kiv\u00e1lasztott SolidCAM b\u0151v\u00edtm\u00e9ny elt\u00e1vol\u00edt\u00e1sa a SOLIDWORKS-b\u0151l",
  "Create the CAM folder for the active SOLIDWORKS document and copy it to clipboard": "CAM mappa l\u00e9trehoz\u00e1sa az akt\u00edv SOLIDWORKS dokumentumhoz \u00e9s az \u00fatvonal v\u00e1g\u00f3lapra m\u00e1sol\u00e1sa",
  "Retry only missing thumbnails with Windows and SOLIDWORKS preview APIs": "Csak a hi\u00e1nyz\u00f3 b\u00e9lyegk\u00e9pek \u00fajrapr\u00f3b\u00e1l\u00e1sa Windows- \u00e9s SOLIDWORKS-el\u0151n\u00e9zeti API-kkal",
  "Save these settings for later exports without exporting now": "A be\u00e1ll\u00edt\u00e1sok ment\u00e9se k\u00e9s\u0151bbi exporthoz, export\u00e1l\u00e1s n\u00e9lk\u00fcl",
  "Milling: Carbide; drills: HSS": "Mar\u00e1s: Carbide; f\u00far\u00f3k: HSS",
  "Leave blank to use the configured milling and drill defaults": "Hagyd \u00fcresen a be\u00e1ll\u00edtott mar\u00f3- \u00e9s f\u00far\u00f3-alap\u00e9rt\u00e9kek haszn\u00e1lat\u00e1hoz",
  "Search filename or path...": "Keresés fájlnév vagy útvonal szerint...",
  "Search filename snippets...": "Keresés fájlnévrészletek szerint...",
  "e.g. 1.2312 steel / AlMgSi1": "pl. 1.2312 acél / AlMgSi1",
  "e.g. carbide endmill": "pl. keményfém szármaró",
  "Leave blank to use the SOLIDWORKS default": "Hagyd üresen a SOLIDWORKS alapértékéhez",
  "Open the folder holding the generated AI prompt files": "A generált AI prompt fájlok mappájának megnyitása",
  "Leave blank to use the configured milling, drill, and tap defaults": "Hagyd \u00fcresen a be\u00e1ll\u00edtott mar\u00f3-, f\u00far\u00f3- \u00e9s menetf\u00far\u00f3-alap\u00e9rt\u00e9kek haszn\u00e1lat\u00e1hoz",
  "Aluminum": "Alum\u00ednium",
  "Other": "Egy\u00e9b",
};

function normalizeI18nText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

// Reverse maps (hu -> en) for stateless reverting.
const I18N_EN = Object.fromEntries(Object.entries(I18N_HU).map(([en, hu]) => [hu, en]));
const I18N_EN_ATTR = Object.fromEntries(Object.entries(I18N_HU_ATTR).map(([en, hu]) => [hu, en]));

let currentUiLanguage = "en";

// Translate a DYNAMIC string (one assigned from JS at runtime, which the
// static applyUiLanguage() DOM sweep can never see). Same en-keyed table as
// the static UI; falls back to the English text when no entry exists. Use for
// status lines etc.: ui.x.textContent = t("Scanning...").
function t(text) {
  if (currentUiLanguage !== "hu") return text;
  return I18N_HU[normalizeI18nText(text)] || text;
}

function ta(text) {
  if (currentUiLanguage !== "hu") return text;
  const normalized = normalizeI18nText(text);
  return I18N_HU_ATTR[normalized] || I18N_HU[normalized] || text;
}

function translatedUiText(text, hu) {
  const map = hu ? I18N_HU : I18N_EN;
  const direct = map[text];
  if (direct) return direct;
  for (const [source, target] of Object.entries(map)) {
    if (source.endsWith(":") && text.startsWith(`${source} `)) {
      return `${target}${text.slice(source.length)}`;
    }
  }
  return "";
}

// Stateless: translate by matching the CURRENT text against the en->hu map (when
// going to Hungarian) or the hu->en map (when reverting). Elements whose text was
// replaced dynamically by JS (not in either map) are left untouched, so toggling
// language can never clobber live status text.
function applyUiLanguage(lang) {
  currentUiLanguage = lang === "hu" ? "hu" : "en";
  const hu = currentUiLanguage === "hu";
  document.documentElement.lang = hu ? "hu" : "en";
  document.querySelectorAll("button, h1, h2, h3, h4, span, small, option, a, legend, p, div, label").forEach((el) => {
    if (el.children.length > 0) return; // leaf text only
    const cur = normalizeI18nText(el.textContent);
    if (!cur) return;
    const next = translatedUiText(cur, hu);
    if (next && next !== el.textContent) el.textContent = next;
  });
  document.querySelectorAll("[placeholder], [title], [aria-label]").forEach((el) => {
    for (const attr of ["placeholder", "title", "aria-label"]) {
      if (!el.hasAttribute(attr)) continue;
      const cur = normalizeI18nText(el.getAttribute(attr));
      if (!cur) continue;
      const next = hu
        ? (I18N_HU_ATTR[cur] || I18N_HU[cur])
        : (I18N_EN_ATTR[cur] || I18N_EN[cur]);
      if (next) el.setAttribute(attr, next);
    }
  });
}

// --- G-code (MPF) checker view -------------------------------------------

function formatGcodeWhen(mtimeMs) {
  const when = new Date(Number(mtimeMs || 0));
  if (Number.isNaN(when.getTime()) || !mtimeMs) return "";
  return when.toLocaleString(undefined, {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function fillGcodeDatalists(gcode) {
  const fill = (listEl, values) => {
    if (!listEl) return;
    listEl.innerHTML = "";
    for (const value of Array.isArray(values) ? values : []) {
      const option = document.createElement("option");
      option.value = value;
      listEl.appendChild(option);
    }
  };
  fill(ui.gcodeMaterialOptions, gcode?.materials);
  const toolMaterials = [
    gcode?.defaultMillingToolMaterial,
    gcode?.defaultDrillToolMaterial,
    gcode?.defaultTapToolMaterial,
    ...(Array.isArray(gcode?.toolMaterials) ? gcode.toolMaterials : []),
  ].filter((value, index, list) => value && list.findIndex((item) =>
    String(item).toLowerCase() === String(value).toLowerCase()
  ) === index);
  fill(ui.gcodeToolMaterialOptions, toolMaterials);
  if (ui.gcodeToolMaterialInput) {
    ui.gcodeToolMaterialInput.placeholder = `${t("Milling")}: ${gcode?.defaultMillingToolMaterial || "Carbide"}; ${t("drills")}: ${gcode?.defaultDrillToolMaterial || "HSS"}`;
  }
}

function fillDatalistItems(listElement, items, valueKey = "label") {
  if (!listElement) return;
  listElement.innerHTML = "";
  for (const item of items || []) {
    const option = document.createElement("option");
    option.value = item?.[valueKey] || item?.id || String(item || "");
    listElement.appendChild(option);
  }
}

function fillMaterialGroupSelect(items) {
  const select = ui.gcodeMaterialFamilyInput;
  if (!select) return;
  const current = String(select.value || "").trim().toLowerCase();
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("Choose material group");
  select.appendChild(placeholder);
  let selectedValue = "";
  for (const item of items || []) {
    const option = document.createElement("option");
    option.value = item?.id || item?.label || "";
    option.textContent = t(item?.label || item?.id || "");
    select.appendChild(option);
    const identities = [item?.id, item?.label, ...(item?.aliases || [])]
      .map((value) => String(value || "").trim().toLowerCase());
    if (current && identities.includes(current)) selectedValue = option.value;
  }
  select.value = selectedValue;
}

async function loadGcodeMaterialOptions() {
  if (typeof api.gcodeMaterialOptions !== "function") return;
  const family = ui.gcodeMaterialFamilyInput?.value || "";
  const result = await api.gcodeMaterialOptions({ family, query: "" }).catch(() => null);
  if (!result?.ok) return;
  state.gcodeMaterialGroups = result.groups || [];
  fillMaterialGroupSelect(result.groups);
  fillDatalistItems(ui.gcodeMaterialGradeOptions, result.grades);
}

function applyGcodeLocalDefaults(gcode, force = false) {
  const set = (element, value) => {
    if (element && (force || !String(element.value || "").trim())) element.value = value;
  };
  set(ui.gcodeMachineMaxRpm, gcode?.machineMaxRpm || 10000);
  set(ui.gcodeAggressiveness, gcode?.defaultAggressiveness || "balanced");
  set(ui.gcodeAePercent, gcode?.defaultAePercent || 10);
  set(ui.gcodeCoolingMode, gcode?.defaultCoolingMode || "air");
  set(ui.gcodeContactMode, gcode?.defaultContactMode || "side");
  set(ui.gcodeFluteCount, gcode?.defaultFluteCount || 2);
  set(ui.gcodeOptimizedSuffix, gcode?.optimizedSuffix || "_optimized");
}

function setGcodeMethod(method) {
  const next = method === "local" ? "local" : "ai";
  state.gcodeMethod = next;
  const local = next === "local";
  ui.gcodeMethodAiBtn?.classList.toggle("active", !local);
  ui.gcodeMethodLocalBtn?.classList.toggle("active", local);
  ui.gcodeMethodAiBtn?.setAttribute("aria-selected", String(!local));
  ui.gcodeMethodLocalBtn?.setAttribute("aria-selected", String(local));
  ui.gcodeAiInputs?.classList.toggle("hidden", local);
  ui.gcodeLocalInputs?.classList.toggle("hidden", !local);
  ui.gcodeLocalActions?.classList.toggle("hidden", !local || !state.gcodeLocalSessionId);
  if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = "";
  if (local) {
    applyGcodeLocalDefaults(state.settings?.gcode);
    loadGcodeMaterialOptions().catch(() => {});
    renderGcodeLocalProposal(state.gcodeLocalProposal);
  } else if (ui.gcodeResults) {
    ui.gcodeResults.innerHTML = "";
  }
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function collectGcodeToolOverrides() {
  const overrides = {};
  for (const card of ui.gcodeResults?.querySelectorAll("[data-gcode-tool-id]") || []) {
    const toolId = card.dataset.gcodeToolId;
    const fields = {};
    for (const input of card.querySelectorAll("[data-gcode-tool-field]")) {
      const key = input.dataset.gcodeToolField;
      fields[key] = input.dataset.valueType === "number" ? optionalNumber(input.value) : input.value;
    }
    overrides[toolId] = fields;
  }
  return overrides;
}

function collectGcodeLocalInput() {
  return {
    materialFamily: ui.gcodeMaterialFamilyInput?.value || "",
    materialGrade: ui.gcodeMaterialGradeInput?.value || "",
    hardnessValue: optionalNumber(ui.gcodeHardnessInput?.value),
    hardnessScale: ui.gcodeHardnessScale?.value || "HRC",
    machineMaxRpm: optionalNumber(ui.gcodeMachineMaxRpm?.value),
    machineMaxFeedMmMin: state.settings?.gcode?.machineMaxFeedMmMin || 10000,
    aggressiveness: ui.gcodeAggressiveness?.value || "balanced",
    aePercent: optionalNumber(ui.gcodeAePercent?.value),
    coolingMode: ui.gcodeCoolingMode?.value || "air",
    contactMode: ui.gcodeContactMode?.value || "side",
    fluteCount: optionalNumber(ui.gcodeFluteCount?.value),
    toolOverrides: collectGcodeToolOverrides(),
  };
}

function collectGcodeSelections() {
  const selections = [];
  for (const row of ui.gcodeResults?.querySelectorAll("[data-gcode-change-id]") || []) {
    selections.push({
      id: row.dataset.gcodeChangeId,
      accepted: row.querySelector("[data-gcode-change-accepted]")?.checked === true,
      value: optionalNumber(row.querySelector("[data-gcode-change-value]")?.value),
    });
  }
  return selections;
}

function formatGcodeDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours ? `${hours} h ${minutes} min` : `${minutes} min ${remainder} s`;
}

function gcodeToolField(label, field, value, options = {}) {
  const type = options.type || "number";
  const hint = options.hint
    ? `<small class="gcode-field-hint ${escapeHtml(options.hintTone || "")}">${escapeHtml(options.hint)}</small>`
    : "";
  if (type === "select") {
    const choices = (options.choices || []).map(([choiceValue, choiceLabel]) =>
      `<option value="${escapeHtml(choiceValue)}"${String(value) === choiceValue ? " selected" : ""}>${escapeHtml(t(choiceLabel))}</option>`
    ).join("");
    return `<label><span>${escapeHtml(t(label))}</span>${hint}<select data-gcode-tool-field="${escapeHtml(field)}">${choices}</select></label>`;
  }
  const numeric = type === "number";
  const attrs = numeric
    ? `type="number" data-value-type="number" step="${escapeHtml(String(options.step || "0.1"))}"${options.min !== undefined ? ` min="${escapeHtml(String(options.min))}"` : ""}`
    : "type=\"text\" spellcheck=\"false\"";
  return `<label><span>${escapeHtml(t(label))}</span>${hint}<input ${attrs} data-gcode-tool-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}"></label>`;
}

function gcodeAxialDepthHint(controls) {
  if (controls.apSource === "operator") return { text: t("Operator value"), tone: "operator" };
  const evidence = Number.isInteger(controls.apEvidenceCount)
    ? ` - ${controls.apEvidenceCount} ${t("samples")}` : "";
  if (controls.apSource === "cutting_z_levels") {
    const confidence = controls.apConfidence === "high"
      ? t("High confidence")
      : (controls.apConfidence === "medium" ? t("Medium confidence") : t("Low confidence - verify"));
    return {
      text: `${t("MPF Z-level estimate")} - ${confidence}${evidence}`,
      tone: controls.apConfidence || "low",
    };
  }
  if (controls.apSource === "cutting_entry_motion") {
    return {
      text: `${t("MPF entry-motion estimate")} - ${t("Low confidence - verify")}${evidence}`,
      tone: "low",
    };
  }
  return null;
}

function setGcodeLocalControlsDirty(dirty) {
  state.gcodeLocalControlsDirty = dirty === true;
  if (ui.gcodeLocalUpdateEstimateBtn) {
    ui.gcodeLocalUpdateEstimateBtn.disabled = state.gcodeAnalyzeInFlight || state.gcodeLocalControlsDirty;
  }
  if (ui.gcodeLocalCreateCopyBtn) {
    ui.gcodeLocalCreateCopyBtn.disabled = state.gcodeAnalyzeInFlight
      || state.gcodeLocalControlsDirty || !state.gcodeLocalProposal?.canWrite;
  }
}

function markGcodeLocalControlsDirty() {
  if (!state.gcodeLocalSessionId || state.gcodeLocalControlsDirty) return;
  setGcodeLocalControlsDirty(true);
  if (ui.gcodeAnalyzeState) {
    ui.gcodeAnalyzeState.textContent = t("Inputs changed. Recalculate before creating the copy.");
  }
}

function renderGcodeLocalProposal(proposal) {
  if (!ui.gcodeResults) return;
  ui.gcodeResults.innerHTML = "";
  if (!proposal) return;
  const time = proposal.timeEstimate || {};
  const percent = time.percentChange === null || time.percentChange === undefined
    ? "-" : `${time.percentChange > 0 ? "+" : ""}${time.percentChange}%`;
  const summary = document.createElement("div");
  summary.className = "gcode-local-summary";
  summary.innerHTML = `
    <div><span>${escapeHtml(t("Estimated time"))}</span><b>${escapeHtml(formatGcodeDuration(time.oldSeconds))} -> ${escapeHtml(formatGcodeDuration(time.newSeconds))}</b></div>
    <div><span>${escapeHtml(t("Change"))}</span><b>${escapeHtml(percent)}</b></div>
    <div><span>${escapeHtml(t("Accepted edits"))}</span><b>${escapeHtml(String(proposal.acceptedChangeCount || 0))}</b></div>`;
  ui.gcodeResults.appendChild(summary);

  for (const tool of proposal.tools || []) {
    const card = document.createElement("section");
    card.className = `gcode-tool-card gcode-local-tool status-${String(tool.status || "unknown").replace(/[^a-z_]/g, "")}`;
    card.dataset.gcodeToolId = tool.id;
    const controls = tool.controls || {};
    const target = tool.recommendation?.levels?.target || null;
    const currentProgram = [];
    if (Number(controls.currentRpm) > 0) currentProgram.push(`${controls.currentRpm} RPM`);
    if (Number(controls.currentFeed) > 0) currentProgram.push(`${controls.currentFeed} mm/min`);
    const fields = [
      gcodeToolField("Tool material", "toolMaterial", controls.toolMaterial || "", { type: "text" }),
      gcodeToolField("Diameter (mm)", "diameterMm", controls.diameterMm, { step: 0.1, min: 0.1 }),
    ];
    if (tool.process !== "tapping") {
      fields.push(gcodeToolField("Flute / edge count", "fluteCount", controls.fluteCount, { step: 1, min: 1 }));
    }
    if (tool.process === "milling") {
      const apHint = gcodeAxialDepthHint(controls);
      fields.push(gcodeToolField("Axial depth ap (mm)", "apMm", controls.apMm, {
        step: 0.001,
        min: 0.001,
        hint: apHint?.text,
        hintTone: apHint?.tone,
      }));
      fields.push(gcodeToolField("Radial engagement ae (%)", "aePercent", controls.aePercent, { step: 0.5, min: 0.1 }));
      if (["chamfer", "engraver_vbit"].includes(tool.toolType)) {
        fields.push(gcodeToolField("Feature depth (mm)", "featureDepthMm", controls.featureDepthMm, { step: 0.05, min: 0.01 }));
      }
    } else if (tool.process === "drilling") {
      fields.push(gcodeToolField("Hole depth (mm)", "holeDepthMm", controls.holeDepthMm, { step: 0.1, min: 0.1 }));
    } else if (tool.process === "tapping") {
      fields.push(gcodeToolField("Thread depth (mm)", "threadDepthMm", controls.threadDepthMm, { step: 0.1, min: 0.1 }));
      fields.push(`<div class="gcode-readonly-field"><span>${escapeHtml(t("Detected pitch (mm)"))}</span><b>${escapeHtml(controls.pitchMm ?? "-")}</b></div>`);
      fields.push(gcodeToolField("Operator-confirmed pitch (mm)", "operatorConfirmedPitchMm", controls.operatorConfirmedPitchMm, { step: 0.01, min: 0.01 }));
      fields.push(gcodeToolField("Tap style", "tapStyle", controls.tapStyle, { type: "select", choices: [
        ["unknown", "Select"], ["cut", "Cut tap"], ["form", "Form tap"],
      ] }));
      fields.push(gcodeToolField("Hole type", "holeKind", controls.holeKind, { type: "select", choices: [
        ["unknown", "Select"], ["blind", "Blind"], ["through", "Through"],
      ] }));
      fields.push(gcodeToolField("Pre-drill diameter (mm)", "preDrillDiameterMm", controls.preDrillDiameterMm, { step: 0.05, min: 0.1 }));
    }
    const missingLabels = {
      diameterMm: "Diameter (mm)",
      fluteCount: "Flute / edge count",
      apMm: "Axial depth ap",
      aePercent: "Radial engagement ae",
      featureDepthMm: "Feature depth (mm)",
      holeDepthMm: "Hole depth (mm)",
      threadDepthMm: "Thread depth",
      supportedToolType: "Supported tool type",
      "tool.style": "Tap style and hole type",
      "thread.kind": "Tap style and hole type",
      "thread.pitch_mm": "Thread pitch",
    };
    const missing = (tool.missingInputs || []).map((item) => t(missingLabels[item] || item)).join(", ");
    const warnings = (tool.warnings || []).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
    card.innerHTML = `
      <div class="gcode-local-tool-head">
        <div><h3>${escapeHtml(tool.label)}</h3><span>${escapeHtml(tool.description || tool.toolType || "")}</span></div>
        <strong><span>${escapeHtml(t(tool.process))}</span> / <span>${escapeHtml(t(tool.status))}</span></strong>
      </div>
      <div class="gcode-tool-controls">${fields.join("")}</div>
      ${missing ? `<div class="gcode-input-warning">${escapeHtml(t("Required"))}: ${escapeHtml(missing)}</div>` : ""}
      ${currentProgram.length ? `<div class="gcode-target-line"><span>${escapeHtml(t("Current program"))}</span><b>${escapeHtml(currentProgram.join(" / "))}</b></div>` : ""}
      ${target ? `<div class="gcode-target-line"><span>${escapeHtml(t("Calculated target"))}</span><b>${escapeHtml(String(target.rpm))} RPM / ${escapeHtml(String(target.feed_mm_min))} mm/min</b></div>` : ""}
      ${warnings ? `<ul class="gcode-warning-list">${warnings}</ul>` : ""}
      <div class="gcode-change-list"></div>`;
    const changeList = card.querySelector(".gcode-change-list");
    for (const group of tool.changeGroups || []) {
      const row = document.createElement("label");
      row.className = "gcode-change-row";
      row.dataset.gcodeChangeId = group.id;
      const unit = group.programmedUnit || (group.kind.includes("rpm") ? "RPM" : "mm/min");
      const sync = group.kind === "tap_rpm" && group.synchronizedFeedMmMin
        ? ` / ${group.synchronizedFeedMmMin} mm/min` : "";
      row.innerHTML = `
        <input type="checkbox" data-gcode-change-accepted${group.accepted ? " checked" : ""}${group.editable ? "" : " disabled"}>
        <span class="gcode-change-kind">${escapeHtml(t(group.classification || group.kind))}</span>
        <span class="gcode-change-current">${escapeHtml((group.currentValues || []).join(", "))} -></span>
        <input type="number" data-gcode-change-value value="${escapeHtml(String(group.proposedValue))}" step="${escapeHtml(String(group.step))}" min="${escapeHtml(String(group.minimum))}" max="${escapeHtml(String(group.maximum))}"${group.editable ? "" : " disabled"}>
        <span>${escapeHtml(unit + sync)}</span>`;
      changeList.appendChild(row);
    }
    for (const input of card.querySelectorAll("[data-gcode-tool-field]")) {
      input.addEventListener("input", markGcodeLocalControlsDirty);
      input.addEventListener("change", markGcodeLocalControlsDirty);
    }
    ui.gcodeResults.appendChild(card);
  }
  ui.gcodeLocalActions?.classList.remove("hidden");
  setGcodeLocalControlsDirty(state.gcodeLocalControlsDirty);
}

async function openGcodeContainingFolder(file) {
  if (!file?.path || typeof api.gcodeOpenContainingFolder !== "function") return;
  hideRecentDocContextMenu();
  const result = await api.gcodeOpenContainingFolder(file.path).catch((error) => ({
    ok: false,
    error: error.message,
  }));
  if (!result?.ok) log("Could not open G-code file location.", result || {});
}

function showGcodeContextMenu(event, file) {
  event.preventDefault();
  event.stopPropagation();
  hideRecentDocContextMenu();
  const menu = document.createElement("div");
  menu.className = "recent-docs-context-menu";
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  const openFolder = document.createElement("button");
  openFolder.type = "button";
  openFolder.textContent = t("Open file location");
  openFolder.addEventListener("click", (clickEvent) => {
    clickEvent.stopPropagation();
    openGcodeContainingFolder(file);
  });
  menu.appendChild(openFolder);
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const pad = 8;
  menu.style.left = `${Math.max(pad, Math.min(event.clientX, window.innerWidth - rect.width - pad))}px`;
  menu.style.top = `${Math.max(pad, Math.min(event.clientY, window.innerHeight - rect.height - pad))}px`;
  recentDocsState.contextMenu = menu;
  recentDocsState.contextEntry = file;
}

function renderGcodeFileList() {
  if (!ui.gcodeFileList) return;
  ui.gcodeFileList.innerHTML = "";
  if (!state.gcodeFiles.length) {
    const empty = document.createElement("div");
    empty.className = "response-preview muted";
    empty.textContent = t("No .MPF files found yet. Check the search root in Settings.");
    ui.gcodeFileList.appendChild(empty);
    return;
  }
  for (const file of state.gcodeFiles) {
    const row = document.createElement("div");
    row.className = "gcode-file";
    row.tabIndex = 0;
    row.role = "listitem";
    row.classList.toggle("selected", file.path === state.gcodeSelectedPath);
    row.innerHTML = `
      <div class="gcode-file-name">${escapeHtml(file.name)}</div>
      <div class="gcode-file-meta">
        <span class="gcode-file-when">${escapeHtml(formatGcodeWhen(file.mtimeMs))}</span>
        <span class="gcode-file-folder" title="${escapeHtml(file.folder)}">${escapeHtml(file.folder)}</span>
      </div>`;
    const select = () => selectGcodeFile(file);
    row.addEventListener("click", select);
    row.addEventListener("contextmenu", (event) => showGcodeContextMenu(event, file));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
    });
    ui.gcodeFileList.appendChild(row);
  }
}

// Collapse/expand the file list around the analyze form. Collapsed = list and
// scan-state line hidden, "Select different MPF" button shown in the panel.
function applyGcodeListVisibility() {
  const collapsed = state.gcodeListCollapsed && !!state.gcodeSelectedPath;
  if (ui.gcodeFileList) ui.gcodeFileList.classList.toggle("hidden", collapsed);
  if (ui.gcodeState) ui.gcodeState.classList.toggle("hidden", collapsed);
  if (ui.gcodeChangeFileBtn) ui.gcodeChangeFileBtn.classList.toggle("hidden", !collapsed);
}

function selectGcodeFile(file) {
  state.gcodeSelectedPath = file.path;
  state.gcodeLocalSessionId = "";
  state.gcodeLocalProposal = null;
  state.gcodeLocalControlsDirty = false;
  state.gcodeListCollapsed = true;
  if (ui.gcodeAnalyzePanel) ui.gcodeAnalyzePanel.classList.remove("hidden");
  if (ui.gcodeSelectedFile) {
    ui.gcodeSelectedFile.textContent = file.name;
    ui.gcodeSelectedFile.title = file.path;
  }
  if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = "";
  if (ui.gcodeResults) ui.gcodeResults.innerHTML = "";
  ui.gcodeLocalActions?.classList.add("hidden");
  renderGcodeFileList();
  applyGcodeListVisibility();
}

function renderGcodeResults(analysis, promptPath) {
  if (!ui.gcodeResults) return;
  ui.gcodeResults.innerHTML = "";
  const fmt = (v, unit = "") => (v === null || v === undefined ? "-" : `${v}${unit}`);
  for (const tool of analysis?.tools || []) {
    const feeds = (tool.feeds || []).map((f) => f.feed).join(", ") || "-";
    const plunge = (tool.plungeFeeds || []).map((f) => f.feed).join(", ") || "-";
    const entries = Object.entries(tool.entries || {}).filter(([, n]) => n > 0)
      .map(([kind, n]) => `${kind}:${n}`).join(" ") || "-";
    const card = document.createElement("div");
    card.className = "gcode-tool-card";
    card.innerHTML = `
      <div class="gcode-tool-title">${escapeHtml(tool.label)}${tool.diameterMm ? ` <span class="muted">~D${escapeHtml(String(tool.diameterMm))}</span>` : ""}</div>
      <div class="gcode-tool-grid">
        <span>Operation</span><b>${escapeHtml(tool.toolKind === "drill" ? "Drilling / tapping" : "Milling")}</b>
        <span>Tool material</span><b>${escapeHtml(tool.toolMaterial || "-")}</b>
        <span>Header</span><b>${escapeHtml(tool.description || "-")}</b>
        <span>RPM</span><b>${escapeHtml((tool.rpms || []).join(", ") || "-")}</b>
        <span>Feed</span><b>${escapeHtml(feeds)}</b>
        <span>Plunge F</span><b>${escapeHtml(plunge)}</b>
        <span>DOC</span><b>${escapeHtml(fmt(tool.stepDownTypical, " mm"))}</b>
        <span>Stepover</span><b>${escapeHtml(fmt(tool.stepoverEstimate, " mm"))}</b>
        <span>Min Z</span><b>${escapeHtml(fmt(tool.minZ, " mm"))}</b>
        <span>Lead-in</span><b>${escapeHtml(entries)}</b>
        <span>Cycles</span><b>${escapeHtml((tool.cycles || []).join(", ") || "-")}</b>
      </div>`;
    ui.gcodeResults.appendChild(card);
  }
  if (promptPath) {
    const note = document.createElement("div");
    note.className = "response-preview muted";
    note.textContent = `${t("Prompt saved:")} ${promptPath}`;
    ui.gcodeResults.appendChild(note);
  }
}

async function refreshGcodeHistory() {
  if (!ui.gcodeHistory) return;
  const result = await api.gcodeListChecks().catch(() => null);
  ui.gcodeHistory.innerHTML = "";
  const files = result?.files || [];
  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "response-preview muted";
    empty.textContent = t("No checks generated yet.");
    ui.gcodeHistory.appendChild(empty);
    return;
  }
  for (const file of files) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "gcode-history-item";
    row.title = file.path;
    row.textContent = `${formatGcodeWhen(file.mtimeMs)}  ${file.name}`;
    row.addEventListener("click", async () => {
      const opened = await api.gcodeOpenCheck(file.path).catch(() => null);
      if (!opened?.ok) log(`Could not open check: ${opened?.error || "unknown error"}`);
    });
    ui.gcodeHistory.appendChild(row);
  }
}

async function refreshGcodeView() {
  fillGcodeDatalists(state.settings?.gcode);
  refreshGcodeHistory().catch(() => {});
  applyGcodeListVisibility();
  if (state.gcodeListInFlight) return;
  state.gcodeListInFlight = true;
  // Paint the previous scan's list immediately so switching to the view is
  // instant; the fresh scan replaces it when it lands (bounded ~4s worst case).
  renderGcodeFileList();
  if (ui.gcodeState) {
    ui.gcodeState.textContent = state.gcodeFiles.length
      ? t("Refreshing list...")
      : t("Scanning for recent .MPF programs...");
  }
  try {
    const result = await api.gcodeListRecent();
    if (result?.ok) {
      state.gcodeFiles = result.files || [];
      const truncatedNote = result.truncated ? ` ${t("(scan budget hit - deep folders may be missing)")}` : "";
      if (ui.gcodeState) {
        ui.gcodeState.textContent = `${state.gcodeFiles.length} ${t("newest .MPF under")} ${result.root}${truncatedNote}`;
      }
    } else if (ui.gcodeState) {
      state.gcodeFiles = result?.files || [];
      ui.gcodeState.textContent = `${t("Scan failed:")} ${result?.error || "unknown error"}`;
    }
    renderGcodeFileList();
  } finally {
    state.gcodeListInFlight = false;
  }
}

async function runGcodeAnalyze() {
  if (state.gcodeAnalyzeInFlight) return;
  if (!state.gcodeSelectedPath) {
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Select a .MPF file from the list first.");
    return;
  }
  state.gcodeAnalyzeInFlight = true;
  if (ui.gcodeAnalyzeBtn) ui.gcodeAnalyzeBtn.disabled = true;
  if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Analyzing program...");
  try {
    const result = await api.gcodeAnalyze({
      mpfPath: state.gcodeSelectedPath,
      material: ui.gcodeMaterialInput?.value || "",
      toolMaterial: ui.gcodeToolMaterialInput?.value || "",
    });
    if (!result?.ok) {
      if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = `${t("Analyze failed:")} ${result?.error || "unknown error"}`;
      return;
    }
    const toolCount = result.analysis?.tools?.length || 0;
    if (ui.gcodeAnalyzeState) {
      ui.gcodeAnalyzeState.textContent = `${toolCount} ${t("tool(s) found.")} ${t("Give the saved prompt file to an AI for recommendations.")}`;
    }
    renderGcodeResults(result.analysis, result.promptPath);
    // Backend remembered the two AI inputs; refresh their lists without
    // touching the local proposal controls.
    if (result.gcode) {
      if (state.settings) state.settings.gcode = result.gcode;
      fillGcodeDatalists(result.gcode);
      if (ui.settingsGcodeMaterials) ui.settingsGcodeMaterials.value = (result.gcode.materials || []).join("\n");
      if (ui.settingsGcodeToolMaterials) ui.settingsGcodeToolMaterials.value = (result.gcode.toolMaterials || []).join("\n");
      if (ui.settingsGcodeDefaultMillingToolMaterial) {
        ui.settingsGcodeDefaultMillingToolMaterial.value = result.gcode.defaultMillingToolMaterial || "Carbide";
      }
      if (ui.settingsGcodeDefaultDrillToolMaterial) {
        ui.settingsGcodeDefaultDrillToolMaterial.value = result.gcode.defaultDrillToolMaterial || "HSS";
      }
    }
    refreshGcodeHistory().catch(() => {});
    log(`G-code check saved: ${result.promptPath}`);
  } finally {
    state.gcodeAnalyzeInFlight = false;
    if (ui.gcodeAnalyzeBtn) ui.gcodeAnalyzeBtn.disabled = false;
  }
}

function setGcodeLocalBusy(busy) {
  state.gcodeAnalyzeInFlight = busy;
  for (const button of [
    ui.gcodeLocalAnalyzeBtn,
    ui.gcodeLocalRecalculateBtn,
    ui.gcodeLocalUpdateEstimateBtn,
    ui.gcodeLocalCreateCopyBtn,
  ]) {
    if (!button) continue;
    const staleEstimate = state.gcodeLocalControlsDirty
      && [ui.gcodeLocalUpdateEstimateBtn, ui.gcodeLocalCreateCopyBtn].includes(button);
    button.disabled = busy || staleEstimate
      || (button === ui.gcodeLocalCreateCopyBtn && !state.gcodeLocalProposal?.canWrite);
  }
}

async function runGcodeLocalAnalysis(recalculate = false) {
  if (state.gcodeAnalyzeInFlight) return;
  if (!state.gcodeSelectedPath) {
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Select a .MPF file from the list first.");
    return;
  }
  if (!(ui.gcodeMaterialFamilyInput?.value || "").trim()) {
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Choose a material group.");
    ui.gcodeMaterialFamilyInput?.focus();
    return;
  }
  setGcodeLocalBusy(true);
  if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Calculating local proposal...");
  try {
    const input = collectGcodeLocalInput();
    const result = recalculate && state.gcodeLocalSessionId
      ? await api.gcodeLocalRecalculate({ sessionId: state.gcodeLocalSessionId, input })
      : await api.gcodeLocalAnalyze({ mpfPath: state.gcodeSelectedPath, input });
    if (!result?.ok) {
      if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = `${t("Analyze failed:")} ${result?.error || "unknown error"}`;
      return;
    }
    state.gcodeLocalSessionId = result.sessionId;
    state.gcodeLocalProposal = result.proposal;
    state.gcodeLocalControlsDirty = false;
    renderGcodeLocalProposal(result.proposal);
    const needsInput = (result.proposal?.tools || []).filter((tool) =>
      ["needs_input", "needs_confirmation"].includes(tool.status)
    ).length;
    if (ui.gcodeAnalyzeState) {
      ui.gcodeAnalyzeState.textContent = needsInput
        ? `${needsInput} ${t("tool(s) need operator input.")}`
        : `${result.proposal?.acceptedChangeCount || 0} ${t("accepted change group(s).")}`;
    }
  } catch (error) {
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = `${t("Analyze failed:")} ${error.message}`;
  } finally {
    setGcodeLocalBusy(false);
  }
}

async function updateGcodeLocalEstimate() {
  if (!state.gcodeLocalSessionId || state.gcodeAnalyzeInFlight) return;
  if (state.gcodeLocalControlsDirty) {
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Inputs changed. Recalculate before creating the copy.");
    return;
  }
  setGcodeLocalBusy(true);
  try {
    const result = await api.gcodeLocalRecalculate({
      sessionId: state.gcodeLocalSessionId,
      selections: collectGcodeSelections(),
    });
    if (!result?.ok) {
      if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = `${t("Update failed:")} ${result?.error || "unknown error"}`;
      return;
    }
    state.gcodeLocalProposal = result.proposal;
    renderGcodeLocalProposal(result.proposal);
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Estimate updated.");
  } finally {
    setGcodeLocalBusy(false);
  }
}

async function createGcodeOptimizedCopy() {
  if (!state.gcodeLocalSessionId || state.gcodeAnalyzeInFlight) return;
  if (state.gcodeLocalControlsDirty) {
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Inputs changed. Recalculate before creating the copy.");
    return;
  }
  setGcodeLocalBusy(true);
  if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Verifying proposed changes...");
  try {
    const result = await api.gcodeLocalCreateCopy({
      sessionId: state.gcodeLocalSessionId,
      selections: collectGcodeSelections(),
      suffix: ui.gcodeOptimizedSuffix?.value || "_optimized",
    });
    if (!result?.ok) {
      if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = `${t("Copy failed:")} ${result?.error || "unknown error"}`;
      return;
    }
    if (result.canceled) {
      if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = t("Copy canceled.");
      return;
    }
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = `${t("Optimized copy created:")} ${result.path}`;
    log(`Optimized G-code copy created: ${result.path}`, { auditPath: result.auditPath, sha256: result.sha256 });
  } catch (error) {
    if (ui.gcodeAnalyzeState) ui.gcodeAnalyzeState.textContent = `${t("Copy failed:")} ${error.message}`;
  } finally {
    setGcodeLocalBusy(false);
  }
}

function renderSettings(settings) {
  if (!settings) return;
  ui.settingsUiLanguage.value = settings.uiLanguage || "en";
  ui.settingsBomLanguage.value = settings.bomExportLanguage || "en";
  if (ui.settingsHotkeysEnabled) ui.settingsHotkeysEnabled.checked = settings.hotkeys?.enabled !== false;
  if (ui.settingsPasteProjectDateHotkey) {
    ui.settingsPasteProjectDateHotkey.value = settings.hotkeys?.pasteProjectDate || "Ctrl+Space";
  }
  if (ui.settingsCopyPathHotkey) ui.settingsCopyPathHotkey.value = settings.hotkeys?.copyExplorerPath || "F7,F7";
  if (ui.settingsProjectDateTemplate) {
    ui.settingsProjectDateTemplate.value = settings.hotkeys?.projectDateTemplate || "PRJ-[currentdate]";
  }
  applyUiLanguage(settings.uiLanguage || "en");
  if (ui.settingsSolidWorksIdlePauseMinutes) {
    ui.settingsSolidWorksIdlePauseMinutes.value = settings.activity?.solidWorksIdlePauseMinutes || 3;
  }
  if (ui.settingsRecentDocsNewEntryBurstSeconds) {
    ui.settingsRecentDocsNewEntryBurstSeconds.value = settings.activity?.recentDocsNewEntryBurstSeconds ?? 4;
  }
  if (ui.settingsDiagnosticsEnabled) {
    ui.settingsDiagnosticsEnabled.checked = settings.diagnostics?.enabled === true;
  }
  if (ui.settingsErpWorklogInbox) ui.settingsErpWorklogInbox.value = settings.erp?.worklogInbox || "";
  if (ui.settingsErpWorklogWorktypes) ui.settingsErpWorklogWorktypes.value = settings.erp?.worklogWorktypes || "";
  if (ui.settingsErpWorklogDocMinMinutes) ui.settingsErpWorklogDocMinMinutes.value = settings.erp?.worklogDocMinMinutes ?? 5;
  if (ui.settingsErpWorklogUserName) ui.settingsErpWorklogUserName.value = settings.erp?.worklogUserName || "";
  if (ui.settingsErpOvertimeStartTime) ui.settingsErpOvertimeStartTime.value = settings.erp?.overtimeStartTime || "17:00";
  ui.settingsCamOutputRoot.value = settings.cam?.outputRoot || "C:\\CAM";
  ui.settingsCamFolderMode.value = settings.cam?.folderMode || "project-part";
  ui.settingsCamSearchRoots.value = (settings.cam?.searchRoots || []).join("\n");
  if (ui.settingsLocationsProjectRoots) ui.settingsLocationsProjectRoots.value = (settings.locations?.projectRootNames || []).join("\n");
  if (ui.settingsLocationsProjectPrefixes) ui.settingsLocationsProjectPrefixes.value = (settings.locations?.projectCodePrefixes || []).join("\n");
  if (ui.settingsLocationsSearchRoots) ui.settingsLocationsSearchRoots.value = (settings.locations?.searchRoots || []).join("\n");
  if (ui.settingsLocationsExclusions) ui.settingsLocationsExclusions.value = (settings.locations?.exclusions || []).join("\n");
  if (ui.settingsMacroDrawingTemplate) ui.settingsMacroDrawingTemplate.value = settings.macros?.drawingTemplate || "";
  if (ui.settingsMacroDxfOutputPrefix) ui.settingsMacroDxfOutputPrefix.value = settings.macros?.dxfOutputPrefix ?? "PLATE";
  if (ui.settingsMacroDefaultMaterial) ui.settingsMacroDefaultMaterial.value = settings.macros?.defaultMaterial || "MATERIAL";
  if (ui.settingsGcodeSearchRoot) ui.settingsGcodeSearchRoot.value = settings.gcode?.searchRoot || "C:\\CAM";
  if (ui.settingsGcodeMaterials) ui.settingsGcodeMaterials.value = (settings.gcode?.materials || []).join("\n");
  if (ui.settingsGcodeToolMaterials) ui.settingsGcodeToolMaterials.value = (settings.gcode?.toolMaterials || []).join("\n");
  if (ui.settingsGcodeDefaultMillingToolMaterial) ui.settingsGcodeDefaultMillingToolMaterial.value = settings.gcode?.defaultMillingToolMaterial || "Carbide";
  if (ui.settingsGcodeDefaultDrillToolMaterial) ui.settingsGcodeDefaultDrillToolMaterial.value = settings.gcode?.defaultDrillToolMaterial || "HSS";
  if (ui.settingsGcodeDefaultTapToolMaterial) ui.settingsGcodeDefaultTapToolMaterial.value = settings.gcode?.defaultTapToolMaterial || "HSS";
  if (ui.settingsGcodeMachineMaxRpm) ui.settingsGcodeMachineMaxRpm.value = settings.gcode?.machineMaxRpm || 10000;
  if (ui.settingsGcodeMachineMaxFeed) ui.settingsGcodeMachineMaxFeed.value = settings.gcode?.machineMaxFeedMmMin || 10000;
  if (ui.settingsGcodeAggressiveness) ui.settingsGcodeAggressiveness.value = settings.gcode?.defaultAggressiveness || "balanced";
  if (ui.settingsGcodeAePercent) ui.settingsGcodeAePercent.value = settings.gcode?.defaultAePercent || 10;
  if (ui.settingsGcodeCoolingMode) ui.settingsGcodeCoolingMode.value = settings.gcode?.defaultCoolingMode || "air";
  if (ui.settingsGcodeContactMode) ui.settingsGcodeContactMode.value = settings.gcode?.defaultContactMode || "side";
  if (ui.settingsGcodeFluteCount) ui.settingsGcodeFluteCount.value = settings.gcode?.defaultFluteCount || 2;
  if (ui.settingsGcodeOptimizedSuffix) ui.settingsGcodeOptimizedSuffix.value = settings.gcode?.optimizedSuffix || "_optimized";
  fillGcodeDatalists(settings.gcode);
  applyGcodeLocalDefaults(settings.gcode, true);
  state.solidCamSettings = settings.solidCam || { selectedDllPath: "", selectedTitle: "", selectedClsid: "" };
  renderCamSelectionState();
  renderCamAddinsList(state.solidCamAddins || []);
}

function readSettingsForm() {
  return {
    uiLanguage: ui.settingsUiLanguage.value,
    bomExportLanguage: ui.settingsBomLanguage.value,
    hotkeys: {
      enabled: ui.settingsHotkeysEnabled?.checked !== false,
      pasteProjectDate: (ui.settingsPasteProjectDateHotkey?.value || "Ctrl+Space").trim(),
      copyExplorerPath: (ui.settingsCopyPathHotkey?.value || "F7,F7").trim(),
      projectPrefix: state.settings?.hotkeys?.projectPrefix || "PRJ-",
      projectDateTemplate: (ui.settingsProjectDateTemplate?.value || "PRJ-[currentdate]").trim(),
      projectDateFormat: state.settings?.hotkeys?.projectDateFormat || "yyyy.MM.dd",
    },
    erp: {
      worklogInbox: (ui.settingsErpWorklogInbox?.value || "").trim(),
      worklogWorktypes: (ui.settingsErpWorklogWorktypes?.value || "").trim(),
      worklogDocMinMinutes: Number(ui.settingsErpWorklogDocMinMinutes?.value ?? 5),
      worklogUserName: (ui.settingsErpWorklogUserName?.value || "").trim(),
      overtimeStartTime: (ui.settingsErpOvertimeStartTime?.value || "17:00").trim(),
    },
    activity: {
      solidWorksIdlePauseMinutes: Number(ui.settingsSolidWorksIdlePauseMinutes?.value) || 3,
      recentDocsNewEntryBurstSeconds: Number(ui.settingsRecentDocsNewEntryBurstSeconds?.value ?? 4),
    },
    diagnostics: {
      enabled: ui.settingsDiagnosticsEnabled?.checked === true,
    },
    cam: {
      outputRoot: ui.settingsCamOutputRoot.value,
      folderMode: ui.settingsCamFolderMode.value,
      searchRoots: ui.settingsCamSearchRoots.value
        .split(/\r?\n|;/)
        .map((item) => item.trim())
        .filter(Boolean),
    },
    macros: {
      drawingTemplate: (ui.settingsMacroDrawingTemplate?.value || "").trim(),
      dxfOutputPrefix: (ui.settingsMacroDxfOutputPrefix?.value || "").trim(),
      defaultMaterial: (ui.settingsMacroDefaultMaterial?.value || "MATERIAL").trim(),
    },
    solidCam: state.solidCamSettings || { selectedDllPath: "", selectedTitle: "", selectedClsid: "" },
    locations: {
      projectRootNames: (ui.settingsLocationsProjectRoots?.value || "")
        .split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean),
      projectCodePrefixes: (ui.settingsLocationsProjectPrefixes?.value || "")
        .split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean),
      searchRoots: (ui.settingsLocationsSearchRoots?.value || "")
        .split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean),
      exclusions: (ui.settingsLocationsExclusions?.value || "")
        .split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean),
    },
    gcode: {
      searchRoot: (ui.settingsGcodeSearchRoot?.value || "C:\\CAM").trim(),
      materials: (ui.settingsGcodeMaterials?.value || "")
        .split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean),
      toolMaterials: (ui.settingsGcodeToolMaterials?.value || "")
        .split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean),
      defaultMillingToolMaterial: (ui.settingsGcodeDefaultMillingToolMaterial?.value || "Carbide").trim(),
      defaultDrillToolMaterial: (ui.settingsGcodeDefaultDrillToolMaterial?.value || "HSS").trim(),
      defaultTapToolMaterial: (ui.settingsGcodeDefaultTapToolMaterial?.value || "HSS").trim(),
      machineMaxRpm: Number(ui.settingsGcodeMachineMaxRpm?.value || 10000),
      machineMaxFeedMmMin: Number(ui.settingsGcodeMachineMaxFeed?.value || 10000),
      defaultAggressiveness: ui.settingsGcodeAggressiveness?.value || "balanced",
      defaultAePercent: Number(ui.settingsGcodeAePercent?.value || 10),
      defaultCoolingMode: ui.settingsGcodeCoolingMode?.value || "air",
      defaultContactMode: ui.settingsGcodeContactMode?.value || "side",
      defaultFluteCount: Number(ui.settingsGcodeFluteCount?.value || 2),
      optimizedSuffix: (ui.settingsGcodeOptimizedSuffix?.value || "_optimized").trim(),
    },
  };
}

function validateRequiredSettingsPaths(settings) {
  const missing = [];
  if (!settings.erp?.worklogInbox) missing.push("ERP worklog inbox");
  if (!settings.erp?.worklogWorktypes) missing.push("ERP work types file");
  if (!settings.erp?.worklogUserName) missing.push("ERP worklog user name");
  if (!settings.cam?.outputRoot) missing.push("CAM destination root");
  if (!settings.cam?.searchRoots?.length) missing.push("CAM source folders");
  if (!settings.locations?.searchRoots?.length) missing.push("document search locations");
  if (!settings.gcode?.searchRoot) missing.push("MPF search root");
  if (missing.length) throw new Error(`Required path setting(s): ${missing.join(", ")}.`);
  const isAbsolutePath = (value) => /^(?:[A-Za-z]:[\\/]|\\\\)/.test(String(value || "").trim());
  const paths = [
    ["ERP worklog inbox", settings.erp.worklogInbox],
    ["ERP work types file", settings.erp.worklogWorktypes],
    ["CAM destination root", settings.cam.outputRoot],
    ["MPF search root", settings.gcode.searchRoot],
    ...settings.cam.searchRoots.map((value) => ["CAM source folder", value]),
    ...settings.locations.searchRoots.map((value) => ["Document search location", value]),
    ...settings.locations.exclusions.map((value) => ["Document-search exclusion", value]),
  ];
  if (settings.macros?.drawingTemplate) paths.push(["Drawing template", settings.macros.drawingTemplate]);
  for (const [label, value] of paths) {
    if (!isAbsolutePath(value)) throw new Error(`${label} must be an absolute path.`);
  }
  return settings;
}

function applySettingsGroupDefaults(group) {
  const defaults = state.defaults || {};
  switch (group) {
    case "language":
      if (ui.settingsUiLanguage) ui.settingsUiLanguage.value = defaults.uiLanguage || "en";
      if (ui.settingsBomLanguage) ui.settingsBomLanguage.value = defaults.bomExportLanguage || "en";
      applyUiLanguage(ui.settingsUiLanguage?.value || "en");
      return true;
    case "hotkeys": {
      const hotkeys = defaults.hotkeys || {};
      if (ui.settingsHotkeysEnabled) ui.settingsHotkeysEnabled.checked = hotkeys.enabled !== false;
      if (ui.settingsPasteProjectDateHotkey) {
        ui.settingsPasteProjectDateHotkey.value = hotkeys.pasteProjectDate || "Ctrl+Space";
      }
      if (ui.settingsCopyPathHotkey) ui.settingsCopyPathHotkey.value = hotkeys.copyExplorerPath || "F7,F7";
      if (ui.settingsProjectDateTemplate) {
        ui.settingsProjectDateTemplate.value = hotkeys.projectDateTemplate || "PRJ-[currentdate]";
      }
      return true;
    }
    case "activity":
      if (ui.settingsSolidWorksIdlePauseMinutes) {
        ui.settingsSolidWorksIdlePauseMinutes.value = defaults.activity?.solidWorksIdlePauseMinutes || 3;
      }
      if (ui.settingsRecentDocsNewEntryBurstSeconds) {
        ui.settingsRecentDocsNewEntryBurstSeconds.value = defaults.activity?.recentDocsNewEntryBurstSeconds ?? 4;
      }
      if (ui.settingsDiagnosticsEnabled) {
        ui.settingsDiagnosticsEnabled.checked = defaults.diagnostics?.enabled === true;
      }
      return true;
    case "erp":
      if (ui.settingsErpWorklogInbox) ui.settingsErpWorklogInbox.value = defaults.erp?.worklogInbox || "";
      if (ui.settingsErpWorklogWorktypes) ui.settingsErpWorklogWorktypes.value = defaults.erp?.worklogWorktypes || "";
      if (ui.settingsErpWorklogDocMinMinutes) ui.settingsErpWorklogDocMinMinutes.value = defaults.erp?.worklogDocMinMinutes ?? 5;
      if (ui.settingsErpWorklogUserName) ui.settingsErpWorklogUserName.value = defaults.erp?.worklogUserName || "";
      if (ui.settingsErpOvertimeStartTime) ui.settingsErpOvertimeStartTime.value = defaults.erp?.overtimeStartTime || "17:00";
      return true;
    case "cam":
      if (ui.settingsCamOutputRoot) ui.settingsCamOutputRoot.value = defaults.cam?.outputRoot || "C:\\CAM";
      if (ui.settingsCamFolderMode) ui.settingsCamFolderMode.value = defaults.cam?.folderMode || "project-part";
      if (ui.settingsCamSearchRoots) ui.settingsCamSearchRoots.value = (defaults.cam?.searchRoots || []).join("\n");
      return true;
    case "search-locations":
      if (ui.settingsLocationsSearchRoots) ui.settingsLocationsSearchRoots.value = (defaults.locations?.searchRoots || []).join("\n");
      if (ui.settingsLocationsExclusions) ui.settingsLocationsExclusions.value = (defaults.locations?.exclusions || []).join("\n");
      return true;
    case "project-locations":
      if (ui.settingsLocationsProjectRoots) ui.settingsLocationsProjectRoots.value = (defaults.locations?.projectRootNames || []).join("\n");
      if (ui.settingsLocationsProjectPrefixes) ui.settingsLocationsProjectPrefixes.value = (defaults.locations?.projectCodePrefixes || []).join("\n");
      return true;
    case "macros":
      if (ui.settingsMacroDrawingTemplate) ui.settingsMacroDrawingTemplate.value = defaults.macros?.drawingTemplate || "";
      if (ui.settingsMacroDxfOutputPrefix) ui.settingsMacroDxfOutputPrefix.value = defaults.macros?.dxfOutputPrefix ?? "PLATE";
      if (ui.settingsMacroDefaultMaterial) ui.settingsMacroDefaultMaterial.value = defaults.macros?.defaultMaterial || "MATERIAL";
      return true;
    case "solidcam":
      state.solidCamSettings = defaults.solidCam || { selectedDllPath: "", selectedTitle: "", selectedClsid: "" };
      renderCamSelectionState();
      renderCamAddinsList(state.solidCamAddins || []);
      return true;
    case "gcode":
      if (ui.settingsGcodeSearchRoot) ui.settingsGcodeSearchRoot.value = defaults.gcode?.searchRoot || "C:\\CAM";
      if (ui.settingsGcodeMaterials) ui.settingsGcodeMaterials.value = (defaults.gcode?.materials || []).join("\n");
      if (ui.settingsGcodeToolMaterials) ui.settingsGcodeToolMaterials.value = (defaults.gcode?.toolMaterials || []).join("\n");
      if (ui.settingsGcodeDefaultMillingToolMaterial) ui.settingsGcodeDefaultMillingToolMaterial.value = defaults.gcode?.defaultMillingToolMaterial || "Carbide";
      if (ui.settingsGcodeDefaultDrillToolMaterial) ui.settingsGcodeDefaultDrillToolMaterial.value = defaults.gcode?.defaultDrillToolMaterial || "HSS";
      if (ui.settingsGcodeDefaultTapToolMaterial) ui.settingsGcodeDefaultTapToolMaterial.value = defaults.gcode?.defaultTapToolMaterial || "HSS";
      if (ui.settingsGcodeMachineMaxRpm) ui.settingsGcodeMachineMaxRpm.value = defaults.gcode?.machineMaxRpm || 10000;
      if (ui.settingsGcodeMachineMaxFeed) ui.settingsGcodeMachineMaxFeed.value = defaults.gcode?.machineMaxFeedMmMin || 10000;
      if (ui.settingsGcodeAggressiveness) ui.settingsGcodeAggressiveness.value = defaults.gcode?.defaultAggressiveness || "balanced";
      if (ui.settingsGcodeAePercent) ui.settingsGcodeAePercent.value = defaults.gcode?.defaultAePercent || 10;
      if (ui.settingsGcodeCoolingMode) ui.settingsGcodeCoolingMode.value = defaults.gcode?.defaultCoolingMode || "air";
      if (ui.settingsGcodeContactMode) ui.settingsGcodeContactMode.value = defaults.gcode?.defaultContactMode || "side";
      if (ui.settingsGcodeFluteCount) ui.settingsGcodeFluteCount.value = defaults.gcode?.defaultFluteCount || 2;
      if (ui.settingsGcodeOptimizedSuffix) ui.settingsGcodeOptimizedSuffix.value = defaults.gcode?.optimizedSuffix || "_optimized";
      return true;
    default:
      return false;
  }
}

function renderCamSelectionState() {
  if (!ui.camSelectionState) return;
  const cam = state.solidCamSettings || {};
  if (cam.selectedDllPath) {
    ui.camSelectionState.textContent = `${t("Selected:")} ${cam.selectedTitle || t("(no title)")} → ${cam.selectedDllPath}`;
    ui.camSelectionState.classList.remove("muted");
  } else {
    ui.camSelectionState.textContent = t("No SolidCAM add-in selected.");
    ui.camSelectionState.classList.add("muted");
  }
}

function setSolidCamLoadStatus(text, statusClass = "unknown", title = "") {
  if (!ui.solidCamLoadStatus) return;
  const localizedText = t(text);
  ui.solidCamLoadStatus.classList.remove("loaded", "not-loaded", "loading", "stuck", "crashed", "unknown");
  ui.solidCamLoadStatus.classList.add(statusClass);
  ui.solidCamLoadStatus.textContent = localizedText;
  ui.solidCamLoadStatus.title = title ? ta(title) : localizedText;
  state.solidCamLoaded = statusClass === "loaded" ? true : (statusClass === "not-loaded" ? false : null);
  if (ui.startCamBtn) ui.startCamBtn.classList.toggle("cam-glow-running", state.solidCamLoaded === true);
  if (ui.stopCamBtn) ui.stopCamBtn.classList.toggle("cam-glow-stopped", state.solidCamLoaded === false);
}

function renderSolidCamHealth(result) {
  const health = result?.solidCamHealth || null;
  state.lastSolidCamHealth = health;
  if (!health) return false;
  const stateKey = ["loaded", "not-loaded", "loading", "stuck", "crashed", "not-running"].includes(health.state)
    ? health.state
    : "unknown";
  const statusClass = stateKey === "not-running" ? "unknown" : stateKey;
  const reasons = Array.isArray(health.reasons) ? health.reasons.filter(Boolean) : [];
  setSolidCamLoadStatus(
    health.label || "SolidCAM: checking",
    statusClass,
    [health.message || "", ...reasons].filter(Boolean).join("\n"),
  );
  return true;
}

async function refreshSolidCamLoadStatus({ force = false } = {}) {
  if (!ui.solidCamLoadStatus) return;
  if (state.solidCamStatusInFlight && !force) return;
  const cam = state.solidCamSettings || {};
  if (!cam.selectedDllPath && !cam.selectedClsid) {
    setSolidCamLoadStatus("SolidCAM: not selected", "unknown");
    return;
  }
  state.solidCamStatusInFlight = true;
  try {
    const result = await api.camAddinStatus();
    if (renderSolidCamHealth(result)) {
      return;
    }
    if (!result?.configured) {
      setSolidCamLoadStatus("SolidCAM: not selected", "unknown");
    } else if (!result?.ok) {
      setSolidCamLoadStatus("SolidCAM: status error", "unknown");
    } else if (result.loaded === true) {
      setSolidCamLoadStatus("SolidCAM: loaded", "loaded");
    } else if (result.loaded === false) {
      setSolidCamLoadStatus("SolidCAM: not loaded", "not-loaded");
    } else if (result.connected === false) {
      setSolidCamLoadStatus("SolidCAM: SW not running", "unknown");
    } else {
      setSolidCamLoadStatus("SolidCAM: unknown", "unknown");
    }
  } catch {
    setSolidCamLoadStatus("SolidCAM: status error", "unknown");
  } finally {
    state.solidCamStatusInFlight = false;
  }
}

function renderCamAddinsList(addins) {
  if (!ui.camAddinsList) return;
  ui.camAddinsList.innerHTML = "";
  if (!addins || !addins.length) {
    const empty = document.createElement("div");
    empty.className = "response-preview muted";
    empty.textContent = t("Click Search to enumerate SolidCAM add-ins registered with SOLIDWORKS.");
    ui.camAddinsList.appendChild(empty);
    return;
  }
  const cam = state.solidCamSettings || {};
  for (const addin of addins) {
    const id = `cam-addin-${addin.clsid?.replace(/[^A-Za-z0-9]/g, "") || Math.random().toString(36).slice(2)}`;
    const isSelected = (cam.selectedDllPath || "").toLowerCase() === (addin.dllPath || "").toLowerCase();
    const row = document.createElement("label");
    row.className = "cam-addin-row" + (isSelected ? " selected" : "");
    row.setAttribute("for", id);
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "cam-addin";
    radio.id = id;
    radio.value = addin.dllPath || "";
    radio.checked = isSelected;
    radio.addEventListener("change", () => {
      state.solidCamSettings = {
        selectedDllPath: addin.dllPath || "",
        selectedTitle: addin.title || "",
        selectedClsid: addin.clsid || "",
      };
      renderCamSelectionState();
      refreshSolidCamLoadStatus({ force: true });
      renderCamAddinsList(state.solidCamAddins || []);
      api.saveSettings(readSettingsForm()).then((r) => {
        if (r?.ok) state.settings = r.settings;
      }).catch(() => {});
    });
    const meta = document.createElement("div");
    meta.className = "cam-addin-meta";
    const titleText = addin.title || "(no title)";
    const pathText = addin.dllPath || "(no DLL path)";
    const title = document.createElement("span");
    title.className = "cam-addin-title";
    title.textContent = titleText;
    title.title = titleText;
    const pathRow = document.createElement("span");
    pathRow.className = "cam-addin-path";
    pathRow.textContent = pathText;
    pathRow.title = pathText;
    meta.appendChild(title);
    meta.appendChild(pathRow);
    // Whole-row tooltip too - lets the user inspect both title + path
    // by hovering anywhere on the row.
    row.title = `${titleText}\n${pathText}`;
    row.appendChild(radio);
    row.appendChild(meta);
    ui.camAddinsList.appendChild(row);
  }
}

async function searchCamAddins() {
  if (!ui.searchCamAddinsBtn) return;
  ui.searchCamAddinsBtn.disabled = true;
  const originalLabel = ui.searchCamAddinsBtn.textContent;
  ui.searchCamAddinsBtn.textContent = "Searching...";
  try {
    const result = await api.findSwAddins("solidcam");
    state.solidCamAddins = result?.addins || [];
    renderCamAddinsList(state.solidCamAddins);
    if (!result?.ok) {
      log("SolidCAM add-in search had problems.", result);
    } else if (state.solidCamAddins.length === 0) {
      log("No SolidCAM add-ins found in registry.", result);
    } else {
      log(`Found ${state.solidCamAddins.length} SolidCAM add-in(s).`, result);
    }
  } catch (error) {
    log("SolidCAM add-in search failed.", { error: error.message });
  } finally {
    ui.searchCamAddinsBtn.disabled = false;
    ui.searchCamAddinsBtn.textContent = originalLabel;
  }
}

async function startCamAddin() {
  if (!ui.startCamBtn) return;
  const cam = state.solidCamSettings || {};
  if (!cam.selectedDllPath) {
    log("No SolidCAM add-in selected. Open Settings > SolidCAM and pick one.");
    return;
  }
  ui.startCamBtn.disabled = true;
  const originalLabel = ui.startCamBtn.textContent;
  ui.startCamBtn.textContent = "Loading...";
  try {
    const result = await api.camAddinLoad();
    log(result?.ok ? "Loaded SolidCAM add-in." : "Loading SolidCAM add-in failed.", result);
    await refreshSolidCamLoadStatus({ force: true });
  } catch (error) {
    log("Loading SolidCAM add-in failed.", { error: error.message });
  } finally {
    ui.startCamBtn.disabled = false;
    ui.startCamBtn.textContent = originalLabel;
  }
}

async function reloadCurrentCamDoc() {
  if (!ui.reloadCamDocBtn) return;
  const originalLabel = ui.reloadCamDocBtn.textContent;
  ui.reloadCamDocBtn.disabled = true;
  ui.reloadCamDocBtn.textContent = "Reloading...";
  try {
    const result = await api.reloadCurrentDoc();
    setStatus(result);
    const loadedFirst = result?.solidCamLoadBeforeReload?.safeLoadMode
      && result.solidCamLoadBeforeReload.safeLoadMode !== "already-loaded";
    log(result?.ok
      ? (loadedFirst ? "Loaded SolidCAM and reloaded current SOLIDWORKS document." : "Reloaded current SOLIDWORKS document.")
      : "CAM reload failed.", result);
    await refreshSolidWorksStatus();
    await refreshSolidCamLoadStatus({ force: true });
  } catch (error) {
    log("CAM reload failed.", { error: error.message });
  } finally {
    ui.reloadCamDocBtn.disabled = false;
    ui.reloadCamDocBtn.textContent = originalLabel;
  }
}

async function stopCamAddin() {
  if (!ui.stopCamBtn) return;
  const cam = state.solidCamSettings || {};
  if (!cam.selectedDllPath) {
    log("No SolidCAM add-in selected. Open Settings > SolidCAM and pick one.");
    return;
  }
  ui.stopCamBtn.disabled = true;
  const originalLabel = ui.stopCamBtn.textContent;
  ui.stopCamBtn.textContent = "Saving...";
  try {
    const closeResult = await api.camSaveCloseDocs();
    log(closeResult?.ok ? "Saved and closed CAM documents before unload." : "CAM document save/close failed; unload skipped.", closeResult);
    if (!closeResult?.ok) return;
    ui.stopCamBtn.textContent = "Unloading...";
    const result = await api.camAddinUnload();
    log(result?.ok ? "Unloaded SolidCAM add-in." : "Unloading SolidCAM add-in failed.", result);
    await refreshSolidCamLoadStatus({ force: true });
  } catch (error) {
    log("Stopping SolidCAM failed.", { error: error.message });
  } finally {
    ui.stopCamBtn.disabled = false;
    ui.stopCamBtn.textContent = originalLabel;
  }
}

function localizedSettingsAction(action) {
  if (currentUiLanguage !== "hu") return `Settings ${action}.`;
  const exact = {
    loaded: "Settings loaded.",
    saved: "Settings saved.",
    imported: "Settings imported.",
    "reset to defaults": "Settings reset to defaults.",
  };
  if (exact[action]) return t(exact[action]);
  if (action.endsWith(" reset")) {
    const group = action.slice(0, -" reset".length);
    const groupLabels = {
      language: "Language",
      hotkeys: "Hotkeys",
      activity: "SOLIDWORKS Activity",
      erp: "ERP Worklog Export",
      cam: "CAM Folder",
      gcode: "G-code Checker",
      "search-locations": "Search locations",
      "project-locations": "Project locations",
      macros: "Macro defaults",
      solidcam: "SolidCAM",
    };
    return `${t("Settings group reset:")} ${t(groupLabels[group] || group)}.`;
  }
  return t("Settings saved.");
}

function renderSettingsState(result, action = "loaded") {
  state.lastSettingsState = { result, action };
  const settingsPath = result?.path || state.settingsPath || "Documents\\Excelsis Helper\\settings.json";
  const macro = result?.macroSettings || result?.macroLanguage;
  const macroLine = macro
    ? `\nMacro settings synchronized; updated ${macro.updated?.length || 0} macro file(s).`
    : "";
  const warningLine = macro?.warnings?.length
    ? `\nWarnings:\n${macro.warnings.join("\n")}`
    : "";
  ui.settingsState.textContent = `${localizedSettingsAction(action)}\n${t("Settings file:")} ${settingsPath}${macroLine}${warningLine}`;
  ui.settingsState.classList.toggle("muted", !warningLine);
}

function renderCacheStats(result) {
  if (!ui.settingsCacheState) return;
  state.lastCacheStats = result;
  if (!result?.ok) {
    ui.settingsCacheState.textContent = `${t("Cache size check failed:")} ${result?.error || "unknown error"}`;
    ui.settingsCacheState.classList.remove("muted");
    return;
  }
  const doc = result.docSearch || {};
  const thumbs = result.recentThumbnails || {};
  const updated = doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : t("never");
  ui.settingsCacheState.textContent = [
    `${t("Total cache:")} ${result.formattedTotalBytes || "0 B"}`,
    `${t("Doc Search:")} ${doc.formattedBytes || "0 B"}; ${doc.entries || 0} ${t("indexed files; updated")} ${updated}`,
    `${t("Recent thumbnails:")} ${thumbs.formattedBytes || "0 B"}; ${thumbs.files || 0} ${t("files")}`,
    `${t("Background workers:")} ${result.workers?.active ?? 0}/${result.workers?.max ?? 3} ${t("active;")} ${result.workers?.queued ?? 0} ${t("queued")}`,
    `${t("Doc Search path:")} ${doc.root || ""}`,
  ].join("\n");
  ui.settingsCacheState.classList.add("muted");
}

async function refreshCacheStats() {
  if (!ui.settingsCacheState || typeof api.cacheStats !== "function") return;
  try {
    const result = await api.cacheStats();
    renderCacheStats(result);
  } catch (error) {
    renderCacheStats({ ok: false, error: error.message });
  }
}

async function loadSettings() {
  try {
    const result = await api.getSettings();
    if (!result.ok) throw new Error(result.error || "Settings load failed.");
    state.settings = result.settings;
    state.defaults = result.defaults || null;
    state.settingsPath = result.path || "";
    renderSettings(state.settings);
    refreshSolidCamLoadStatus({ force: true });
    renderSettingsState(result, "loaded");
    refreshCacheStats().catch(() => {});
  } catch (error) {
    ui.settingsState.textContent = `${t("Settings load failed:")} ${error.message}`;
    ui.settingsState.classList.remove("muted");
  }
}

async function saveSettings() {
  ui.settingsSaveBtn.disabled = true;
  try {
    const result = await api.saveSettings(validateRequiredSettingsPaths(readSettingsForm()));
    if (!result.ok) throw new Error(result.error || "Settings save failed.");
    state.settings = result.settings;
    state.defaults = result.defaults || state.defaults;
    state.settingsPath = result.path || "";
    renderSettings(state.settings);
    renderSettingsState(result, "saved");
    log("Settings saved.", {
      settingsPath: result.path,
      bomExportLanguage: result.settings?.bomExportLanguage,
      hotkeys: result.settings?.hotkeys,
      activity: result.settings?.activity,
      cam: result.settings?.cam,
      macroSettings: result.macroSettings || result.macroLanguage,
    });
  } catch (error) {
    ui.settingsState.textContent = `${t("Settings save failed:")} ${error.message}`;
    ui.settingsState.classList.remove("muted");
    log("Settings save failed.", { error: error.message });
  } finally {
    ui.settingsSaveBtn.disabled = false;
  }
}

async function importSettings() {
  if (!ui.settingsImportBtn) return;
  ui.settingsImportBtn.disabled = true;
  try {
    const result = await api.importSettings();
    if (result?.canceled) {
      ui.settingsState.textContent = t("Settings import canceled.");
      ui.settingsState.classList.add("muted");
      return;
    }
    if (!result?.ok) throw new Error(result?.error || "Settings import failed.");
    state.settings = result.settings;
    state.defaults = result.defaults || state.defaults;
    state.settingsPath = result.path || state.settingsPath;
    renderSettings(state.settings);
    renderSettingsState(result, "imported");
    log("Settings imported.", {
      importedFrom: result.importedFrom,
      backupPath: result.backupPath,
    });
  } catch (error) {
    ui.settingsState.textContent = `${t("Settings import failed:")} ${error.message}`;
    ui.settingsState.classList.remove("muted");
    log("Settings import failed.", { error: error.message });
  } finally {
    ui.settingsImportBtn.disabled = false;
  }
}

async function exportSettings() {
  if (!ui.settingsExportBtn) return;
  ui.settingsExportBtn.disabled = true;
  try {
    const result = await api.exportSettings();
    if (result?.canceled) {
      ui.settingsState.textContent = t("Settings export canceled.");
      ui.settingsState.classList.add("muted");
      return;
    }
    if (!result?.ok) throw new Error(result?.error || "Settings export failed.");
    ui.settingsState.textContent = `${t("Settings exported.")}\n${t("File:")} ${result.exportedTo}`;
    ui.settingsState.classList.add("muted");
    log("Settings exported.", { exportedTo: result.exportedTo });
  } catch (error) {
    ui.settingsState.textContent = `${t("Settings export failed:")} ${error.message}`;
    ui.settingsState.classList.remove("muted");
    log("Settings export failed.", { error: error.message });
  } finally {
    ui.settingsExportBtn.disabled = false;
  }
}

async function resetSettingsGroup(group, button = null) {
  if (!applySettingsGroupDefaults(group)) return;
  if (button) button.disabled = true;
  if (ui.settingsSaveBtn) ui.settingsSaveBtn.disabled = true;
  try {
    const result = await api.saveSettings(validateRequiredSettingsPaths(readSettingsForm()));
    if (!result.ok) throw new Error(result.error || "Settings save failed.");
    state.settings = result.settings;
    state.defaults = result.defaults || state.defaults;
    state.settingsPath = result.path || "";
    renderSettings(state.settings);
    renderSettingsState(result, `${group} reset`);
    log("Settings group reset.", { group, settingsPath: result.path, hotkeys: result.settings?.hotkeys });
  } catch (error) {
    ui.settingsState.textContent = `${t("Settings group reset failed:")} ${error.message}`;
    ui.settingsState.classList.remove("muted");
    log("Settings group reset failed.", { group, error: error.message });
  } finally {
    if (button) button.disabled = false;
    if (ui.settingsSaveBtn) ui.settingsSaveBtn.disabled = false;
  }
}

async function resetSettings() {
  ui.settingsResetBtn.disabled = true;
  try {
    const result = await api.resetSettings();
    if (!result.ok) throw new Error(result.error || "Settings reset failed.");
    state.settings = result.settings;
    state.defaults = result.defaults || state.defaults;
    state.settingsPath = result.path || "";
    renderSettings(state.settings);
    renderSettingsState(result, "reset to defaults");
    log("Settings reset to defaults.", {
      settingsPath: result.path,
      settings: result.settings,
      macroSettings: result.macroSettings || result.macroLanguage,
    });
  } catch (error) {
    ui.settingsState.textContent = `${t("Settings reset failed:")} ${error.message}`;
    ui.settingsState.classList.remove("muted");
    log("Settings reset failed.", { error: error.message });
  } finally {
    ui.settingsResetBtn.disabled = false;
  }
}

// ---------- Boot ----------

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

setStatus(null);
refreshDriveMapFromMain();
refreshSolidWorksStatus();
refreshSolidCamLoadStatus();
// Poll costs (updated 1.1.0): work-logger time tracking lives in the MAIN
// process heartbeat since 0.8.2/0.8.4 (persistent watcher), so the renderer's
// SOLIDWORKS status poll and the drive-map poll are cheap cached IPC reads and
// can stay unconditional (they also keep the header status fresh the moment the
// window is shown). The SolidCAM status poll is different: it spawns a
// PowerShell (sw-addin-status.ps1) per tick and paints a purely cosmetic badge,
// so it IS gated on visibility — hidden tray window means no spawn churn. The
// visibilitychange handler below refreshes it immediately on show. (Historical
// Never gate a poll that accrues time while the window is hidden.)
setInterval(() => refreshSolidWorksStatus(), SOLIDWORKS_STATUS_INTERVAL_MS);
setInterval(() => { if (!document.hidden) refreshSolidCamLoadStatus(); }, SOLIDCAM_STATUS_INTERVAL_MS);
setInterval(() => refreshDriveMapFromMain(), 60000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state.docSearchPollTimer) clearTimeout(state.docSearchPollTimer);
    if (state.recentDocsRefreshTimer) clearTimeout(state.recentDocsRefreshTimer);
    state.docSearchPollTimer = null;
    state.recentDocsRefreshTimer = null;
    return;
  }
  refreshSolidCamLoadStatus();
  if (document.getElementById("recentDocsView")?.classList.contains("active")) {
    scheduleRecentDocsRefresh(0);
  }
  if (document.getElementById("docSearchView")?.classList.contains("active")) {
    scheduleDocSearchRefresh(0, { page: state.docSearchPage });
  }
  if (document.getElementById("workLoggerView")?.classList.contains("active")) {
    refreshWorkLoggerList().catch(() => {});
  }
});
document.addEventListener("click", hideRecentDocContextMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideRecentDocContextMenu();
    setWorklogExportDialogOpen(false);
  }
});
window.addEventListener("scroll", hideRecentDocContextMenu, true);
const recentDocsScroller = recentDocsScrollContainer();
if (recentDocsScroller) {
  recentDocsScroller.addEventListener("scroll", maybeLoadMoreRecentDocs, { passive: true });
  recentDocsScroller.addEventListener("scroll", maybeLoadMoreWorklogs, { passive: true });
}
window.addEventListener("resize", maybeLoadMoreRecentDocs);
window.addEventListener("resize", maybeLoadMoreWorklogs);

if (ui.recentDocsFilter) {
  ui.recentDocsFilter.addEventListener("change", () => {
    recentDocsState.filter = ui.recentDocsFilter.value;
    recentDocsState.showAll = false;
    recentDocsState.lastSignature = "";
    recentDocsState.resetRender = true;
    refreshRecentDocsList();
  });
}
if (ui.showAllRecentDocsBtn) {
  ui.showAllRecentDocsBtn.addEventListener("click", () => {
    recentDocsState.showAll = true;
    recentDocsState.lastSignature = "";
    recentDocsState.resetRender = true;
    refreshRecentDocsList();
  });
}
if (ui.recentDocsSearch) {
  let searchDebounce = null;
  ui.recentDocsSearch.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      recentDocsState.search = ui.recentDocsSearch.value;
      recentDocsState.lastSignature = "";
      recentDocsState.resetRender = true;
      refreshRecentDocsList();
    }, 90);
  });
}
if (ui.refreshRecentDocsBtn) {
  ui.refreshRecentDocsBtn.addEventListener("click", () => {
    recentDocsState.lastSignature = "";
    recentDocsState.resetRender = true;
    refreshRecentDocsList();
  });
}
if (ui.retryThumbnailsBtn) {
  ui.retryThumbnailsBtn.addEventListener("click", async () => {
    ui.retryThumbnailsBtn.disabled = true;
    const originalLabel = ui.retryThumbnailsBtn.textContent;
    ui.retryThumbnailsBtn.textContent = "Retrying...";
    try {
      const result = await api.retryRecentDocThumbnails();
      const blankNote = result?.blankRegenerated ? ` (incl. ${result.blankRegenerated} blank)` : "";
      log(`Retrying ${result?.queued || 0} missing/blank thumbnails${blankNote}. Kept ${result?.cachedKept || 0} cached thumbnails.`);
      recentDocsState.lastSignature = "";
      recentDocsState.resetRender = true;
      await refreshRecentDocsList();
    } catch (error) {
      log("Retry thumbnails failed.", { error: error.message });
    } finally {
      ui.retryThumbnailsBtn.disabled = false;
      ui.retryThumbnailsBtn.textContent = originalLabel;
    }
  });
}
refreshRecentDocsList();

if (ui.refreshWorkLoggerBtn) {
  ui.refreshWorkLoggerBtn.addEventListener("click", () => {
    workLoggerState.lastSignature = `refresh:${Date.now()}`;
    refreshWorkLoggerList().catch(() => {});
  });
}
if (ui.exportWorkLoggerBtn) {
  ui.exportWorkLoggerBtn.addEventListener("click", () => {
    openWorklogExportDialog().catch((error) => {
      log("Work Logger export dialog failed.", { error: error.message });
    });
  });
}
if (ui.exportLastDayWorkLoggerBtn) {
  ui.exportLastDayWorkLoggerBtn.addEventListener("click", async () => {
    if (typeof api.getLastWorklogBackup !== "function") return;
    ui.exportLastDayWorkLoggerBtn.disabled = true;
    try {
      const backup = await api.getLastWorklogBackup();
      if (!backup?.ok || !backup.available || !(backup.projects || []).length) {
        workLoggerState.lastDayBackup = null;
        log("No recoverable last-day work log was found.", backup || {});
        return;
      }
      workLoggerState.lastDayBackup = backup;
      await openWorklogExportDialog({ lastDay: true, projects: backup.projects });
    } catch (error) {
      log("Export last day failed to open.", { error: error.message });
    } finally {
      refreshLastDayAvailability().catch(() => {});
    }
  });
}
if (ui.setWorklogExportBtn) {
  ui.setWorklogExportBtn.addEventListener("click", async () => {
    if (typeof api.saveWorklogExportRules !== "function") return;
    const rules = readWorklogExportRules({ includeTransient: false });
    ui.setWorklogExportBtn.disabled = true;
    try {
      const result = await api.saveWorklogExportRules(rules);
      if (ui.worklogExportState) {
        ui.worklogExportState.textContent = result?.ok
          ? "Settings saved. They'll load for the next export."
          : `Could not save settings: ${result?.error || "unknown error"}.`;
        ui.worklogExportState.classList.remove("muted");
      }
      log("Saved Work Logger export settings.", { ok: result?.ok, rules: result?.rules });
    } catch (error) {
      log("Saving export settings failed.", { error: error.message });
    } finally {
      ui.setWorklogExportBtn.disabled = false;
    }
  });
}
if (ui.closeWorklogExportBtn) {
  ui.closeWorklogExportBtn.addEventListener("click", () => setWorklogExportDialogOpen(false));
}
if (ui.cancelWorklogExportBtn) {
  ui.cancelWorklogExportBtn.addEventListener("click", () => setWorklogExportDialogOpen(false));
}
if (ui.worklogExportDialog) {
  ui.worklogExportDialog.addEventListener("click", (event) => {
    if (event.target === ui.worklogExportDialog) setWorklogExportDialogOpen(false);
  });
}
for (const input of [ui.worklogExportCutoffMinutes, ui.worklogExportMultiplier, ui.worklogExportRoundToMinutes, ui.worklogExportTargetHoursMode, ui.worklogExportTargetHours]) {
  input?.addEventListener("input", updateWorklogExportControls);
  input?.addEventListener("change", updateWorklogExportControls);
}
for (const input of [ui.worklogExportDefaultWorkType, ui.worklogExportSecondWorkType]) {
  input?.addEventListener("change", () => {
    if (input === ui.worklogExportDefaultWorkType && !ui.worklogExportSplitByWorkType?.checked) {
      populateWorklogWorkTypeSelect(ui.worklogExportSecondWorkType, ui.worklogExportDefaultWorkType.value);
    }
    updateWorklogExportControls();
  });
}
for (const input of [ui.worklogExportPerProjectWorkTypes, ui.worklogExportSplitByWorkType]) {
  input?.addEventListener("change", () => {
    if (input === ui.worklogExportSplitByWorkType && ui.worklogExportSplitByWorkType.checked && ui.worklogExportSecondWorkType) {
      populateWorklogWorkTypeSelect(ui.worklogExportSecondWorkType, ui.worklogExportSecondWorkType.value || ui.worklogExportDefaultWorkType?.value);
    }
    updateWorklogExportControls();
  });
}
if (ui.worklogExportForm) {
  ui.worklogExportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const lastDay = workLoggerState.lastDayMode;
    const exporter = lastDay ? api.exportLastDayWorklogs : api.exportWorklogs;
    if (typeof exporter !== "function") {
      if (ui.worklogExportState) {
        ui.worklogExportState.textContent = "Export needs the updated app preload. Restart Excelsis Helper.";
        ui.worklogExportState.classList.remove("muted");
      }
      return;
    }
    const rules = readWorklogExportRules();
    const originalLabel = ui.confirmWorklogExportBtn?.textContent || "Export";
    if (ui.confirmWorklogExportBtn) {
      ui.confirmWorklogExportBtn.disabled = true;
      ui.confirmWorklogExportBtn.textContent = "Exporting...";
    }
    if (ui.worklogExportState) {
      ui.worklogExportState.textContent = "";
      ui.worklogExportState.classList.add("muted");
    }
    try {
      const result = await exporter(rules);
      if (!result?.ok) {
        if (ui.worklogExportState) {
          ui.worklogExportState.textContent = result?.error || "Nothing was exported.";
          ui.worklogExportState.classList.remove("muted");
        }
        log("Work Logger export was not written.", result);
        updateWorklogExportControls();
        return;
      }
      setWorklogExportDialogOpen(false);
      if (!lastDay && result.autoExport) renderAutoExportStatus(result.autoExport);
      log(lastDay ? "Exported recovered last-day work logs." : "Exported Work Logger batch.", {
        path: result.path,
        entries: result.count,
        skipped: result.skippedCount,
        hours: result.exportedHours,
        recovered: Boolean(result.recovered),
        rules: result.rules,
      });
      workLoggerState.lastSignature = `export:${Date.now()}`;
      await refreshWorkLoggerList();
      await refreshLastDayAvailability().catch(() => {});
    } catch (error) {
      if (ui.worklogExportState) {
        ui.worklogExportState.textContent = `Export failed: ${error.message}`;
        ui.worklogExportState.classList.remove("muted");
      }
      log("Work Logger export failed.", { error: error.message });
    } finally {
      if (ui.confirmWorklogExportBtn) {
        ui.confirmWorklogExportBtn.disabled = false;
        ui.confirmWorklogExportBtn.textContent = originalLabel;
      }
      if (ui.worklogExportDialog && !ui.worklogExportDialog.classList.contains("hidden")) {
        updateWorklogExportControls();
      }
    }
  });
}
if (ui.resetWorkLoggerBtn) {
  ui.resetWorkLoggerBtn.addEventListener("click", async () => {
    const ok = window.confirm("Reset today's Work Logger totals? CAD files and recent documents are not deleted.");
    if (!ok) return;
    const originalLabel = ui.resetWorkLoggerBtn.textContent;
    ui.resetWorkLoggerBtn.disabled = true;
    ui.resetWorkLoggerBtn.textContent = "Resetting...";
    try {
      const result = await api.resetWorklogsToday();
      workLoggerState.lastSignature = `reset:${Date.now()}`;
      workLoggerState.entries = [];
      workLoggerState.renderedCount = 0;
      workLoggerState.path = result?.path || workLoggerState.path;
      workLoggerState.activeDate = result?.activeDate || workLoggerState.activeDate;
      if (ui.workLoggerList) ui.workLoggerList.replaceChildren();
      renderWorkLogger([], result || {});
      log("Reset today's Work Logger totals.", {
        removedProjects: result?.removedProjects || 0,
        removedMinutes: Math.round(Number(result?.removedMs || 0) / 60000),
        activeDate: result?.activeDate,
      });
    } catch (error) {
      log("Work Logger reset failed.", { error: error.message });
    } finally {
      ui.resetWorkLoggerBtn.disabled = false;
      ui.resetWorkLoggerBtn.textContent = originalLabel;
    }
  });
}
if (typeof api.onAutoExportLog === "function") {
  api.onAutoExportLog((payload) => {
    if (!payload) return;
    log(`[Auto-export] ${payload.message}`, payload.data || undefined);
    if (document.getElementById("workLoggerView")?.classList.contains("active")) {
      refreshWorkLoggerList().catch(() => {});
    }
  });
}
if (typeof api.onThumbnailsChanged === "function") {
  api.onThumbnailsChanged(() => {
    if (document.hidden) return;
    if (document.getElementById("recentDocsView")?.classList.contains("active")) {
      scheduleRecentDocsRefresh(100);
    }
    if (document.getElementById("docSearchView")?.classList.contains("active")) {
      state.docSearchLastSignature = "";
      scheduleDocSearchRefresh(100, { page: state.docSearchPage });
    }
  });
}
if (typeof api.onRecentDocsChanged === "function") {
  api.onRecentDocsChanged(() => {
    if (!document.hidden && document.getElementById("recentDocsView")?.classList.contains("active")) {
      scheduleRecentDocsRefresh(100);
    }
  });
}
if (typeof api.onDocSearchChanged === "function") {
  api.onDocSearchChanged(() => {
    if (!document.hidden && document.getElementById("docSearchView")?.classList.contains("active")) {
      state.docSearchLastSignature = "";
      scheduleDocSearchRefresh(100, { page: state.docSearchPage });
    }
  });
}
if (ui.worklogAutoExportSkip) {
  ui.worklogAutoExportSkip.addEventListener("change", async () => {
    if (typeof api.setAutoExportSkip !== "function") return;
    const skip = ui.worklogAutoExportSkip.checked;
    ui.worklogAutoExportSkip.disabled = true;
    try {
      const result = await api.setAutoExportSkip(skip);
      if (result?.autoExport) renderAutoExportStatus(result.autoExport);
      log(skip ? "Auto-export skipped for tonight." : "Auto-export re-enabled for tonight.");
    } catch (error) {
      log("Could not change auto-export skip.", { error: error.message });
    } finally {
      ui.worklogAutoExportSkip.disabled = false;
    }
  });
}

if (ui.docSearchInput) {
  ui.docSearchInput.addEventListener("input", () => {
    state.docSearchRequestSeq++;
    clearDocSearchTiles("Searching...");
    scheduleDocSearchRefresh(250);
  });
}

if (ui.docSearchTypeFilter) {
  ui.docSearchTypeFilter.addEventListener("change", () => {
    state.docSearchRequestSeq++;
    clearDocSearchTiles("Loading filtered results...");
    scheduleDocSearchRefresh(0);
  });
}

if (ui.docSearchPrevPageBtn) {
  ui.docSearchPrevPageBtn.addEventListener("click", () => {
    if (state.docSearchPage <= 0 || state.docSearchInFlight) return;
    refreshDocSearch({ page: state.docSearchPage - 1 }).catch(() => {});
  });
}

if (ui.docSearchNextPageBtn) {
  ui.docSearchNextPageBtn.addEventListener("click", () => {
    if (!state.docSearchHasMore || state.docSearchInFlight) return;
    refreshDocSearch({ page: state.docSearchPage + 1 }).catch(() => {});
  });
}

ui.navButtons.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

if (ui.refreshGcodeBtn) ui.refreshGcodeBtn.addEventListener("click", () => refreshGcodeView().catch(() => {}));
if (ui.gcodeChangeFileBtn) {
  ui.gcodeChangeFileBtn.addEventListener("click", () => {
    state.gcodeListCollapsed = false;
    applyGcodeListVisibility();
    refreshGcodeView().catch(() => {});
  });
}
if (ui.gcodeAnalyzeBtn) ui.gcodeAnalyzeBtn.addEventListener("click", () => runGcodeAnalyze().catch(() => {}));
if (ui.gcodeMethodAiBtn) ui.gcodeMethodAiBtn.addEventListener("click", () => setGcodeMethod("ai"));
if (ui.gcodeMethodLocalBtn) ui.gcodeMethodLocalBtn.addEventListener("click", () => setGcodeMethod("local"));
if (ui.gcodeMaterialFamilyInput) {
  ui.gcodeMaterialFamilyInput.addEventListener("change", () => {
    if (ui.gcodeMaterialGradeInput) ui.gcodeMaterialGradeInput.value = "";
    loadGcodeMaterialOptions().catch(() => {});
  });
}
if (ui.gcodeLocalInputs) {
  ui.gcodeLocalInputs.addEventListener("input", markGcodeLocalControlsDirty);
  ui.gcodeLocalInputs.addEventListener("change", markGcodeLocalControlsDirty);
}
if (ui.gcodeLocalAnalyzeBtn) ui.gcodeLocalAnalyzeBtn.addEventListener("click", () => runGcodeLocalAnalysis(false).catch(() => {}));
if (ui.gcodeLocalRecalculateBtn) ui.gcodeLocalRecalculateBtn.addEventListener("click", () => runGcodeLocalAnalysis(true).catch(() => {}));
if (ui.gcodeLocalUpdateEstimateBtn) ui.gcodeLocalUpdateEstimateBtn.addEventListener("click", () => updateGcodeLocalEstimate().catch(() => {}));
if (ui.gcodeLocalCreateCopyBtn) ui.gcodeLocalCreateCopyBtn.addEventListener("click", () => createGcodeOptimizedCopy().catch(() => {}));
if (ui.gcodeOpenChecksFolderBtn) {
  ui.gcodeOpenChecksFolderBtn.addEventListener("click", async () => {
    const result = await api.gcodeOpenChecksFolder().catch(() => null);
    if (!result?.ok) log(`Could not open checks folder: ${result?.error || "unknown error"}`);
  });
}
if (ui.killSolidWorksBtn) ui.killSolidWorksBtn.addEventListener("click", killSolidWorks);
if (ui.copyDocLocationBtn) ui.copyDocLocationBtn.addEventListener("click", copyCurrentDocLocation);
if (ui.createCamFolderBtn) ui.createCamFolderBtn.addEventListener("click", createCamFolder);
ui.refreshMacroTilesBtn.addEventListener("click", refreshMacroTiles);
ui.openMacroFolderBtn.addEventListener("click", openMacroFolder);

ui.settingsSaveBtn.addEventListener("click", saveSettings);
ui.settingsResetBtn.addEventListener("click", resetSettings);
if (ui.settingsImportBtn) ui.settingsImportBtn.addEventListener("click", importSettings);
if (ui.settingsExportBtn) ui.settingsExportBtn.addEventListener("click", exportSettings);
ui.settingsGroupResetButtons.forEach((button) => {
  button.addEventListener("click", () => resetSettingsGroup(button.dataset.settingsReset, button));
});
if (ui.settingsUiLanguage) {
  // Live-preview the UI language as soon as it's changed (before Save).
  ui.settingsUiLanguage.addEventListener("change", () => {
    applyUiLanguage(ui.settingsUiLanguage.value);
    if (state.lastSettingsState) {
      renderSettingsState(state.lastSettingsState.result, state.lastSettingsState.action);
    }
    if (state.lastCacheStats) renderCacheStats(state.lastCacheStats);
  });
}

if (ui.searchCamAddinsBtn) ui.searchCamAddinsBtn.addEventListener("click", searchCamAddins);
if (ui.startCamBtn) ui.startCamBtn.addEventListener("click", startCamAddin);
if (ui.reloadCamDocBtn) ui.reloadCamDocBtn.addEventListener("click", reloadCurrentCamDoc);
if (ui.stopCamBtn) ui.stopCamBtn.addEventListener("click", stopCamAddin);
if (ui.deleteDocSearchCacheBtn) {
  ui.deleteDocSearchCacheBtn.addEventListener("click", async () => {
    const ok = window.confirm("Delete only the Excelsis Helper Doc Search index cache? Source files are not touched.");
    if (!ok) return;
    const originalLabel = ui.deleteDocSearchCacheBtn.textContent;
    ui.deleteDocSearchCacheBtn.disabled = true;
    ui.deleteDocSearchCacheBtn.textContent = "Deleting...";
    try {
      const result = await api.deleteDocSearchCache();
      log(result?.ok ? "Doc Search index cache deleted." : "Doc Search cache delete failed.", result);
      state.docSearchLastSignature = "";
      if (ui.docSearchList) ui.docSearchList.replaceChildren();
      if (ui.docSearchState) ui.docSearchState.textContent = "Index cache deleted. Background indexing will rebuild it automatically.";
      refreshCacheStats().catch(() => {});
    } catch (error) {
      log("Doc Search cache delete failed.", { error: error.message });
    } finally {
      ui.deleteDocSearchCacheBtn.disabled = false;
      ui.deleteDocSearchCacheBtn.textContent = originalLabel;
    }
  });
}

ui.clearLogBtn.addEventListener("click", () => {
  ui.logOutput.textContent = "";
});

async function applySidebarImage() {
  try {
    const result = await api.pickSidebarImage();
    if (result?.ok && result.url) {
      ui.sidebarBottomImage.src = result.url;
      ui.sidebarBottom.classList.add("has-image");
      return;
    }
  } catch {}
  ui.sidebarBottom.classList.remove("has-image");
  ui.sidebarBottomImage.removeAttribute("src");
}

async function renderAppVersion() {
  if (!ui.appVersion) return;
  try {
    const version = await api.getAppVersion?.();
    ui.appVersion.textContent = version ? `v${version}` : "";
  } catch {
    ui.appVersion.textContent = "";
  }
}

refreshMacroTiles();
loadSettings();
applySidebarImage();
renderAppVersion();
