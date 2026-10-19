/* global INTERVIEW_DEFAULTS, extractCaptionRows, InterviewTurnProcessor, normalizeCaptionText, isLikelyJapaneseCaption, hashText */
const state = {
  platform: location.hostname.includes("meet.google.com") ? "google_meet" : "zoom",
  enabled: true,
  serverUrl: "http://127.0.0.1:8785",
  captureMode: "interviewee_only",
  targetSpeaker: "",
  showOriginal: true,
  processor: null,
  queue: [],
  activeKeys: new Set(),
  recentKeys: new Map(),
  translating: false,
  pageObserver: null,
  scanTimer: null,
};
function getSettings(){return new Promise(resolve=>chrome.runtime.sendMessage({type:"GET_SETTINGS"},r=>resolve(r?.settings||{})));}
function uiStatus(message,statusType="ok"){chrome.runtime.sendMessage({type:"UI_STATUS",message,statusType}).catch?.(()=>{});}
function pruneRecent(){const now=Date.now();for(const [k,t] of state.recentKeys){if(now-t>30000)state.recentKeys.delete(k);}}
function enqueue(items){
  pruneRecent();
  for(const item of items){
    const text=normalizeCaptionText(item.text); if(!text||!isLikelyJapaneseCaption(text))continue;
    const key=hashText(`${item.speaker}\n${text}`);
    if(state.activeKeys.has(key)||state.recentKeys.has(key))continue;
    state.activeKeys.add(key); state.recentKeys.set(key,Date.now()); state.queue.push({...item,text,key});
  }
  const maxPending = Math.max(8, Number(state.maxPendingTranslations)||8);
  // Never discard pending interviewee questions. A backlog is preferable to
  // silently missing a question. The queue is normally tiny because only
  // stable complete questions are emitted.
  if (state.queue.length > maxPending) uiStatus(`Translation queue: ${state.queue.length}`,"warning");
  void pumpQueue();
}
async function translateOne(item){
  const result=await new Promise(resolve=>chrome.runtime.sendMessage({type:"TRANSLATE",text:item.text,platform:state.platform,speaker:item.speaker},r=>resolve(r)));
  state.activeKeys.delete(item.key);
  if(!result?.ok){state.recentKeys.delete(item.key);uiStatus(result?.error||"Local translation unavailable","error");return;}
  const translation=normalizeCaptionText(result.data?.translation||"");
  if(!translation){state.recentKeys.delete(item.key);uiStatus("Empty translation returned","error");return;}
  chrome.runtime.sendMessage({type:"SHOW_TRANSLATION",item:{original:state.showOriginal?item.text:"",translation,speaker:item.speaker,latencyMs:result.data?.latency_ms||0,time:Date.now()}});
  uiStatus(`Translated · ${Math.round(result.data?.latency_ms||0)} ms`,"ok");
}
async function pumpQueue(){if(state.translating)return;state.translating=true;try{while(state.queue.length)await translateOne(state.queue.shift());}finally{state.translating=false;}}
function scan(){
  if(!state.enabled||!state.processor)return;
  const result=extractCaptionRows(document,state.platform);
  const emitted=result.rows?.length?state.processor.processRows(result.rows,Date.now()):state.processor.flushDue(Date.now());
  if(emitted.length){uiStatus("Processing interviewee question…","ok");enqueue(emitted);} else if(!result.rows?.length){uiStatus("Waiting for interviewee captions…","ok");} else {uiStatus("Listening for the next complete question…","ok");}
  chrome.runtime.sendMessage({type:"SPEAKER_LOCK",name:state.processor.lockedSpeaker||state.targetSpeaker||"Auto (first remote speaker)"});
}
function findCaptionButton(){
  if(state.platform!=="google_meet")return null;
  const els=[...document.querySelectorAll('button[aria-label], [role="button"][aria-label], [role="button"][data-tooltip]')];
  const onRe=/turn off captions|hide captions|字幕をオフ|字幕を非表示|字幕を停止/i;
  const offRe=/turn on captions|show captions|enable captions|字幕をオン|字幕を表示|字幕を開始/i;
  for(const el of els){const label=`${el.getAttribute("aria-label")||""} ${el.getAttribute("data-tooltip")||""}`;if(!/caption|subtitle|字幕/i.test(label)||/setting/i.test(label))continue;if(onRe.test(label)||el.getAttribute("aria-pressed")==="true")return{el,on:true};if(offRe.test(label)||el.getAttribute("aria-pressed")==="false")return{el,on:false};}
  return null;
}
function ensureCaptionsOn(){const found=findCaptionButton();if(found&&!found.on){try{found.el.click();}catch(_){}}}
async function init(){
  const settings=await getSettings(); Object.assign(state,INTERVIEW_DEFAULTS,settings); state.serverUrl=state.serverUrl||"http://127.0.0.1:8785"; state.showOriginal=settings.showOriginal!==false; state.processor=new InterviewTurnProcessor(settings);
  chrome.runtime.sendMessage({type:"OPEN_TRANSLATOR_WINDOW"});
  state.pageObserver=new MutationObserver(()=>{if(state.scanTimer)return;state.scanTimer=setTimeout(()=>{state.scanTimer=null;scan();},60);});
  state.pageObserver.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{ensureCaptionsOn();scan();},200); ensureCaptionsOn(); scan();
}
init();
