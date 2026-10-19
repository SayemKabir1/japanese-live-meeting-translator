const assert = require('node:assert/strict');
const c = require('../extension/src/caption-utils.js');
const u = require('../extension/src/utterance-utils.js');
const s = require('../extension/src/speaker-utils.js');
Object.assign(global, c, u, s);
const { InterviewTurnProcessor } = require('../extension/src/interview-processor.js');
const p = new InterviewTurnProcessor({stabilityDelayMs:250, questionsOnly:true, captureMode:'interviewee_only', lockFirstRemoteSpeaker:true});
let now=1000;
const row=(text)=>[{speaker:'InterviewerCandidate',isSelf:false,text,bottom:700}];
let out=p.processRows(row('今何歳ですか？'),now);
assert.deepEqual(out,[], 'completed unit has a short debounce');
out=p.processRows(row('今何歳ですか？'),now+260);
assert.deepEqual(out.map(x=>x.text),['今何歳ですか？'],'first complete question flushes at 250ms');
// Cumulative caption grows for a long time: each new fully punctuated question is
// translated without waiting for the entire caption node to become stable.
now=2000;
out=p.processRows(row('今何歳ですか？水曜日は何ですか？'),now);
assert.deepEqual(out,[], 'new complete question gets its own debounce');
out=p.processRows(row('今何歳ですか？水曜日は何ですか？どのくらい日本語を勉強していますか？'),now+270);
assert.deepEqual(out.map(x=>x.text),['水曜日は何ですか？'],'previous question suppressed and newest completed question emitted');
out=p.processRows(row('今何歳ですか？水曜日は何ですか？どのくらい日本語を勉強していますか？あなたは？'),now+540);
assert.deepEqual(out.map(x=>x.text),['どのくらい日本語を勉強していますか？'],'new full question emitted even as transcript keeps growing');
out=p.processRows(row('今何歳ですか？水曜日は何ですか？どのくらい日本語を勉強していますか？あなたは？'),now+810);
assert.deepEqual(out.map(x=>x.text),['あなたは？'],'final question is not held until a long pause');
// A short punctuation fragment revised into a longer question is cancelled.
const p2 = new InterviewTurnProcessor({stabilityDelayMs:250, questionsOnly:true, captureMode:'target_speaker',targetSpeaker:'Guest'});
let t=4000;
p2.processRows([{speaker:'Guest',isSelf:false,text:'今何を？',bottom:700}],t);
p2.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？',bottom:700}],t+100);
out=p2.processRows([{speaker:'Guest',isSelf:false,text:'今何を知っていますか？',bottom:700}],t+360);
assert.deepEqual(out.map(x=>x.text),['今何を知っていますか？'],'interim fragment is not emitted when revised promptly');
// Self rows remain excluded.
out=p2.processRows([{speaker:'You',isSelf:true,text:'あなたは？',bottom:700}],t+1000);
assert.deepEqual(out,[],'self captions are excluded');
console.log('v0.9.4 fast stream regression: PASS (incremental complete questions, no replay, revised-fragment cancellation)');
