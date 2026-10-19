/* Rolling-caption + interview-question segmentation. */
function normalizeUnitText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function longestOverlap(prev, next, minChars = 4) {
  const a = normalizeUnitText(prev), b = normalizeUnitText(next);
  if (!a || !b) return 0;
  for (let n = Math.min(a.length, b.length); n >= minChars; n -= 1) if (a.slice(-n) === b.slice(0, n)) return n;
  return 0;
}
function deriveRollingDelta(previousRaw, currentRaw) {
  const prev = normalizeUnitText(previousRaw), curr = normalizeUnitText(currentRaw);
  if (!curr) return "";
  if (!prev) return curr;
  if (curr === prev) return "";
  if (curr.startsWith(prev)) return curr.slice(prev.length).trim();
  if (prev.startsWith(curr)) return "";
  const at = curr.lastIndexOf(prev);
  if (at >= 0 && curr.slice(at + prev.length).trim()) return curr.slice(at + prev.length).trim();
  const overlap = longestOverlap(prev, curr, 4);
  if (overlap) return curr.slice(overlap).trim();
  return curr;
}
function appendDelta(previousPending, delta) {
  const a = normalizeUnitText(previousPending), b = normalizeUnitText(delta);
  if (!b) return a;
  if (!a) return b;
  if (b === a || b.startsWith(a)) return b;
  if (a.startsWith(b)) return a;
  const overlap = longestOverlap(a, b, 4);
  if (overlap) return normalizeUnitText(a + b.slice(overlap));
  const space = /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b) ? " " : "";
  return normalizeUnitText(a + space + b);
}
function stripLeadingDuplicate(text, committedTexts = []) {
  let d = normalizeUnitText(text);
  const recent = committedTexts.map(normalizeUnitText).filter(Boolean).sort((a,b)=>b.length-a.length);
  for (const r of recent.slice(0,5)) {
    let idx = d.indexOf(r);
    let guard = 0;
    while (idx >= 0 && guard < 3) {
      d = normalizeUnitText(d.slice(0, idx) + " " + d.slice(idx + r.length));
      idx = d.indexOf(r);
      guard += 1;
    }
  }
  return normalizeUnitText(d);
}
function looksQuestionLike(text) {
  const t = normalizeUnitText(text);
  if (!t) return false;
  if (/[?？]$/.test(t)) return true;
  if (/(お願いします|ください|教えて(?:ください)?|説明して(?:ください)?|お聞かせ(?:ください)?|紹介して(?:ください)?|話して(?:ください)?|伺っても(?:いいですか)?|聞いても(?:いいですか)?)[。！!?？]?$/.test(t)) return true;
  if (/(ですか|ますか|でしょうか|ませんか|のですか|なんですか|何でしょうか|どうでしょうか)[。！!?？]?$/.test(t)) return true;
  const starts = /^(何|誰|どこ|いつ|なぜ|どうして|どう|どの|どんな|どちら|どれ|いくつ|いくら|いつ頃|どのよう)/;
  return starts.test(t) && /[。！？!?]$/.test(t);
}
function splitSentences(value) {
  let rest = normalizeUnitText(value), out = [];
  while (rest) {
    const q = rest.search(/[？?]/);
    const p = rest.search(/[。！!]/);
    const candidates = [q, p].filter(x => x >= 0);
    const idx = candidates.length ? Math.min(...candidates) : -1;
    if (idx < 0) break;
    const unit = normalizeUnitText(rest.slice(0, idx + 1));
    if (unit) out.push(unit);
    rest = normalizeUnitText(rest.slice(idx + 1));
  }
  return { complete: out, remainder: rest };
}
function extractQuestionUnits(value) {
  const parts = splitSentences(value);
  return {
    complete: parts.complete.filter(looksQuestionLike),
    nonQuestionComplete: parts.complete.filter(x => !looksQuestionLike(x)),
    remainder: parts.remainder,
  };
}
if (typeof globalThis !== "undefined") Object.assign(globalThis, { normalizeUnitText, longestOverlap, deriveRollingDelta, appendDelta, stripLeadingDuplicate, looksQuestionLike, splitSentences, extractQuestionUnits });
if (typeof module !== "undefined" && module.exports) module.exports = { normalizeUnitText, longestOverlap, deriveRollingDelta, appendDelta, stripLeadingDuplicate, looksQuestionLike, splitSentences, extractQuestionUnits };
