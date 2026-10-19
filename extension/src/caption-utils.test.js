const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCaptionText,
  normalizeCaptionLine,
  japaneseRatio,
  isLikelyJapaneseCaption,
  looksCommittedSentence,
  splitCaptionLines,
  longestSuffixPrefixOverlap,
  deriveCaptionDelta,
  hashText
} = require('./caption-utils.js');

test('normalizes caption text', () => {
  assert.equal(normalizeCaptionText('  こんにちは。\n\n 皆さん。 '), 'こんにちは。 皆さん。');
});

test('normalizes line and splits Japanese lines', () => {
  assert.equal(normalizeCaptionLine('  こんにちは。  '), 'こんにちは。');
  assert.deepEqual(splitCaptionLines('You\nこんにちは。\n皆さん。'), ['こんにちは。', '皆さん。']);
});

test('detects Japanese captions', () => {
  assert.equal(japaneseRatio('こんにちは'), 1);
  assert.equal(isLikelyJapaneseCaption('こんにちは、皆さん。'), true);
  assert.equal(isLikelyJapaneseCaption('Hello everyone'), false);
  assert.equal(isLikelyJapaneseCaption('設定'), false);
});

test('accepts long rolling caption transcripts up to the safety limit', () => {
  const longCaption = '今どこに住んでいますか？'.repeat(35);
  assert.ok(longCaption.length > 320);
  assert.equal(isLikelyJapaneseCaption(longCaption), true);
});

test('recognizes committed Japanese sentence', () => {
  assert.equal(looksCommittedSentence('これはテストです。'), true);
  assert.equal(looksCommittedSentence('これはまだ'), false);
});

test('computes rolling overlap', () => {
  assert.equal(longestSuffixPrefixOverlap('私は仕様書を確認します。原因も確認します。', '原因も確認します。そして修正します。', 4), 9);
});

test('extracts appended caption delta', () => {
  assert.equal(deriveCaptionDelta('こんにちは。', 'こんにちは。今日はいい天気ですね。'), '今日はいい天気ですね。');
});

test('extracts rolling-window delta', () => {
  assert.equal(deriveCaptionDelta('まず原因を確認します。ログも確認します。', 'ログも確認します。そして修正します。'), 'そして修正します。');
});

test('ignores unchanged and shortened caption windows', () => {
  assert.equal(deriveCaptionDelta('こんにちは。', 'こんにちは。'), '');
  assert.equal(deriveCaptionDelta('こんにちは。今日はいい天気です。', '今日はいい天気です。'), '');
});

test('hash is deterministic', () => {
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
});
