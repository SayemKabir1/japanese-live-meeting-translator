const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('./caption-utils.js');
global.normalizeCaptionText = utils.normalizeCaptionText;
global.isLikelyJapaneseCaption = utils.isLikelyJapaneseCaption;
global.japaneseRatio = utils.japaneseRatio;
const { extractCaptionRows } = require('./meet-caption-engine.js');

class FakeElement {
  constructor({ tag = 'div', text = '', attrs = {}, children = [], rect = { left: 100, top: 700, width: 500, height: 40, bottom: 740 } } = {}) {
    this.tagName = tag.toUpperCase();
    this._text = text;
    this.attrs = attrs;
    this.children = children;
    this.parentElement = null;
    this.ownerDocument = null;
    this.rect = rect;
    for (const c of children) { c.parentElement = this; }
  }
  get textContent() { return this._text || this.children.map(c => c.textContent).join(''); }
  get innerText() { return this.textContent; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  matches(sel) { return matchSelector(this, sel); }
  closest(sel) { let n = this; while (n) { if (matchSelector(n, sel)) return n; n = n.parentElement; } return null; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => { for (const c of n.children) { if (matchSelector(c, sel)) out.push(c); walk(c); } };
    walk(this); return out;
  }
  getBoundingClientRect() { return this.rect; }
}

function matchSelector(el, sel) {
  const terms = sel.split(',').map(s => s.trim());
  return terms.some(term => {
    if (term.startsWith('[jsname="')) return el.getAttribute('jsname') === term.slice(9, -2);
    if (term === '[role="text"]') return el.getAttribute('role') === 'text';
    if (term === '[data-caption-text]') return el.getAttribute('data-caption-text') !== null;
    if (term === '[data-subtitle-text]') return el.getAttribute('data-subtitle-text') !== null;
    if (term === '[role="dialog"], [role="alertdialog"]') return false;
    if (term === 'span' || term === 'div' || term === 'p') return el.tagName.toLowerCase() === term;
    return false;
  });
}

function buildDoc(root) {
  const all = [root];
  const collect = (n) => n.children.forEach(c => { all.push(c); collect(c); });
  collect(root);
  const win = { innerHeight: 900, Element: FakeElement, getComputedStyle: () => ({ display:'block', visibility:'visible', opacity:'1', fontSize:'16px' }) };
  const doc = {
    defaultView: win,
    documentElement: root,
    querySelectorAll(sel) {
      const out = [];
      for (const n of all) if (matchSelector(n, sel)) out.push(n);
      return out;
    },
  };
  all.forEach(n => { n.ownerDocument = doc; });
  return doc;
}

test('extracts Meet-style speaker and caption rows', () => {
  const speaker = new FakeElement({ text: 'Alice Smith', attrs: { jsname: 'YSxPC' } });
  const caption = new FakeElement({ text: '仕様書について確認させてください。', attrs: { jsname: 'r4nke' } });
  const row = new FakeElement({ attrs: { jsname: 'bVV8Bd' }, children: [speaker, caption] });
  const root = new FakeElement({ attrs: { jsname: 'tgaKEf' }, children: [row], rect: { left: 200, top: 700, width: 600, height: 90, bottom: 790 } });
  const doc = buildDoc(root);
  const result = extractCaptionRows(doc, 'google_meet');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].speaker, 'Alice Smith');
  assert.equal(result.rows[0].text, '仕様書について確認させてください。');
});

test('position fallback keeps speaker unknown when no label exists', () => {
  const caption = new FakeElement({ text: 'こんにちは、皆さん。' });
  const row = new FakeElement({ attrs: {}, children: [caption], rect: { left: 200, top: 700, width: 600, height: 90, bottom: 790 } });
  const root = new FakeElement({ attrs: { 'aria-live': 'polite' }, children: [row], rect: { left: 200, top: 650, width: 600, height: 160, bottom: 810 } });
  const doc = buildDoc(root);
  const result = extractCaptionRows(doc, 'google_meet');
  assert.equal(result.rows[0].speaker, '');
  assert.equal(result.rows[0].text, 'こんにちは、皆さん。');
});
