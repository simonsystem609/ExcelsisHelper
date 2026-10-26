"use strict";

// Public release protocol shared with the independently distributed Viewer.
// Candidate/company distribution is deliberately not an update source.
const OWNER = "simonsystem609";
const APP_LIMIT = 512 * 1024 * 1024;
const MACRO_LIMIT = 16 * 1024 * 1024;
const PRODUCTS = new Map([
  ["viewer", { title: "ExcelsisView", repository: "ExcelsisViewer", prefix: "excelsis-view-v",
    registryId: "9542c8ef-f59a-55a8-bf9f-0ca14a456236", installer: label => `ExcelsisView-Setup-${label}.exe` }],
  ["helper", { title: "Excelsis Helper", repository: "ExcelsisHelper", prefix: "excelsis-helper-v",
    registryId: "9902802a-b027-5709-9ce3-7a9d4fdcc95c", installer: label => `ExcelsisHelper-${label}-Setup.exe` }],
]);
const MACRO_FILES = Object.freeze([
  ["BackupAssembly_v1.swp", "BackupAssembly_v1.swb"],
  ["BOM_v19.swp", "BOM_v19.swb"], ["BOM_v19_ROfriendy.swp", "BOM_v19_ROfriendy.swb"],
  ["CNCDXF_final_v1.swp", "CNCDXF_v1.swb"], ["CrawlScrews_v1.swp", "CrawlScrews_v1.swb"],
  ["DXF_v16.swp", "DXF_v16.swb"], ["DXF_v16_ROfriendy.swp", "DXF_v16_ROfriendy.swb"],
  ["PDF_v1.swp", "PDF_v1.swb"], ["Radius_v9.swp", "Radius_v9.swb"],
]);

function product(key) {
  if (!PRODUCTS.has(key)) throw new Error("Unknown update product.");
  return PRODUCTS.get(key);
}

function versionParts(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)) return null;
  return value.split(".").map(Number);
}

function compareVersions(a, b) {
  const left = versionParts(a), right = versionParts(b);
  if (!left || !right) return null;
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function versionStatus(installed, latest) {
  if (installed === null) return "not-installed";
  const order = compareVersions(installed, latest);
  return order === null ? "unknown" : order < 0 ? "update-available" : order > 0 ? "newer-installed" : "up-to-date";
}

function apiUrl(key, macros = false) {
  const repo = product(key).repository;
  return `https://api.github.com/repos/${OWNER}/${repo}/releases${macros ? "?per_page=100" : "/latest"}`;
}

function exactUrl(actual, expected) {
  let parsed;
  try { parsed = new URL(actual); } catch { throw new Error("Invalid release URL."); }
  if (parsed.href !== expected || parsed.username || parsed.password || parsed.port) {
    throw new Error("The release URL does not match the trusted repository, tag and filename.");
  }
  return parsed.href;
}

function fileAsset(asset, key, tag, name, maximum, minimum = 32) {
  if (!asset || asset.name !== name || asset.state !== "uploaded" || !Number.isSafeInteger(asset.size)
    || asset.size < minimum || asset.size > maximum) throw new Error("The release asset has an invalid filename, state or size.");
  const match = /^sha256:([a-f0-9]{64})$/i.exec(String(asset.digest || ""));
  if (!match) throw new Error("GitHub did not provide a valid SHA-256 digest for the asset.");
  const expected = `https://github.com/${OWNER}/${product(key).repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
  return Object.freeze({ name, size: asset.size, sha256: match[1].toLowerCase(), url: exactUrl(asset.browser_download_url, expected) });
}

function releasePage(release, key, tag) {
  if (release.immutable !== true || release.draft !== false) throw new Error("Only immutable, published releases are supported.");
  return exactUrl(release.html_url, `https://github.com/${OWNER}/${product(key).repository}/releases/tag/${tag}`);
}

function appRelease(key, release) {
  const definition = product(key);
  if (!release || typeof release !== "object" || release.prerelease !== false) throw new Error("A stable public app release is required.");
  const tag = String(release.tag_name || "");
  if (!tag.startsWith(definition.prefix)) throw new Error("The app release tag belongs to a different product.");
  const label = tag.slice(definition.prefix.length);
  const version = key === "helper" ? label.replace(/-public\.[1-9]\d{0,4}$/, "") : label;
  if (!versionParts(version) || (key !== "helper" && version !== label)) throw new Error("Unsupported app release version.");
  const page = releasePage(release, key, tag);
  const name = definition.installer(label);
  const candidates = Array.isArray(release.assets) ? release.assets.filter(item => item?.name === name) : [];
  if (candidates.length !== 1 || release.assets.some(item => item !== candidates[0] && /\.exe$/i.test(String(item?.name || "")))) {
    throw new Error("The release must have exactly one matching app installer.");
  }
  return Object.freeze({ key, title: definition.title, version, label, tag, page,
    asset: fileAsset(candidates[0], key, tag, name, APP_LIMIT, 1024 * 1024) });
}

function macroTag(value) {
  const match = /^excelsis-helper-macros-(\d+\.\d+\.\d+)-(20\d{6})\.([1-9]\d{0,3})$/.exec(String(value));
  if (!match || !versionParts(match[1])) return null;
  const date = match[2];
  const parsed = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10).replace(/-/g, "") !== date) return null;
  return { helperVersion: match[1], revision: `${date}.${match[3]}`, date: Number(date), sequence: Number(match[3]) };
}

function macroRelease(release) {
  const tag = String(release?.tag_name || ""), identity = macroTag(tag);
  if (!identity || release.prerelease !== true) throw new Error("Invalid compatible macro revision tag.");
  const page = releasePage(release, "helper", tag);
  const allowed = new Set(["MACRO-REVISION.json", "SHA256SUMS.txt", ...MACRO_FILES.flat()]);
  const assets = new Map();
  if (!Array.isArray(release.assets)) throw new Error("The macro revision has no asset list.");
  for (const item of release.assets) {
    if (!allowed.has(item?.name) || assets.has(item.name)) throw new Error("Unexpected or duplicate macro revision asset.");
    assets.set(item.name, fileAsset(item, "helper", tag, item.name, MACRO_LIMIT));
  }
  if (!assets.has("MACRO-REVISION.json") || !assets.has("SHA256SUMS.txt")) throw new Error("The macro revision is missing its manifest or checksums.");
  const files = [];
  for (const [compiled, source] of MACRO_FILES) {
    if (assets.has(compiled) !== assets.has(source)) throw new Error("A macro needs its matching readable source asset.");
    if (assets.has(compiled)) files.push(assets.get(compiled));
  }
  if (!files.length) throw new Error("The macro revision has no SWP files.");
  return Object.freeze({ ...identity, tag, page, files });
}

function latestMacros(releases, installedVersion) {
  if (!Array.isArray(releases)) throw new Error("Invalid GitHub macro release list.");
  const matches = releases.map(release => ({ release, identity: macroTag(release?.tag_name) }))
    .filter(item => item.identity?.helperVersion === installedVersion)
    .sort((a, b) => b.identity.date - a.identity.date || b.identity.sequence - a.identity.sequence);
  return matches.length ? macroRelease(matches[0].release) : null;
}

function downloadHost(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password
      && ["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"].includes(url.hostname);
  } catch { return false; }
}

module.exports = { OWNER, APP_LIMIT, MACRO_LIMIT, MACRO_FILES, product, versionParts, compareVersions,
  versionStatus, apiUrl, appRelease, macroTag, macroRelease, latestMacros, downloadHost };
