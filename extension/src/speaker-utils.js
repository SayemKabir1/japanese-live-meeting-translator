const INTERVIEW_DEFAULTS = {
  captureMode: "interviewee_only",
  targetSpeaker: "",
  lockFirstRemoteSpeaker: true,
  requireSpeakerAttribution: true,
  stabilityDelayMs: 250,
  utteranceExpiryMs: 2500,
  questionsOnly: true,
  maxPendingTranslations: 8,
};

function normalizeSpeakerName(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function speakerKey(value) { return normalizeSpeakerName(value).toLocaleLowerCase(); }
function isSelfLabel(value) {
  const key = speakerKey(value).replace(/[()]/g, "").trim();
  return /^(you|me|self|あなた|自分|vous|du|sie|tú|tu|ты|你|我)$/.test(key);
}
function isSelfSpeaker(speaker) { return isSelfLabel(speaker); }
function speakerMatches(speaker, target) {
  const a = speakerKey(speaker), b = speakerKey(target);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
function shouldTranslateSpeaker({ speaker, isSelf = false, targetSpeaker = "", captureMode = "interviewee_only", requireSpeakerAttribution = true, lockedSpeaker = "" }) {
  const name = normalizeSpeakerName(speaker);
  if (isSelf || isSelfLabel(name)) return { ok: false, reason: "local_user" };
  if (!name && requireSpeakerAttribution) return { ok: false, reason: "speaker_unknown" };
  if (captureMode === "all_speakers") return { ok: true, reason: "all_speakers" };
  if (captureMode === "target_speaker") {
    if (!targetSpeaker) return { ok: false, reason: "target_missing" };
    return speakerMatches(name, targetSpeaker) ? { ok: true, reason: "target_match" } : { ok: false, reason: "other_speaker" };
  }
  if (lockedSpeaker) return speakerMatches(name, lockedSpeaker) ? { ok: true, reason: "locked_remote" } : { ok: false, reason: "other_remote" };
  return { ok: true, reason: "remote_speaker" };
}
if (typeof globalThis !== "undefined") Object.assign(globalThis, { INTERVIEW_DEFAULTS, normalizeSpeakerName, speakerKey, isSelfLabel, isSelfSpeaker, speakerMatches, shouldTranslateSpeaker });
if (typeof module !== "undefined" && module.exports) module.exports = { INTERVIEW_DEFAULTS, normalizeSpeakerName, speakerKey, isSelfLabel, isSelfSpeaker, speakerMatches, shouldTranslateSpeaker };
