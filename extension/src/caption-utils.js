const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/g;
const JP_PUNCTUATION_RE = /[。！？!?」』）)】］\]]$/;

function normalizeCaptionLine(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function normalizeCaptionText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n+/)
    .map(normalizeCaptionLine)
    .filter(Boolean)
    .join(" ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function japaneseRatio(value) {
  const text = String(value || "").replace(/\s/g, "");
  if (!text) return 0;
  const jp = (text.match(JAPANESE_RE) || []).length;
  return jp / text.length;
}

function isLikelyJapaneseCaption(value) {
  const text = normalizeCaptionText(value);
  if (text.length < 2 || text.length > 1600) return false;
  const ratio = japaneseRatio(text);
  if (ratio < 0.16) return false;
  // Avoid obvious UI-only strings while still allowing short utterances like はい / そうです.
  if (/^(字幕|キャプション|設定|参加者|チャット|会議|マイク|カメラ)$/.test(text)) return false;
  return true;
}

function looksCommittedSentence(value) {
  const text = normalizeCaptionText(value);
  if (!text) return false;
  return JP_PUNCTUATION_RE.test(text) || text.length >= 50;
}

function splitCaptionLines(value) {
  return String(value || "")
    .split(/\r?\n|\|/)
    .map(normalizeCaptionLine)
    .filter(Boolean)
    .filter(isLikelyJapaneseCaption);
}

function longestSuffixPrefixOverlap(previous, current, minChars = 4) {
  const a = normalizeCaptionText(previous);
  const b = normalizeCaptionText(current);
  const max = Math.min(a.length, b.length);
  for (let k = max; k >= minChars; k -= 1) {
    if (a.slice(-k) === b.slice(0, k)) return k;
  }
  return 0;
}

function deriveCaptionDelta(previous, current) {
  const prev = normalizeCaptionText(previous);
  const next = normalizeCaptionText(current);
  if (!next) return "";
  if (!prev) return next;
  if (next === prev) return "";
  if (next.startsWith(prev)) {
    return next.slice(prev.length).trim();
  }
  if (prev.startsWith(next) || prev.includes(next)) return "";
  const overlap = longestSuffixPrefixOverlap(prev, next, 4);
  if (overlap > 0) return next.slice(overlap).trim();
  const prevParts = splitCaptionLines(prev);
  const nextParts = splitCaptionLines(next);
  if (prevParts.length && nextParts.length) {
    const lastPrev = prevParts[prevParts.length - 1];
    const lastNext = nextParts[nextParts.length - 1];
    if (lastNext !== lastPrev && lastNext.startsWith(lastPrev)) {
      return lastNext.slice(lastPrev.length).trim();
    }
  }
  return next;
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeCaptionText,
    normalizeCaptionLine,
    japaneseRatio,
    isLikelyJapaneseCaption,
    looksCommittedSentence,
    splitCaptionLines,
    longestSuffixPrefixOverlap,
    deriveCaptionDelta,
    hashText
  };
}
