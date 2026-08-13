(function installRendererHarness() {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const calls = [];
  const callbacks = Object.create(null);
  const defaults = {
    uiLanguage: "en",
    bomExportLanguage: "en",
    hotkeys: {
      enabled: true,
      pasteProjectDate: "Ctrl+Space",
      copyExplorerPath: "F7,F7",
      projectPrefix: "PRJ-",
      projectDateTemplate: "PRJ-[currentdate]",
      projectDateFormat: "yyyy.MM.dd",
    },
    activity: { solidWorksIdlePauseMinutes: 3 },
    diagnostics: { enabled: false },
    erp: {
      worklogInbox: "C:\\Mock\\ERP\\Inbox",
      worklogWorktypes: "C:\\Mock\\ERP\\worktypes.json",
      worklogDocMinMinutes: 5,
    },
    cam: {
      outputRoot: "C:\\Mock\\CAM",
      folderMode: "project-part",
      searchRoots: ["C:\\Mock\\Projects"],
    },
    macros: {
      drawingTemplate: "C:\\Mock\\Templates\\drawing.drwdot",
      dxfOutputPrefix: "PLATE",
      defaultMaterial: "MATERIAL",
    },
    solidCam: { selectedDllPath: "", selectedTitle: "", selectedClsid: "" },
    locations: {
      projectRootNames: ["Projects"],
      projectCodePrefixes: [],
      searchRoots: ["C:\\Mock\\Projects"],
      exclusions: ["C:\\Mock\\Projects\\Archive"],
    },
    gcode: {
      searchRoot: "C:\\Mock\\CAM",
      materials: ["Aluminium", "Steel"],
      toolMaterials: ["Carbide", "HSS", "HSS-Co"],
      defaultMillingToolMaterial: "Carbide",
      defaultDrillToolMaterial: "HSS",
      defaultTapToolMaterial: "HSS-Co",
      machineMaxRpm: 12000,
      machineMaxFeedMmMin: 9000,
      defaultAggressiveness: "balanced",
      defaultAePercent: 10,
      defaultCoolingMode: "flood",
      defaultContactMode: "side",
      defaultFluteCount: 2,
      optimizedSuffix: "_optimized",
    },
  };
  let settings = clone(defaults);
  const recentDocs = [
    { type: "part", title: "fixture-base.SLDPRT", path: "C:\\Demo\\Engineering\\Fixture A\\fixture-base.SLDPRT" },
    { type: "assembly", title: "fixture-a.SLDASM", path: "C:\\Demo\\Engineering\\Fixture A\\fixture-a.SLDASM" },
    { type: "drawing", title: "fixture-base.SLDDRW", path: "C:\\Demo\\Engineering\\Fixture A\\Drawings\\fixture-base.SLDDRW" },
    { type: "solidcam", title: "fixture-a.prz", path: "C:\\Demo\\CAM\\Fixture A\\fixture-a.prz" },
    { type: "part", title: "clamp-block.SLDPRT", path: "C:\\Demo\\Engineering\\Fixture B\\clamp-block.SLDPRT" },
    { type: "assembly", title: "fixture-b.SLDASM", path: "C:\\Demo\\Engineering\\Fixture B\\fixture-b.SLDASM" },
    { type: "drawing", title: "clamp-block.SLDDRW", path: "C:\\Demo\\Engineering\\Fixture B\\Drawings\\clamp-block.SLDDRW" },
    { type: "part", title: "locator-pin.SLDPRT", path: "C:\\Demo\\Engineering\\Fixture C\\locator-pin.SLDPRT" },
  ];
  for (let index = recentDocs.length + 1; index <= 75; index++) {
    const number = String(index).padStart(3, "0");
    const type = index % 3 === 0 ? "drawing" : (index % 3 === 1 ? "part" : "assembly");
    const extension = type === "drawing" ? "SLDDRW" : (type === "part" ? "SLDPRT" : "SLDASM");
    recentDocs.push({
      type,
      title: `history-${number}.${extension}`,
      path: `C:\\Demo\\Engineering\\History\\history-${number}.${extension}`,
    });
  }
  const documentSearchEntries = [
    ...recentDocs.slice(0, 3),
    { name: "fixture-setup.PDF", path: "C:\\Demo\\Engineering\\Fixture A\\Documentation\\fixture-setup.PDF" },
    { name: "fixture-base.DXF", path: "C:\\Demo\\Engineering\\Fixture A\\DXF\\fixture-base.DXF" },
    { name: "fixture-base.MPF", path: "C:\\Demo\\CAM\\Fixture A\\fixture-base.MPF" },
    { name: "setup-notes.TXT", path: "C:\\Demo\\Engineering\\Fixture A\\Documentation\\setup-notes.TXT" },
    { name: "fixture-base-rev-b.SLDPRT", path: "C:\\Demo\\Engineering\\Fixture A\\Revisions\\fixture-base-rev-b.SLDPRT" },
  ];
  const macroTiles = [
    { id: "bom", name: "BOM_v19", displayName: "BOM Export", filePath: "C:\\Demo\\Macros\\BOM_v19.swp", relativePath: "BOM_v19.swp", description: "Export the active assembly bill of materials." },
    { id: "dxf", name: "DXF_v16", displayName: "DXF Export", filePath: "C:\\Demo\\Macros\\DXF_v16.swp", relativePath: "DXF_v16.swp", description: "Create configured DXF output from the active drawing." },
    { id: "cncdxf", name: "CNCDXF_v1", displayName: "CNC DXF", filePath: "C:\\Demo\\Macros\\CNCDXF_v1.swp", relativePath: "CNCDXF_v1.swp", description: "Prepare DXF output for the configured CAM folder." },
    { id: "radius", name: "Radius_v9", displayName: "Radius Tools", filePath: "C:\\Demo\\Macros\\Radius_v9.swp", relativePath: "Radius_v9.swp", description: "Apply the project radius workflow to selected geometry." },
    { id: "diagnostic", name: "CrawlScrews_v1", displayName: "CAD Diagnostic", filePath: "C:\\Demo\\Macros\\CrawlScrews_v1.swp", relativePath: "CrawlScrews_v1.swp", description: "Create an opt-in local diagnostic bundle after confirmation." },
  ];
  const worklogs = [
    {
      key: "project-alpha",
      name: "Project Alpha",
      totalMs: 93 * 60 * 1000,
      minutes: 93,
      hours: 1.6,
      lastActiveAt: Date.now(),
      lastDocPath: "C:\\Mock\\Projects\\Project Alpha\\part-a.SLDPRT",
      exportDocs: ["part-a.SLDPRT"],
    },
    {
      key: "project-beta",
      name: "Project Beta",
      totalMs: 38 * 60 * 1000,
      minutes: 38,
      hours: 0.6,
      lastActiveAt: Date.now() - 60000,
      lastDocPath: "C:\\Mock\\Projects\\Project Beta\\part-b.SLDASM",
      exportDocs: ["part-b.SLDASM"],
    },
  ];
  let savedWorklogRules = {
    cutoffMinutes: 9,
    multiplier: 1,
    roundToMinutes: 30,
    defaultWorkType: "Design/CAM",
    perProjectWorkTypes: false,
    splitByWorkType: false,
    splitWorkTypes: ["Design/CAM", "Machining"],
    projectWorkTypes: {},
    targetHoursMode: false,
    targetHours: 8,
  };
  let autoExportSkipped = false;

  function record(name, args) {
    calls.push({ name, args: clone(args || []), at: Date.now() });
    document.documentElement.dataset.rendererHarnessCalls = JSON.stringify(calls);
  }

  function settingsResult(extra = {}) {
    return {
      ok: true,
      settings: clone(settings),
      defaults: clone(defaults),
      path: "C:\\Mock\\Excelsis Helper\\settings.json",
      ...extra,
    };
  }

  function baseProposal() {
    return {
      method: "local",
      inputErrors: [],
      materialResolution: { family: "aluminium", grade: "6061-T6", fallback: false },
      acceptedChangeCount: 4,
      canWrite: true,
      timeEstimate: {
        oldSeconds: 5400,
        newSeconds: 4320,
        deltaSeconds: -1080,
        percentChange: -20,
        source: "posted-plus-modeled-change",
        confidence: "provisional",
      },
      tools: [
        {
          id: "tool-1",
          label: "D10_ENDMILL",
          description: "Square end mill D10",
          process: "milling",
          toolType: "square_endmill",
          status: "provisional",
          missingInputs: [],
          warnings: [],
          controls: {
            toolMaterial: "Carbide",
            diameterMm: 10,
            fluteCount: 3,
            apMm: 2,
            apSource: "cutting_z_levels",
            apConfidence: "high",
            apEvidenceCount: 6,
            apMinimumMm: 2,
            apMaximumMm: 2,
            aePercent: 10,
          },
          recommendation: { levels: { target: { rpm: 8200, feed_mm_min: 1845 } } },
          changeGroups: [
            {
              id: "tool-1-rpm-6000",
              kind: "rpm",
              classification: "spindle",
              currentValues: [6000],
              proposedValue: 8200,
              calculatedValue: 8200,
              accepted: true,
              editable: true,
              step: 100,
              minimum: 100,
              maximum: 12000,
            },
            {
              id: "tool-1-feed-cutting-1200",
              kind: "feed",
              classification: "cutting",
              currentValues: [1200],
              proposedValue: 1845,
              calculatedValue: 1845,
              accepted: true,
              editable: true,
              step: 5,
              minimum: 5,
              maximum: 9000,
            },
          ],
        },
        {
          id: "tool-2",
          label: "DRILL_D6.8",
          description: "Twist drill D6.8",
          process: "drilling",
          toolType: "drill",
          status: "provisional",
          missingInputs: [],
          warnings: [],
          controls: {
            toolMaterial: "HSS",
            diameterMm: 6.8,
            fluteCount: 2,
            holeDepthMm: 20,
          },
          recommendation: { levels: { target: { rpm: 2400, feed_mm_min: 360 } } },
          changeGroups: [
            {
              id: "tool-2-feed-cycle-250",
              kind: "feed",
              classification: "canned_cycle",
              currentValues: [250],
              proposedValue: 360,
              calculatedValue: 360,
              accepted: true,
              editable: true,
              step: 5,
              minimum: 5,
              maximum: 9000,
            },
          ],
        },
        {
          id: "tool-3",
          label: "M8_TAP",
          description: "M8 cutting tap",
          process: "tapping",
          toolType: "tap",
          status: "provisional",
          missingInputs: [],
          warnings: [],
          controls: {
            toolMaterial: "HSS-Co",
            diameterMm: 8,
            threadDepthMm: 14,
            pitchMm: 1.25,
            operatorConfirmedPitchMm: 1.25,
            tapStyle: "cut",
            holeKind: "blind",
            preDrillDiameterMm: 6.8,
          },
          recommendation: { levels: { target: { rpm: 600, feed_mm_min: 750 } } },
          changeGroups: [
            {
              id: "tool-3-tap-rpm",
              kind: "tap_rpm",
              classification: "synchronized_tapping",
              currentValues: [400],
              proposedValue: 600,
              calculatedValue: 600,
              synchronizedFeedMmMin: 750,
              accepted: true,
              editable: true,
              step: 100,
              minimum: 100,
              maximum: 12000,
            },
          ],
        },
      ],
    };
  }

  function proposalWithSelections(selections, input) {
    const proposal = baseProposal();
    const byId = new Map((selections || []).map((item) => [item.id, item]));
    let accepted = 0;
    for (const tool of proposal.tools) {
      const override = input?.toolOverrides?.[tool.id];
      if (override) {
        Object.assign(tool.controls, override);
        if (tool.process === "milling" && Number(override.apMm) > 0) {
          tool.controls.apSource = "operator";
          tool.controls.apConfidence = "operator";
          tool.controls.apEvidenceCount = null;
        }
      }
      for (const group of tool.changeGroups) {
        const selection = byId.get(group.id);
        if (selection) {
          if (typeof selection.accepted === "boolean") group.accepted = selection.accepted;
          if (Number.isFinite(Number(selection.value))) group.proposedValue = Number(selection.value);
        }
        if (group.accepted && group.editable) accepted += 1;
      }
    }
    proposal.acceptedChangeCount = accepted;
    proposal.canWrite = accepted > 0;
    proposal.timeEstimate.newSeconds = 4320 + ((4 - accepted) * 180);
    proposal.timeEstimate.percentChange = Number((((proposal.timeEstimate.newSeconds / 5400) - 1) * 100).toFixed(1));
    return proposal;
  }

  const methods = {
    getSettings: async () => settingsResult(),
    saveSettings: async (next) => {
      record("saveSettings", [next]);
      settings = clone(next);
      return settingsResult();
    },
    resetSettings: async () => {
      record("resetSettings", []);
      settings = clone(defaults);
      return settingsResult();
    },
    importSettings: async () => {
      record("importSettings", []);
      settings = clone(defaults);
      settings.gcode.machineMaxRpm = 14500;
      settings.gcode.optimizedSuffix = "_imported";
      return settingsResult({
        importedFrom: "C:\\Mock\\import-settings.json",
        backupPath: "C:\\Mock\\settings.backup.json",
      });
    },
    exportSettings: async () => {
      record("exportSettings", []);
      return { ok: true, exportedTo: "C:\\Mock\\export-settings.json" };
    },
    listMacroTiles: async () => ({ ok: true, root: "C:\\Demo\\Macros", tiles: clone(macroTiles) }),
    pickSidebarImage: async () => ({ ok: false }),
    getAppVersion: async () => "1.4.9",
    cacheStats: async () => ({
      ok: true,
      formattedTotalBytes: "0 B",
      docSearch: { formattedBytes: "0 B", entries: 0, updatedAt: null, root: "C:\\Mock\\Cache" },
      recentThumbnails: { formattedBytes: "0 B", files: 0 },
      workers: { active: 0, max: 1, queued: 0 },
    }),
    solidWorksStatus: async () => ({
      ok: true,
      connected: true,
      solidWorksRunning: true,
      solidWorksHealth: { state: "healthy", label: "SW health: healthy", canKill: false },
      activeDocument: {
        hasActiveDocument: true,
        title: "fixture-base.SLDPRT",
        path: "C:\\Demo\\Engineering\\Fixture A\\fixture-base.SLDPRT",
      },
    }),
    listRecentDocs: async ({ filter = "all", query = "", showAll = false } = {}) => {
      record("listRecentDocs", [{ filter, query, showAll }]);
      const normalizedQuery = String(query || "").trim().toLowerCase();
      let filtered = filter === "all"
        ? recentDocs
        : recentDocs.filter((entry) => entry.type === filter);
      if (normalizedQuery) {
        filtered = filtered.filter((entry) =>
          `${entry.title} ${entry.path}`.toLowerCase().includes(normalizedQuery)
        );
      }
      const entries = (showAll || normalizedQuery) ? filtered : filtered.slice(0, 50);
      return {
        ok: true,
        entries: clone(entries),
        totalCount: recentDocs.length,
        filteredCount: filtered.length,
        limited: !showAll && !normalizedQuery && filtered.length > entries.length,
        limit: 50,
      };
    },
    copyDocumentPath: async (docPath) => {
      record("copyDocumentPath", [docPath]);
      return { ok: true, path: docPath, clipboardText: docPath, copiedToClipboard: true };
    },
    copyDocumentName: async (docPath) => {
      record("copyDocumentName", [docPath]);
      const name = String(docPath || "").split(/[\\/]/).pop() || "";
      return { ok: true, path: docPath, clipboardText: name, copiedToClipboard: true };
    },
    docSearch: async ({ query = "", fileType = "all", page = 0, pageSize = 40 } = {}) => ({
      ok: true,
      query,
      seedPath: query ? "" : "C:\\Demo\\Engineering\\Fixture A\\fixture-base.SLDPRT",
      fileType,
      fileTypeLabel: fileType === "all" ? "" : fileType,
      mode: query ? "query" : "active-part",
      matchSource: "filename",
      page,
      pageSize,
      hasMore: false,
      entries: clone(documentSearchEntries),
      index: {
        count: 248,
        scanning: false,
        cacheRoot: "C:\\Demo\\Excelsis Helper\\DocSearch",
        targetScan: { roots: ["C:\\Demo\\Engineering"], entries: documentSearchEntries, dirs: 12, limited: false, scanning: false },
      },
    }),
    listWorklogs: async () => ({
      ok: true,
      path: "C:\\Mock\\Excelsis Helper\\project-activity.json",
      activeDate: "2026-07-16",
      projects: clone(worklogs),
      count: worklogs.length,
      counterStatus: {
        isCounting: false,
        code: "waiting",
        headline: "Nothing is being counted",
        message: "Renderer harness idle state.",
      },
      autoExport: {
        enabled: true,
        skippedToday: autoExportSkipped,
        startLabel: "23:50",
        endLabel: "23:58",
        nextRunAt: Date.now() + 3600000,
      },
    }),
    listWorklogWorktypes: async () => ({
      ok: true,
      defaultWorkType: "Design/CAM",
      workTypes: ["Design/CAM", "Machining", "Programming"],
    }),
    getWorklogExportRules: async () => ({ ok: true, rules: clone(savedWorklogRules) }),
    saveWorklogExportRules: async (rules) => {
      record("saveWorklogExportRules", [rules]);
      savedWorklogRules = clone(rules);
      return { ok: true, rules: clone(savedWorklogRules) };
    },
    setAutoExportSkip: async (skip) => {
      record("setAutoExportSkip", [skip]);
      autoExportSkipped = Boolean(skip);
      return {
        ok: true,
        autoExport: {
          enabled: true,
          skippedToday: autoExportSkipped,
          startLabel: "23:50",
          endLabel: "23:58",
          nextRunAt: Date.now() + 3600000,
        },
      };
    },
    exportWorklogs: async (rules) => {
      record("exportWorklogs", [rules]);
      autoExportSkipped = true;
      return {
        ok: true,
        path: "C:\\Mock\\ERP\\Inbox\\worklogs.json",
        count: worklogs.length,
        skippedCount: Array.isArray(rules?.excludedProjectKeys) ? rules.excludedProjectKeys.length : 0,
        exportedHours: 2,
        rules: clone(rules),
        autoExport: {
          enabled: true,
          skippedToday: true,
          startLabel: "23:50",
          endLabel: "23:58",
          nextRunAt: Date.now() + 3600000,
        },
      };
    },
    getLastWorklogBackup: async () => ({ ok: true, available: false, projects: [] }),
    camAddinStatus: async () => ({ ok: true, loaded: false, title: "" }),
    gcodeListRecent: async () => ({
      ok: true,
      root: "C:\\Mock\\CAM",
      truncated: false,
      files: [
        { name: "PART_100.MPF", path: "C:\\Mock\\CAM\\PART_100.MPF", folder: "C:\\Mock\\CAM", mtimeMs: Date.now() },
        { name: "PART_200.MPF", path: "C:\\Mock\\CAM\\PART_200.MPF", folder: "C:\\Mock\\CAM", mtimeMs: Date.now() - 60000 },
      ],
    }),
    gcodeListChecks: async () => ({ ok: true, files: [] }),
    gcodeMaterialOptions: async ({ family } = {}) => ({
      ok: true,
      groups: [
        { id: "aluminum", label: "Aluminium", aliases: ["aluminium", "aluminum", "alu"] },
        { id: "steel", label: "Steel" },
        { id: "copper_alloy", label: "Copper and copper alloys" },
        { id: "plastic", label: "Plastic" },
      ],
      grades: ["aluminum", "aluminium", "alu"].includes(String(family || "").toLowerCase())
        ? [
          { id: "aluminum.wrought.6061", label: "EN AW-6061" },
          { id: "aluminum.wrought.7075", label: "Perunal 215 / EN AW-7075 / 7075" },
        ]
        : String(family || "").toLowerCase() === "steel"
          ? [
            { id: "steel.mold.p20s", label: "Bohler M200 / P20+S / 1.2312" },
            { id: "steel.alloy.crmo4_family", label: "CrMo4 alloy-steel family (exact grade required)" },
            { id: "steel.hss.m1", label: "M1 / Bohler S401 / 1.3346" },
            { id: "steel.hss.m2", label: "M2 / Bohler S600 / 1.3343" },
            { id: "steel.bearing.100cr6", label: "Bohler K200 / 100Cr6 / AISI 52100" },
          ]
          : [],
    }),
    gcodeLocalAnalyze: async (request) => {
      record("gcodeLocalAnalyze", [request]);
      return { ok: true, sessionId: "renderer-session", proposal: baseProposal() };
    },
    gcodeLocalRecalculate: async (request) => {
      record("gcodeLocalRecalculate", [request]);
      return { ok: true, sessionId: "renderer-session", proposal: proposalWithSelections(request?.selections, request?.input) };
    },
    gcodeLocalCreateCopy: async (request) => {
      record("gcodeLocalCreateCopy", [request]);
      return {
        ok: true,
        path: `C:\\Mock\\CAM\\PART_100${request?.suffix || "_optimized"}.MPF`,
        auditPath: "C:\\Mock\\CAM\\PART_100.audit.json",
        sha256: "0".repeat(64),
      };
    },
    onAutoExportLog: (callback) => {
      callbacks.onAutoExportLog = callback;
      return () => {};
    },
  };

  const fallback = (name) => async (...args) => {
    record(name, args);
    return { ok: true, files: [], items: [], entries: [] };
  };

  window.__rendererHarness = {
    calls,
    callbacks,
    defaults,
    getSettings: () => clone(settings),
  };
  window.excelsisAutomation = new Proxy(methods, {
    get(target, property) {
      if (property in target) return target[property];
      if (typeof property === "string" && property.startsWith("on")) {
        return (callback) => {
          callbacks[property] = callback;
          return () => {};
        };
      }
      return fallback(String(property));
    },
  });
})();
