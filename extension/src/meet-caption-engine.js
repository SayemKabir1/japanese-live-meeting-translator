/* global isLikelyJapaneseCaption, normalizeCaptionText, japaneseRatio */

function engineVisible(el, win, hostId) {
  if (!(el instanceof (win?.Element || Element))) return false;
  if (el.id === hostId || el.closest?.(`#${hostId}`)) return false;
  const style = win.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" &&
    rect.width > 1 && rect.height > 1 && rect.bottom >= -10 && rect.top <= win.innerHeight + 10;
}

function engineText(el) {
  return normalizeCaptionText(el?.innerText || el?.textContent || "");
}

function engineDialog(el) {
  return !!el?.closest?.('[role="dialog"], [role="alertdialog"]');
}

function engineInteractive(el) {
  return !!el?.closest?.('button, [role="button"], input, textarea, select, [contenteditable="true"]');
}

function engineWalkRoots(root, seen = new Set(), out = []) {
  if (!root || seen.has(root) || out.length > 64) return out;
  seen.add(root);
  out.push(root);
  if (!root.querySelectorAll) return out;
  for (const el of root.querySelectorAll("*")) {
    if (el.shadowRoot) engineWalkRoots(el.shadowRoot, seen, out);
  }
  return out;
}

function engineDeepQueryAll(doc, selector) {
  const out = [];
  const seen = new Set();
  for (const root of engineWalkRoots(doc)) {
    let nodes = [];
    try { nodes = [...root.querySelectorAll(selector)]; } catch (_) {}
    for (const node of nodes) {
      if (!seen.has(node)) { seen.add(node); out.push(node); }
    }
  }
  return out;
}

function engineSelectors(platform) {
  if (platform === "google_meet") {
    return [
      '[jsname="tgaKEf"]',
      '[jsname="DS9Ooe"]',
      '[role="region"][aria-label="Captions"]',
      '[role="region"][aria-label*="caption" i]',
      '[aria-live="polite"]',
      '[aria-live="assertive"]'
    ];
  }
  return [
    '[aria-label*="caption" i]',
    '[aria-label*="subtitle" i]',
    '[class*="caption" i]',
    '[class*="subtitle" i]',
    '[aria-live="polite"]',
    '[aria-live="assertive"]'
  ];
}

function scoreRoot(el, win, hostId) {
  if (!engineVisible(el, win, hostId) || engineDialog(el)) return -Infinity;
  const text = engineText(el);
  const aria = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("data-tooltip") || ""}`.toLowerCase();
  const cls = String(el.className || "").toLowerCase();
  const jsname = el.getAttribute("jsname") || "";
  const rect = el.getBoundingClientRect();
  let score = 0;
  if (jsname === "tgaKEf") score += 80;
  if (jsname === "DS9Ooe") score += 75;
  if (el.matches?.('[role="region"][aria-label="Captions"]')) score += 70;
  if (/caption|subtitle|字幕/.test(aria)) score += 35;
  if (/caption|subtitle/.test(cls)) score += 10;
  if (el.getAttribute("aria-live")) score += 15;
  if (isLikelyJapaneseCaption(text)) score += 20;
  if (text.length) score += Math.min(text.length, 400) / 25;
  if (rect.bottom > win.innerHeight * 0.45) score += 10;
  return score;
}

function findCaptionRoot(doc, platform, hostId = "jp-live-translator-external-window-host") {
  const seen = new Set();
  const candidates = [];
  for (const selector of engineSelectors(platform)) {
    let nodes = [];
    try { nodes = [...doc.querySelectorAll(selector)]; } catch (_) {}
    for (const el of nodes) {
      if (!seen.has(el)) { seen.add(el); candidates.push(el); }
    }
  }
  if (!candidates.length) {
    for (const selector of engineSelectors(platform)) {
      for (const el of engineDeepQueryAll(doc, selector)) {
        if (!seen.has(el)) { seen.add(el); candidates.push(el); }
      }
    }
  }
  const win = doc.defaultView;
  candidates.sort((a, b) => scoreRoot(b, win, hostId) - scoreRoot(a, win, hostId));
  const best = candidates[0];
  return best && scoreRoot(best, win, hostId) >= 20 ? best : null;
}

function cleanSpeaker(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\[|\]$/g, "")
    .trim();
}

function isPlausibleSpeaker(value) {
  const text = cleanSpeaker(value);
  if (!text || text.length > 90) return false;
  if (isLikelyJapaneseCaption(text)) return false;
  if (/^(captions?|subtitles?|live captions?|settings?|people|chat|you|me)$/i.test(text)) return false;
  if (/^[0-9:.,\-]+$/.test(text)) return false;
  return true;
}

function rowHasYouMarker(row) {
  if (!row) return false;
  const ariaParts = [...(row.querySelectorAll?.('[aria-label]') || [])]
    .map(el => String(el.getAttribute("aria-label") || ""));
  if (ariaParts.some(v => /(^|\s|\()(you|me)(\s|\)|$)/i.test(v))) return true;
  const lines = String(row.innerText || "")
    .split(/\r?\n+/)
    .map(s => cleanSpeaker(s))
    .filter(Boolean);
  return lines.some(v => /^(you|me)$/i.test(v));
}

function findSpeakerInfo(row) {
  if (rowHasYouMarker(row)) return { speaker: "You", isSelf: true };

  const explicit = row.querySelector?.('[data-speaker-name], [data-speaker], [aria-label*="speaker" i]');
  if (explicit) {
    const label = cleanSpeaker(explicit.getAttribute("data-speaker-name") || explicit.getAttribute("data-speaker") || explicit.getAttribute("aria-label"));
    if (isPlausibleSpeaker(label)) return { speaker: label, isSelf: false };
  }

  const jsSpeaker = row.querySelector?.('[jsname="YSxPC"]');
  if (jsSpeaker) {
    const label = cleanSpeaker(engineText(jsSpeaker));
    if (/^(you|me)$/i.test(label)) return { speaker: "You", isSelf: true };
    if (isPlausibleSpeaker(label)) return { speaker: label, isSelf: false };
  }

  const candidates = [...(row.querySelectorAll?.('span,div,[role="text"],[jsname]') || [])]
    .map(engineText)
    .filter(Boolean);
  const exactYou = candidates.find(v => /^(you|me)$/i.test(v));
  if (exactYou) return { speaker: "You", isSelf: true };
  const nonJapanese = candidates.find(isPlausibleSpeaker);
  return { speaker: nonJapanese || "", isSelf: false };
}

function findTextInRow(row) {
  const preferred = [
    '[jsname="r4nke"]',
    '[jsname="bVV8Bd"]',
    '[data-caption-text]',
    '[data-subtitle-text]'
  ];
  for (const selector of preferred) {
    const el = row.querySelector?.(selector);
    const text = engineText(el);
    if (isLikelyJapaneseCaption(text)) return text;
  }

  const leaves = [];
  for (const el of row.querySelectorAll?.('span,div,p,[role="text"],[jsname]') || []) {
    if (!el.children.length && engineVisible(el, row.ownerDocument.defaultView, "jp-live-translator-external-window-host")) {
      const text = engineText(el);
      if (isLikelyJapaneseCaption(text)) leaves.push(text);
    }
  }
  if (leaves.length) return leaves.sort((a, b) => b.length - a.length)[0];
  const own = engineText(row);
  return isLikelyJapaneseCaption(own) ? own : "";
}

function rowLooksRelevant(row) {
  if (!row) return false;
  const text = engineText(row);
  return text && text.length <= 1600;
}

function makeRow(row, method) {
  const info = findSpeakerInfo(row);
  const caption = findTextInRow(row);
  if (!caption || !isLikelyJapaneseCaption(caption)) return null;
  const rect = row.getBoundingClientRect();
  return {
    speaker: info.speaker,
    isSelf: info.isSelf,
    text: caption,
    element: row,
    method,
    bottom: rect.bottom,
    top: rect.top,
  };
}

function dedupeRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.isSelf ? "self" : "remote"}\n${row.speaker}\n${row.text}`;
    const existing = map.get(key);
    if (!existing || row.bottom > existing.bottom) map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.bottom - b.bottom);
}

function extractByJsname(root) {
  const rows = [];
  const seen = new Set();
  const textNodes = [...root.querySelectorAll?.('[jsname="r4nke"], [jsname="bVV8Bd"], [data-caption-text], [data-subtitle-text]') || []];
  for (const textEl of textNodes) {
    if (seen.has(textEl)) continue;
    let row = textEl.closest?.('[jsname="YSxPC"], [jsname="bVV8Bd"]') || textEl.parentElement;
    for (let i = 0; row && i < 6; i += 1, row = row.parentElement) {
      if (!rowLooksRelevant(row)) continue;
      const item = makeRow(row, "jsname-row");
      if (item) rows.push(item);
      break;
    }
    seen.add(textEl);
  }
  return dedupeRows(rows);
}

function extractByPosition(root, win) {
  const rows = [];
  for (const child of [...root.children || []]) {
    if (!engineVisible(child, win, "jp-live-translator-external-window-host") || engineDialog(child)) continue;
    const item = makeRow(child, "position-row");
    if (item) rows.push(item);
  }
  return dedupeRows(rows);
}

function extractLeafRows(root, win) {
  const rows = [];
  const els = root.querySelectorAll?.('span,div,p,[role="text"],[jsname]') || [];
  for (const el of els) {
    if (!engineVisible(el, win, "jp-live-translator-external-window-host") || engineInteractive(el)) continue;
    if (el.children.length) continue;
    if (!isLikelyJapaneseCaption(engineText(el))) continue;
    const row = el.parentElement;
    const item = row ? makeRow(row, "leaf") : null;
    if (item) rows.push(item);
  }
  return dedupeRows(rows);
}

function extractCaptionRows(doc, platform, hostId = "jp-live-translator-external-window-host") {
  const win = doc.defaultView;
  const root = findCaptionRoot(doc, platform, hostId);
  if (root) {
    const byJs = platform === "google_meet" ? extractByJsname(root) : [];
    if (byJs.length) return { rows: byJs, root, method: byJs[0].method };
    const byPosition = extractByPosition(root, win);
    if (byPosition.length) return { rows: byPosition, root, method: byPosition[0].method };
    const byLeaf = extractLeafRows(root, win);
    if (byLeaf.length) return { rows: byLeaf, root, method: byLeaf[0].method };
  }

  // Fallback: require an explicit You/remote speaker marker when using
  // interviewee-only mode. The content layer decides whether to accept it.
  const candidates = [];
  for (const el of doc.querySelectorAll?.('span,div,p,[role="text"],[jsname]') || []) {
    if (!engineVisible(el, win, hostId) || engineDialog(el) || engineInteractive(el)) continue;
    const text = engineText(el);
    if (!isLikelyJapaneseCaption(text) || text.length > 1600 || el.children.length) continue;
    const rect = el.getBoundingClientRect();
    if (rect.bottom < win.innerHeight * 0.45) continue;
    const parent = el.parentElement;
    const item = parent ? makeRow(parent, "page-fallback") : null;
    if (item) candidates.push(item);
  }
  if (!candidates.length) return { rows: [], root: root || null, method: root ? "root-empty" : "none" };
  const deduped = dedupeRows(candidates);
  return { rows: [deduped[deduped.length - 1]], root: root || null, method: "page-fallback" };
}

function extractCaptionCandidate(doc, platform, hostId = "jp-live-translator-external-window-host") {
  const result = extractCaptionRows(doc, platform, hostId);
  const best = result.rows[0];
  return best ? { ...best, method: result.method, root: result.root } : { text: "", speaker: "", isSelf: false, method: result.method, root: result.root };
}

if (typeof globalThis !== "undefined") Object.assign(globalThis, { extractCaptionRows, extractCaptionCandidate, findCaptionRoot, engineWalkRoots });
if (typeof module !== "undefined" && module.exports) module.exports = { extractCaptionRows, extractCaptionCandidate, findCaptionRoot, engineWalkRoots };
