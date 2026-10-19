const assert = require('node:assert/strict');
const c=require('../extension/src/caption-utils.js');
const u=require('../extension/src/utterance-utils.js');
const s=require('../extension/src/speaker-utils.js');
Object.assign(global,c,u,s);
const {InterviewTurnProcessor}=require('../extension/src/interview-processor.js');
function eq(a,b,m){assert.deepEqual(a,b,m)}
const p=new InterviewTurnProcessor({captureMode:'interviewee_only',lockFirstRemoteSpeaker:true,requireSpeakerAttribution:true,stabilityDelayMs:1200,utteranceExpiryMs:2500,questionsOnly:true});
const speaker='Interviewee A';
let t=1000, out;
const steps=[
  ['もさんが今大丈夫ですか？',0,0],
  ['もさんが今大丈夫ですか？',500,0],
  ['もさんが今大丈夫ですか？',1250,[['もさんが今大丈夫ですか？','question-stable']]],
  ['今何を？',200,0],
  ['今何を知っていますか？',350,0],
  ['今何を知っていますか？',1300,[['今何を知っていますか？','question-stable']]],
  ['お名前は？',250,0],
  ['お名前は何？',300,0],
  ['お名前は何ですか？',350,0],
  ['お名前は何ですか？',1300,[['お名前は何ですか？','question-stable']]],
  ['鉱山は何を？',250,0],
  ['鉱山は何をしていますか？',350,0],
  ['鉱山は何をしていますか？',1300,[['鉱山は何をしていますか？','question-stable']]],
  ['今の仕事について教えてください。',250,0],
  ['今の仕事について教えてください。',1300,[['今の仕事について教えてください。','question-stable']]],
];
let expectedCount=0;
for(const [text,delta,expected] of steps){t+=delta;out=p.processRows([{speaker,isSelf:false,text,bottom:700}],t);if(expected){eq(out,expected.map(([x,reason])=>({speaker,text:x,reason})),`expected stable output for ${text}`);expectedCount+=expected.length}else eq(out,[] ,`no premature output for ${text}`);}
assert.equal(expectedCount,5,'five complete interviewee questions only');
// Self speech in the same visible Meet region must never emit.
t+=2000;out=p.processRows([{speaker:'You',isSelf:true,text:'あなたの名前は何ですか？',bottom:760}],t);eq(out,[],'self speech excluded');
console.log('video regression v0.9.4: PASS (5/5 complete questions, 0 premature fragments)');
