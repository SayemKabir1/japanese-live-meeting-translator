const assert = require('node:assert/strict');
const c=require('../extension/src/caption-utils.js');
const u=require('../extension/src/utterance-utils.js');
const s=require('../extension/src/speaker-utils.js');
Object.assign(global,c,u,s);
const {InterviewTurnProcessor}=require('../extension/src/interview-processor.js');
function eq(a,b,m){assert.deepEqual(a,b,m)}
const p=new InterviewTurnProcessor({captureMode:'interviewee_only',lockFirstRemoteSpeaker:true,requireSpeakerAttribution:true,stabilityDelayMs:1200,utteranceExpiryMs:2500,questionsOnly:true});
let t=1000;
let out=p.processRows([{speaker:'Interviewee A',isSelf:false,text:'お名前は何ですか？',bottom:650},{speaker:'You',isSelf:true,text:'あなたの名前は何ですか？',bottom:730}],t);eq(out,[],'stable wait; self excluded');
t+=1300;out=p.processRows([{speaker:'Interviewee A',isSelf:false,text:'お名前は何ですか？',bottom:650}],t);eq(out,[{speaker:'Interviewee A',text:'お名前は何ですか？',reason:'question-stable'}],'remote question emitted after stability');
out=p.processRows([{speaker:'Interviewee A',isSelf:false,text:'お名前は何ですか？お名前は何ですか？',bottom:650}],t+10);eq(out,[],'duplicate rolling caption ignored until stable');
out=p.processRows([{speaker:'Interviewee A',isSelf:false,text:'お名前は何ですか？お名前は何ですか？なるほど。',bottom:650}],t+20);eq(out,[],'continuation waits for final stable row');
out=p.processRows([{speaker:'Interviewee A',isSelf:false,text:'お名前は何ですか？お名前は何ですか？なるほど。今どこに住んでいますか？',bottom:650}],t+30);eq(out,[],'new question waits for stability');
out=p.processRows([{speaker:'Interviewee A',isSelf:false,text:'お名前は何ですか？お名前は何ですか？なるほど。今どこに住んでいますか？',bottom:650}],t+1330);eq(out,[{speaker:'Interviewee A',text:'今どこに住んでいますか？',reason:'question-stable'}],'new question emitted alone after stable');
out=p.processRows([{speaker:'You',isSelf:true,text:'私は東京に住んでいますか？',bottom:760}],t+1400);eq(out,[],'self speech excluded');
const q=new InterviewTurnProcessor({captureMode:'target_speaker',targetSpeaker:'Tanaka',requireSpeakerAttribution:true,stabilityDelayMs:1200,questionsOnly:true});
out=q.processRows([{speaker:'Sato',isSelf:false,text:'お元気ですか？',bottom:650},{speaker:'Tanaka',isSelf:false,text:'今どこに住んでいますか？',bottom:730}],1000);eq(out,[],'target stable wait');out=q.processRows([{speaker:'Tanaka',isSelf:false,text:'今どこに住んでいますか？',bottom:730}],2300);eq(out,[{speaker:'Tanaka',text:'今どこに住んでいますか？',reason:'question-stable'}],'target speaker stable output');
console.log('interview-processor: PASS');
