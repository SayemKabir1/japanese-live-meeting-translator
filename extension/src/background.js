const DEFAULTS={
  serverUrl:"http://127.0.0.1:8785",enabled:true,targetLanguage:"English",stabilityDelayMs:250,utteranceExpiryMs:1800,maxContextLines:1,showOriginal:true,captureMode:"interviewee_only",targetSpeaker:"",lockFirstRemoteSpeaker:true,requireSpeakerAttribution:true,questionsOnly:true,maxPendingTranslations:8
};
const SETTINGS_VERSION=12;
let translatorWindowId=null,translatorTabId=null,userClosedWindow=false,lastItem=null,lastStatus={message:"Waiting for interviewee questions…",type:"ok"},speakerLock="Auto (first remote speaker)";
async function getSettings(){
  const stored=await chrome.storage.local.get({ ...DEFAULTS, settingsVersion: 0 });
  const oldVersion=Number(stored.settingsVersion||0);
  if(oldVersion<SETTINGS_VERSION){
    const update={questionsOnly:true,settingsVersion:SETTINGS_VERSION};
    // Existing installs commonly persisted the previous 1200 ms debounce.
    // Lower that old default automatically, but preserve deliberately chosen
    // faster custom values.
    const oldDelay=Number(stored.stabilityDelayMs||0);
    if(!oldDelay || (oldVersion<12 && oldDelay>=500)) update.stabilityDelayMs=250;
    const oldExpiry=Number(stored.utteranceExpiryMs||0);
    if(!oldExpiry || (oldVersion<11 && oldExpiry>2500)) update.utteranceExpiryMs=1800;
    Object.assign(stored,update);
    await chrome.storage.local.set(update);
  }
  return { ...DEFAULTS, ...stored };
}
async function openTranslatorWindow(focus=true){
  if(translatorWindowId!==null){try{const w=await chrome.windows.get(translatorWindowId,{populate:true}); if(w){if(focus)await chrome.windows.update(translatorWindowId,{focused:true,state:w.state==='minimized'?'normal':w.state}); return;} }catch(_){} translatorWindowId=null;translatorTabId=null;}
  const w=await chrome.windows.create({url:chrome.runtime.getURL('translator.html'),type:'popup',width:560,height:720,focused:focus});
  translatorWindowId=w.id;translatorTabId=w.tabs?.[0]?.id||null;userClosedWindow=false;
  return w;
}
async function sendToTranslator(message){
  if(translatorTabId===null)return false;
  try{await chrome.tabs.sendMessage(translatorTabId,message);return true;}catch(_){return false;}
}
chrome.windows.onRemoved.addListener(id=>{if(id===translatorWindowId){translatorWindowId=null;translatorTabId=null;userClosedWindow=true;}});
chrome.runtime.onInstalled.addListener(async()=>{
  const current=await chrome.storage.local.get({...DEFAULTS,settingsVersion:0});
  const oldVersion=Number(current.settingsVersion||0);
  const next={...DEFAULTS,...current,questionsOnly:true,settingsVersion:SETTINGS_VERSION};
  if(oldVersion<12 && (!Number(current.stabilityDelayMs)||Number(current.stabilityDelayMs)>=500)) next.stabilityDelayMs=250;
  if(oldVersion<11 && (!Number(current.utteranceExpiryMs)||Number(current.utteranceExpiryMs)>2500)) next.utteranceExpiryMs=1800;
  await chrome.storage.local.set(next);
});
chrome.action.onClicked.addListener(()=>openTranslatorWindow(true));
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  (async()=>{
    if(message?.type==='GET_SETTINGS'){sendResponse({ok:true,settings:await getSettings()});return;}
    if(message?.type==='OPEN_TRANSLATOR_WINDOW'){await openTranslatorWindow(false); if(lastItem)await sendToTranslator({type:'WINDOW_RESET',item:lastItem}); if(lastStatus)await sendToTranslator({type:'UI_STATUS',message:lastStatus.message,statusType:lastStatus.type}); await sendToTranslator({type:'SPEAKER_LOCK',name:speakerLock}); sendResponse({ok:true});return;}
    if(message?.type==='TRANSLATOR_READY'){await sendToTranslator({type:'WINDOW_RESET',item:lastItem});await sendToTranslator({type:'UI_STATUS',message:lastStatus.message,statusType:lastStatus.type});await sendToTranslator({type:'SPEAKER_LOCK',name:speakerLock});sendResponse({ok:true});return;}
    if(message?.type==='SHOW_TRANSLATION'){lastItem=message.item;if(!userClosedWindow){await openTranslatorWindow(false);await sendToTranslator({type:'SHOW_TRANSLATION',item:lastItem});} sendResponse({ok:true});return;}
    if(message?.type==='CLEAR_TRANSLATION'){lastItem=null;await sendToTranslator({type:'WINDOW_RESET',item:null});sendResponse({ok:true});return;}
    if(message?.type==='UI_STATUS'){lastStatus={message:String(message.message||''),type:String(message.statusType||'ok')}; if(!userClosedWindow)await sendToTranslator({type:'UI_STATUS',message:lastStatus.message,statusType:lastStatus.type});sendResponse({ok:true});return;}
    if(message?.type==='SPEAKER_LOCK'){speakerLock=String(message.name||'Auto'); if(!userClosedWindow)await sendToTranslator({type:'SPEAKER_LOCK',name:speakerLock}); sendResponse({ok:true});return;}
    if(message?.type==='TRANSLATE'){
      const settings=await getSettings(); if(!settings.enabled){sendResponse({ok:false,disabled:true});return;}
      let response;try{response=await fetch(`${settings.serverUrl}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:message.text,context:message.context||[],target_language:settings.targetLanguage,platform:message.platform||'unknown',speaker:message.speaker||''})});}catch(error){sendResponse({ok:false,code:0,error:`Cannot reach local translation server: ${error.message||error}`});return;}
      const data=await response.json().catch(()=>({}));if(!response.ok){const detail=data?.detail;if(detail&&typeof detail==='object'){sendResponse({ok:false,code:response.status,error:detail.message||`Translation server returned ${response.status}`,retryAfterMs:Number(detail.retry_after_ms||0)});return;}sendResponse({ok:false,code:response.status,error:detail||`Translation server returned ${response.status}`});return;}
      sendResponse({ok:true,data});return;
    }
    if(message?.type==='HEALTH'){const settings=await getSettings();try{const response=await fetch(`${settings.serverUrl}/health`);const data=await response.json();sendResponse({ok:true,data});}catch(error){sendResponse({ok:false,error:String(error)});}return;}
    sendResponse({ok:false,error:'Unknown message type'});
  })().catch(error=>sendResponse({ok:false,error:error.message||String(error)}));
  return true;
});
