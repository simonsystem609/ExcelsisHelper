const DEFAULT_PROMOTION_MIN_MS = 60 * 1000;
const DEFAULT_MAX_SAMPLE_MS = 15 * 1000;
const DEFAULT_MAX_PENDING_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 32;
const DEFAULT_SAVE_AS_RELINK_MAX_AGE_MS = 45 * 1000;

function cleanIdentityPart(value) {
  return String(value || "").trim();
}

class UnsavedWorkTracker {
  constructor(options = {}) {
    this.promotionMinMs = Math.max(1, Number(options.promotionMinMs || DEFAULT_PROMOTION_MIN_MS));
    this.maxSampleMs = Math.max(1, Number(options.maxSampleMs || DEFAULT_MAX_SAMPLE_MS));
    this.maxPendingMs = Math.max(this.promotionMinMs, Number(options.maxPendingMs || DEFAULT_MAX_PENDING_MS));
    this.maxSessions = Math.max(1, Math.round(Number(options.maxSessions || DEFAULT_MAX_SESSIONS)));
    this.saveAsRelinkMaxAgeMs = Math.max(
      this.maxSampleMs,
      Number(options.saveAsRelinkMaxAgeMs || DEFAULT_SAVE_AS_RELINK_MAX_AGE_MS),
    );
    this.pending = new Map();
    this.knownSavedKeys = new Set();
    this.watcherSessionId = "";
    this.lastSample = { at: 0, key: "", counting: false };
    this.lastUnsaved = { at: 0, key: "" };
  }

  reset() {
    const clearedSessions = this.pending.size;
    const clearedMs = Array.from(this.pending.values()).reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.totalMs || 0)),
      0,
    );
    this.pending.clear();
    this.knownSavedKeys.clear();
    this.watcherSessionId = "";
    this.lastSample = { at: 0, key: "", counting: false };
    this.lastUnsaved = { at: 0, key: "" };
    return { clearedSessions, clearedMs };
  }

  snapshot() {
    return {
      watcherSessionId: this.watcherSessionId,
      pending: Array.from(this.pending.values()).map((entry) => ({ ...entry })),
      lastSample: { ...this.lastSample },
      lastUnsaved: { ...this.lastUnsaved },
    };
  }

  observe(input = {}) {
    const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
    const fromWatcher = input.fromWatcher === true;
    const connected = input.connected !== false;
    const watcherSessionId = cleanIdentityPart(input.watcherSessionId);

    if (!connected) {
      const cleared = this.reset();
      return { kind: "none", reason: "disconnected", ...cleared };
    }

    if (fromWatcher && watcherSessionId) {
      if (this.watcherSessionId && this.watcherSessionId !== watcherSessionId) {
        this.pending.clear();
        this.knownSavedKeys.clear();
        this.lastSample = { at: 0, key: "", counting: false };
        this.lastUnsaved = { at: 0, key: "" };
      }
      this.watcherSessionId = watcherSessionId;
    }

    const watcherDocuments = fromWatcher && watcherSessionId
      ? this.watcherDocumentSnapshot(watcherSessionId, input.openDocuments)
      : null;
    const finish = (result) => {
      this.rememberKnownSavedDocuments(watcherDocuments);
      return result;
    };

    const documentToken = cleanIdentityPart(input.documentToken);
    const trustedIdentity = Boolean(
      fromWatcher
      && watcherSessionId
      && documentToken
      && input.identityTrusted === true,
    );
    if (!trustedIdentity) {
      this.lastSample = { at: now, key: "", counting: false };
      return finish({ kind: "none", reason: "untrusted-identity" });
    }

    const key = `${watcherSessionId}\u0000${documentToken}`;
    const targetWasKnownSaved = this.knownSavedKeys.has(key);
    const hasActiveDocument = input.hasActiveDocument === true;
    const docPath = String(input.docPath || "").trim();
    if (!hasActiveDocument) {
      this.lastSample = { at: now, key: "", counting: false };
      return finish({ kind: "none", reason: "no-active-document", key });
    }

    if (!docPath) {
      const entry = this.getOrCreateEntry(key, {
        watcherSessionId,
        documentToken,
        docTitle: input.docTitle,
        docType: input.docType,
        now,
      });
      const elapsedMs = this.sampleElapsedMs(key, now, input.shouldCount === true);
      entry.totalMs = Math.min(this.maxPendingMs, entry.totalMs + elapsedMs);
      entry.lastSeenAt = now;
      entry.docTitle = String(input.docTitle || entry.docTitle || "").trim();
      entry.docType = String(input.docType || entry.docType || "").trim();
      this.lastUnsaved = { at: now, key };
      return finish({
        kind: "unsaved",
        key,
        elapsedMs,
        pendingMs: entry.totalMs,
        promotionMinMs: this.promotionMinMs,
        shouldCount: input.shouldCount === true,
        docTitle: entry.docTitle,
        docType: entry.docType,
      });
    }

    let pendingKey = key;
    let entry = this.pending.get(key);
    let identityRelinked = false;
    if (!entry && input.eligibleSavedPath === true) {
      const relink = this.findSaveAsRelinkCandidate({
        now,
        watcherSessionId,
        savedKey: key,
        savedPath: docPath,
        savedDocType: input.docType,
        targetWasKnownSaved,
        watcherDocuments,
      });
      if (relink) {
        pendingKey = relink.key;
        entry = relink.entry;
        identityRelinked = true;
      }
    }
    if (!entry) {
      this.lastSample = { at: now, key: "", counting: false };
      return finish({ kind: "none", reason: "saved-without-pending", key });
    }

    const elapsedMs = this.sampleElapsedMs(pendingKey, now, input.shouldCount === true);
    entry.totalMs = Math.min(this.maxPendingMs, entry.totalMs + elapsedMs);
    entry.lastSeenAt = now;
    this.lastSample = { at: now, key: "", counting: false };

    if (entry.totalMs < this.promotionMinMs) {
      this.pending.delete(pendingKey);
      if (this.lastUnsaved.key === pendingKey) this.lastUnsaved = { at: 0, key: "" };
      return finish({
        kind: "discard",
        reason: "below-minimum",
        key: pendingKey,
        savedKey: key,
        identityRelinked,
        elapsedMs,
        discardedMs: entry.totalMs,
        promotionMinMs: this.promotionMinMs,
      });
    }

    if (input.eligibleSavedPath !== true) {
      return finish({
        kind: "held-ineligible",
        reason: "saved-path-ineligible",
        key: pendingKey,
        savedKey: key,
        identityRelinked,
        elapsedMs,
        pendingMs: entry.totalMs,
        promotionMinMs: this.promotionMinMs,
      });
    }

    this.pending.delete(pendingKey);
    if (this.lastUnsaved.key === pendingKey) this.lastUnsaved = { at: 0, key: "" };
    return finish({
      kind: "promote",
      key: pendingKey,
      savedKey: key,
      identityRelinked,
      sourceDocumentToken: entry.documentToken,
      savedDocumentToken: documentToken,
      elapsedMs,
      promoteMs: entry.totalMs,
      promotionMinMs: this.promotionMinMs,
      docTitle: entry.docTitle,
      docType: entry.docType,
    });
  }

  watcherDocumentSnapshot(watcherSessionId, documents) {
    if (!Array.isArray(documents)) return null;
    const snapshot = new Map();
    for (const document of documents) {
      const documentToken = cleanIdentityPart(document?.documentToken);
      if (!documentToken) continue;
      snapshot.set(`${watcherSessionId}\u0000${documentToken}`, {
        docPath: String(document?.path || "").trim(),
        docType: cleanIdentityPart(document?.type),
      });
    }
    return snapshot;
  }

  rememberKnownSavedDocuments(watcherDocuments) {
    if (!(watcherDocuments instanceof Map)) return;
    for (const [key, document] of watcherDocuments.entries()) {
      if (document.docPath) this.knownSavedKeys.add(key);
    }
  }

  findSaveAsRelinkCandidate({
    now,
    watcherSessionId,
    savedKey,
    savedPath,
    savedDocType,
    targetWasKnownSaved,
    watcherDocuments,
  }) {
    if (targetWasKnownSaved || !(watcherDocuments instanceof Map)) return null;
    const savedDocument = watcherDocuments.get(savedKey);
    if (!savedDocument?.docPath) return null;
    if (savedDocument.docPath.toLowerCase() !== String(savedPath || "").trim().toLowerCase()) return null;

    const candidateKey = this.lastUnsaved.key;
    const candidate = candidateKey ? this.pending.get(candidateKey) : null;
    if (!candidate || candidate.watcherSessionId !== watcherSessionId) return null;
    if (now - Number(this.lastUnsaved.at || 0) > this.saveAsRelinkMaxAgeMs) return null;
    if (now - Number(candidate.lastSeenAt || 0) > this.saveAsRelinkMaxAgeMs) return null;

    const candidateType = cleanIdentityPart(candidate.docType);
    const targetType = cleanIdentityPart(savedDocType || savedDocument.docType);
    if (!candidateType || !targetType || candidateType !== targetType) return null;

    const candidateDocument = watcherDocuments.get(candidateKey);
    if (candidateDocument) {
      if (!candidateDocument.docPath) return null;
      if (candidateDocument.docPath.toLowerCase() !== String(savedPath || "").trim().toLowerCase()) return null;
    }
    return { key: candidateKey, entry: candidate };
  }

  sampleElapsedMs(key, now, shouldCount) {
    const previous = this.lastSample;
    const elapsedMs = shouldCount
      && previous.counting
      && previous.at > 0
      && previous.key === key
      ? Math.max(0, Math.min(this.maxSampleMs, now - previous.at))
      : 0;
    this.lastSample = { at: now, key, counting: shouldCount };
    return elapsedMs;
  }

  getOrCreateEntry(key, details) {
    let entry = this.pending.get(key);
    if (entry) return entry;

    if (this.pending.size >= this.maxSessions) {
      let oldestKey = "";
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const [candidateKey, candidate] of this.pending.entries()) {
        const candidateAt = Number(candidate.lastSeenAt || candidate.firstSeenAt || 0);
        if (candidateAt < oldestAt) {
          oldestAt = candidateAt;
          oldestKey = candidateKey;
        }
      }
      if (oldestKey) this.pending.delete(oldestKey);
    }

    entry = {
      key,
      watcherSessionId: details.watcherSessionId,
      documentToken: details.documentToken,
      docTitle: String(details.docTitle || "").trim(),
      docType: String(details.docType || "").trim(),
      totalMs: 0,
      firstSeenAt: details.now,
      lastSeenAt: details.now,
    };
    this.pending.set(key, entry);
    return entry;
  }
}

module.exports = {
  DEFAULT_PROMOTION_MIN_MS,
  DEFAULT_MAX_SAMPLE_MS,
  DEFAULT_MAX_PENDING_MS,
  DEFAULT_MAX_SESSIONS,
  DEFAULT_SAVE_AS_RELINK_MAX_AGE_MS,
  UnsavedWorkTracker,
};
