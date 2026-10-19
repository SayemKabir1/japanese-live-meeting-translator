const c=require('../extension/src/caption-utils.js');
const u=require('../extension/src/utterance-utils.js');
const s=require('../extension/src/speaker-utils.js');
Object.assign(global,c,u,s);
const {InterviewTurnProcessor}=require('../extension/src/interview-processor.js');
function assert(cond,msg){if(!cond)throw new Error(msg)}
function simulate(sentenceA,sentenceB){
  const p=new InterviewTurnProcessor({captureMode:'interviewee_only',lockFirstRemoteSpeaker:true,requireSpeakerAttribution:true,stabilityDelayMs:1200,utteranceExpiryMs:2500,questionsOnly:true});
  const out=[]; let now=1000; const speaker='Interviewee';
  for(const sentence of [sentenceA,sentenceB]){
    for(let i=3;i<=sentence.length;i+=Math.max(1,Math.floor(sentence.length/4))){
      const raw=sentence.slice(0,i);
      out.push(...p.processRows([{speaker,isSelf:false,text:raw,bottom:700}],now));
      now+=120;
    }
    out.push(...p.processRows([{speaker,isSelf:false,text:sentence,bottom:700}],now));
    // Hold the exact same final caption beyond the stability window.
    out.push(...p.processRows([{speaker,isSelf:false,text:sentence,bottom:700}],now+1300));
    now+=1500;
    p.processRows([{speaker,isSelf:true,text:'あなたはどう思いますか？',bottom:760}],now);
    now+=300;
  }
  return out;
}
let total=0;
for(let n=0;n<100;n++){
  const a='今どこに住んでいますか？';
  const b='これまでの経験について説明していただけますか？';
  const out=simulate(a,b);
  assert(out.length===2,`sequence ${n} expected 2 outputs, got ${out.length}`);
  assert(out[0].text===a&&out[1].text===b,`sequence ${n} wrong outputs`);
  assert(!out.some(x=>x.text.includes('あなたはどう思いますか？')),'self speech leaked');
  assert(new Set(out.map(x=>x.text)).size===2,'duplicate output');
  total+=out.length;
}
console.log(`stress: 100/100 sequences passed, ${total} distinct interview questions validated`);
