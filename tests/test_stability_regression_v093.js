const assert = require('node:assert/strict');
const c = require('../extension/src/caption-utils.js');
const u = require('../extension/src/utterance-utils.js');
const s = require('../extension/src/speaker-utils.js');
Object.assign(global, c, u, s);
const { InterviewTurnProcessor } = require('../extension/src/interview-processor.js');

function eq(actual, expected, msg) { assert.deepEqual(actual, expected, msg); }

const p = new InterviewTurnProcessor({
  captureMode: 'interviewee_only',
  lockFirstRemoteSpeaker: true,
  requireSpeakerAttribution: true,
  stabilityDelayMs: 550,
  utteranceExpiryMs: 1800,
  questionsOnly: true,
});

let t = 1000;
let out = p.processRows([{speaker:'Guest',isSelf:false,text:'今何を？',bottom:700}], t);
eq(out, [], 'intermediate question fragment must not translate');

t += 350;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？',bottom:700}], t);
eq(out, [], 'updated question still waits for stable window');

t += 300;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？',bottom:700}], t);
eq(out, [], '300ms is not enough for the fast finalization window');

t += 350;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？',bottom:700}], t);
eq(out, [{speaker:'Guest',text:'今何を知っていますか？',reason:'question-stable'}],
   'complete stable question emitted once at the faster profile');

// Rolling historical text plus a new question emits only the unseen question.
t += 200;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？お名前は？',bottom:700}], t);
eq(out, [], 'new rolling caption waits');
t += 300;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？お名前は何ですか？',bottom:700}], t);
eq(out, [], 'new question revision replaces the partial');
t += 600;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？お名前は何ですか？',bottom:700}], t);
eq(out, [{speaker:'Guest',text:'お名前は何ですか？',reason:'question-stable'}],
   'only the new complete question is emitted');

// Common filler must not become a translation request.
t += 200;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'あの？',bottom:700}], t);
eq(out, [], 'filler question ignored');
t += 1000;
out = p.processRows([{speaker:'Guest',isSelf:false,text:'あの？',bottom:700}], t);
eq(out, [], 'stable filler still ignored');

// Speech tagged as self must never emit.
out = p.processRows([{speaker:'You',isSelf:true,text:'私は東京に住んでいますか？',bottom:760}], t + 1000);
eq(out, [], 'self speech excluded');

console.log('fast stability regression: PASS (0.55s punctuation delay; 0 partial/duplicate emissions)');
