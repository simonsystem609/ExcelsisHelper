"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const COMPANY_IDS = ["company", "tools"];
const MAX_ENTRIES = 50000;
const MAX_SEQUENCE = 999999999;

function companySettings(settings, id) {
  if (!COMPANY_IDS.includes(id)) throw new Error("Choose a company.");
  const company = settings?.projectFolders?.[id];
  if (!company || !/^[A-Z][A-Z0-9]{0,11}$/.test(company.prefix || "")) {
    throw new Error("Set a valid project prefix in Settings > Project Folders.");
  }
  if (typeof company.root !== "string" || !path.isAbsolute(company.root)
    || company.root.includes("\0")) {
    throw new Error("Set the company root in Settings > Project Folders first.");
  }
  return company;
}

function samePath(a, b) {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function validateProjectName(name, code) {
  if (typeof name !== "string" || !name || name.length > 255 || name !== name.trim()
    || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name) || /[. ]$/.test(name)) {
    throw new Error("Use a folder name of 1 to 255 characters without reserved characters or trailing spaces/dots.");
  }
  if (name !== code && !["_", "-", " "].some(separator => name.startsWith(code + separator))) {
    throw new Error(`Keep the project code ${code} at the start of the folder name.`);
  }
  return name;
}

function createProjectFolderService({ io = fs, now = () => new Date() } = {}) {
  // Serialize local creates; the bare project-code directory also reserves the
  // number against another Helper process while its full name is applied.
  let createQueue = Promise.resolve();

  async function yearScope(company, year) {
    const root = path.resolve(company.root);
    if (!(await io.stat(root)).isDirectory()) throw new Error("The company root is not a folder.");
    const realRoot = await io.realpath(root);
    const yearPath = path.join(root, String(year));
    try {
      const stats = await io.lstat(yearPath);
      if (!stats.isDirectory() || stats.isSymbolicLink()
        || !samePath(await io.realpath(yearPath), path.join(realRoot, String(year)))) {
        throw new Error("The year folder is linked or is not an ordinary folder. No folder was created.");
      }
      return { root, realRoot, yearPath, exists: true };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { root, realRoot, yearPath, exists: false };
    }
  }

  async function listNumbers(scope, prefix, year) {
    const numbers = new Map();
    if (!scope.exists) return numbers;
    const pattern = new RegExp(`^${prefix}-${String(year).slice(-2)}-(\\d+)(?=[_ -]|$)`, "i");
    const directory = await io.opendir(scope.yearPath);
    let count = 0;
    for await (const entry of directory) {
      if (++count > MAX_ENTRIES) throw new Error("The year folder contains too many entries to number safely.");
      const match = pattern.exec(entry.name);
      if (!match) continue;
      // A matching file/link also occupies a number; do not follow any entry.
      const number = Number(match[1]);
      if (!Number.isSafeInteger(number) || number > MAX_SEQUENCE) {
        throw new Error("An existing project number is too large to increment safely.");
      }
      const names = numbers.get(number) || [];
      names.push(entry.name);
      numbers.set(number, names);
    }
    return numbers;
  }

  function nextNumber(numbers) {
    let maximum = 0;
    for (const number of numbers.keys()) maximum = Math.max(maximum, number);
    if (maximum >= MAX_SEQUENCE) throw new Error("Project numbering has reached its limit.");
    return maximum + 1;
  }

  function projectCode(company, year, sequence) {
    return `${company.prefix}-${String(year).slice(-2)}-${String(sequence).padStart(3, "0")}`;
  }

  async function plan(settings, companyId) {
    const company = companySettings(settings, companyId);
    const year = now().getFullYear();
    if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new Error("The system year is invalid.");
    const scope = await yearScope(company, year);
    const sequence = nextNumber(await listNumbers(scope, company.prefix, year));
    const code = projectCode(company, year, sequence);
    const token = crypto.createHash("sha256")
      .update(JSON.stringify([companyId, scope.root, scope.realRoot, company.prefix, year, code])).digest("hex");
    return { companyId, companyName: company.name, year, yearPath: scope.yearPath,
      code, sequence, suggestedName: `${code}_`, token };
  }

  async function create(settings, request) {
    if (!request || typeof request !== "object" || typeof request.token !== "string"
      || request.token.length !== 64) throw new Error("Preview the project folder again before creating it.");
    const current = await plan(settings, request.companyId);
    if (current.token !== request.token) {
      return { ok: false, conflict: true, preview: current,
        error: "The next project number or destination changed. Review the updated name and press Create again." };
    }
    validateProjectName(request.name, current.code);
    const company = companySettings(settings, request.companyId);
    let scope = await yearScope(company, current.year);
    if (!scope.exists) {
      try { await io.mkdir(scope.yearPath); }
      catch (error) { if (error.code !== "EEXIST") throw error; }
      scope = await yearScope(company, current.year);
    }
    // Recheck after creating a new year and immediately before reservation.
    const fresh = await plan(settings, request.companyId);
    if (fresh.token !== current.token) {
      return { ok: false, conflict: true, preview: fresh,
        error: "The next project number changed. Review the updated name and press Create again." };
    }
    let code = current.code;
    let sequence = current.sequence;
    let reservedPath = path.join(scope.yearPath, code);
    if (path.join(scope.yearPath, request.name).length > 32760) throw new Error("The project path is too long.");
    try { await io.mkdir(reservedPath); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      return { ok: false, conflict: true, preview: await plan(settings, request.companyId),
        error: "That project number was just taken. Review the updated name and press Create again." };
    }
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const occupied = await listNumbers(scope, company.prefix, current.year);
        const peers = (occupied.get(sequence) || []).filter(name => name !== code);
        if (peers.length) {
          sequence = nextNumber(occupied);
          const nextCode = projectCode(company, current.year, sequence);
          const nextPath = path.join(scope.yearPath, nextCode);
          // Rename only the empty reservation created by this invocation.
          if ((await io.readdir(reservedPath)).length) throw new Error("The reserved project folder is no longer empty.");
          await io.rename(reservedPath, nextPath);
          reservedPath = nextPath;
          code = nextCode;
          continue;
        }
        const name = code + request.name.slice(current.code.length);
        validateProjectName(name, code);
        const finalPath = path.join(scope.yearPath, name);
        if (finalPath !== reservedPath) {
          try {
            await io.lstat(finalPath);
            throw new Error("The target folder already exists; it was not replaced.");
          }
          catch (error) { if (error.code !== "ENOENT") throw error; }
          // Windows directory rename never replaces an existing directory/file.
          await io.rename(reservedPath, finalPath);
        }
        return { ok: true, created: true, path: finalPath, name, code, year: current.year,
          companyId: request.companyId, renumbered: code !== current.code };
      }
      throw new Error("Project numbers kept changing while creating the folder.");
    } catch (error) {
      return { ok: false, created: true, partial: true, path: reservedPath,
        error: `A new folder was created at ${reservedPath}, but its full name could not be applied: ${error.message}` };
    }
  }

  return {
    preview: (settings, companyId) => plan(settings, companyId),
    create(settings, request) {
      const job = createQueue.then(() => create(settings, request));
      createQueue = job.catch(() => {});
      return job;
    },
  };
}

module.exports = { COMPANY_IDS, createProjectFolderService, validateProjectName };
