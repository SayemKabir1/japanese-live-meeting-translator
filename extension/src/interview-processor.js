/* global INTERVIEW_DEFAULTS, extractCaptionRows, InterviewTurnProcessor, normalizeCaptionText, isLikelyJapaneseCaption, hashText */
/* Incremental question extraction: complete sentences are queued as soon as they appear, even if Meet keeps extending the rolling transcript. */

class InterviewTurnProcessor {
  constructor(settings = {}) {
    this.captureMode = settings.captureMode || "interviewee_only";
    this.targetSpeaker = settings.targetSpeaker || "";
    this.lockFirstRemoteSpeaker = settings.lockFirstRemoteSpeaker !== false;
    this.requireSpeakerAttribution = settings.requireSpeakerAttribution !== false;
    this.questionsOnly = settings.questionsOnly !== false;
    this.stabilityDelayMs = Math.max(150, Math.min(1200, Number(settings.stabilityDelayMs) || 250));
    this.unpunctuatedDelayMs = Math.max(this.stabilityDelayMs, 550);
    this.utteranceExpiryMs = Math.max(900, Number(settings.utteranceExpiryMs) || 1800);
    this.lockedSpeaker = "";
    this.activeSpeaker = "";
    this.turns = new Map();
    this.committed = new Map();
  }

  getTurn(speaker) {
    const key = normalizeSpeakerName(speaker);
    let turn = this.turns.get(key);
    if (!turn) {
      turn = {
        speaker: key,
        raw: "",
        pending: "",
        pendingSince: 0,
        pendingChangedAt: 0,
        pendingDelayMs: this.unpunctuatedDelayMs,
        lastSeenAt: 0,
        lastCommitted: "",
        committedTexts: [],
        readyUnits: new Map(),
      };
      this.turns.set(key, turn);
    }
    return turn;
  }

  unitKey(unit) {
    return normalizeUnitText(unit).replace(/[。！？!?]+$/g, "").toLocaleLowerCase();
  }

  decide(row) {
    return shouldTranslateSpeaker({
      speaker: row.speaker,
      isSelf: !!row.isSelf,
      targetSpeaker: this.targetSpeaker,
      captureMode: this.captureMode,
      requireSpeakerAttribution: this.requireSpeakerAttribution,
      lockedSpeaker: this.lockedSpeaker,
    });
  }

  rememberCommitted(turn, unit, now) {
    const normalized = normalizeUnitText(unit);
    const keyText = this.unitKey(normalized);
    if (!keyText) return;
    turn.lastCommitted = normalized;
    turn.committedTexts.push(keyText);
    if (turn.committedTexts.length > 16) turn.committedTexts.shift();
    this.committed.set(`${turn.speaker.toLocaleLowerCase()}\n${keyText}`, now);
    for (const [key, at] of this.committed) {
      if (now - at > 60000) this.committed.delete(key);
    }
  }

  isDuplicate(turn, unit, now) {
    const keyText = this.unitKey(unit);
    if (!keyText) return true;
    const key = `${turn.speaker.toLocaleLowerCase()}\n${keyText}`;
    const at = this.committed.get(key);
    if (at && now - at < 60000) return true;
    return turn.committedTexts.includes(keyText);
  }

  isFiller(text) {
    const compact = this.unitKey(text).trim();
    return /^(あの|あのー|あのう|え|えー|えっと|その|まあ)$/.test(compact);
  }

  stabilityFor(text) {
    const clean = normalizeCaptionText(text);
    if (/[?？。！!]$/.test(clean)) return this.stabilityDelayMs;
    return this.unpunctuatedDelayMs;
  }

  acceptRemoteRow(row, now) {
    const speaker = normalizeSpeakerName(row.speaker);
    const turn = this.getTurn(speaker);
    const current = normalizeCaptionText(row.text);
    if (!current) return [];
    if (turn.raw === current) {
      turn.lastSeenAt = now;
      return [];
    }

    turn.raw = current;
    turn.lastSeenAt = now;

    // Parse the full current caption every time. Meet can leave the entire
    // conversation in one rolling caption node; completed questions must not
    // wait for the final tail of that node to stop changing.
    const parsed = extractQuestionUnits(current);
    const currentUnitKeys = new Set(parsed.complete.map(unit => this.unitKey(unit)));

    // Cancel a just-seen short fragment if Meet revises it into a longer
    // question before the stability window expires (e.g. "今何を？" -> "今何を知っていますか？").
    const currentWithoutPunctuation = current.replace(/[。！？!?]/g, "");
    for (const [key, candidate] of turn.readyUnits) {
      if (currentUnitKeys.has(key)) continue;
      if (now - candidate.firstSeenAt > this.stabilityDelayMs * 3) continue;
      const base = normalizeUnitText(candidate.text).replace(/[。！？!?]+$/g, "");
      const revisedAsLongerUnit = parsed.complete.some(unit => {
        const newer = normalizeUnitText(unit).replace(/[。！？!?]+$/g, "");
        return newer.length > base.length && newer.startsWith(base);
      });
      if (base.length >= 3 && !current.includes(candidate.text) && revisedAsLongerUnit) turn.readyUnits.delete(key);
      else if (base.length >= 3 && !current.includes(candidate.text) && currentWithoutPunctuation.startsWith(base)) {
        const nextChar = currentWithoutPunctuation.charAt(base.length);
        if (nextChar && /[ぁ-ゖァ-ヶ一-龯A-Za-z0-9]/u.test(nextChar)) turn.readyUnits.delete(key);
      }
    }

    // Queue newly visible completed questions/requests, but suppress the many
    // old complete sentences that Meet repeats in rolling history.
    for (const unit of parsed.complete) {
      const normalized = normalizeUnitText(unit);
      const key = this.unitKey(normalized);
      if (!key || this.isFiller(normalized) || this.isDuplicate(turn, normalized, now)) continue;
      if (!turn.readyUnits.has(key)) {
        turn.readyUnits.set(key, { speaker: turn.speaker, text: normalized, firstSeenAt: now });
      }
    }

    // Keep only the unfinished tail for the no-punctuation fallback.
    const nextPending = normalizeUnitText(parsed.remainder);
    if (nextPending !== turn.pending) {
      turn.pending = nextPending;
      turn.pendingSince = nextPending ? now : 0;
      turn.pendingChangedAt = nextPending ? now : 0;
      turn.pendingDelayMs = this.stabilityFor(nextPending);
    }
    return [];
  }

  maybeExtract(turn, now, force = false) {
    const out = [];

    // Completed, punctuation-delimited units have their own short debounce.
    // They no longer wait for unrelated later speech to stop changing.
    for (const [key, candidate] of turn.readyUnits) {
      if (!force && now - candidate.firstSeenAt < this.stabilityDelayMs) continue;
      turn.readyUnits.delete(key);
      if (this.isFiller(candidate.text) || this.isDuplicate(turn, candidate.text, now)) continue;
      out.push({ speaker: turn.speaker, text: candidate.text, reason: "question-stable" });
      this.rememberCommitted(turn, candidate.text, now);
    }

    // Fallback for captions that Meet delivers without punctuation.
    if (turn.pending && turn.pendingChangedAt) {
      const stableFor = now - turn.pendingChangedAt;
      const requiredDelay = force ? 0 : (turn.pendingDelayMs || this.unpunctuatedDelayMs);
      if (stableFor >= requiredDelay) {
        const tail = normalizeUnitText(turn.pending);
        const looksComplete = /(ですか|ますか|でしょうか|ませんか|お願いします|ください|教えて(?:ください)?|説明して(?:ください)?|お聞かせ(?:ください)?|紹介を?してください)$/.test(tail);
        if (this.questionsOnly && looksComplete && !this.isFiller(tail) && !this.isDuplicate(turn, tail, now)) {
          out.push({ speaker: turn.speaker, text: tail, reason: "stable-unpunctuated-question" });
          this.rememberCommitted(turn, tail, now);
          turn.pending = "";
          turn.pendingSince = 0;
          turn.pendingChangedAt = 0;
        } else if (now - turn.pendingChangedAt > this.utteranceExpiryMs && !looksComplete) {
          // Expire non-question sentence tails so old introduction text is not
          // concatenated into a much later interview question.
          turn.pending = "";
          turn.pendingSince = 0;
          turn.pendingChangedAt = 0;
        }
      }
    }
    return out;
  }

  chooseFreshestRows(rows) {
    const latest = new Map();
    for (const row of rows || []) {
      const speaker = normalizeSpeakerName(row.speaker);
      if (!speaker) continue;
      const key = `${row.isSelf ? "self" : "remote"}::${speaker.toLocaleLowerCase()}`;
      const prev = latest.get(key);
      const bottom = Number(row.bottom || 0);
      const textLen = String(row.text || "").length;
      const prevBottom = Number(prev?.bottom || 0);
      const prevLen = Number(prev?.text || "").length;
      if (!prev || bottom > prevBottom || (bottom === prevBottom && textLen >= prevLen)) latest.set(key, row);
    }
    return [...latest.values()].sort((a, b) => (a.bottom || 0) - (b.bottom || 0));
  }

  processRows(rows, now = Date.now()) {
    const selected = this.chooseFreshestRows(rows);
    for (const row of selected) {
      if (row.isSelf) continue;
      const decision = this.decide(row);
      if (!decision.ok) continue;
      const speaker = normalizeSpeakerName(row.speaker);
      if (!speaker) continue;
      if (this.captureMode === "interviewee_only" && this.lockFirstRemoteSpeaker && !this.lockedSpeaker) this.lockedSpeaker = speaker;
      this.activeSpeaker = speaker;
      this.acceptRemoteRow(row, now);
    }
    return this.flushDue(now);
  }

  flushDue(now = Date.now()) {
    const emitted = [];
    for (const turn of this.turns.values()) emitted.push(...this.maybeExtract(turn, now));
    return this.unique(emitted);
  }

  forceFlush() {
    const out = [];
    const now = Date.now();
    for (const turn of this.turns.values()) out.push(...this.maybeExtract(turn, now, true));
    return this.unique(out);
  }

  unique(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.speaker}\n${this.unitKey(item.text)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

if (typeof globalThis !== "undefined") globalThis.InterviewTurnProcessor = InterviewTurnProcessor;
if (typeof module !== "undefined" && module.exports) module.exports = { InterviewTurnProcessor };
