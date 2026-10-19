const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSpeakerName, speakerMatches, shouldTranslateSpeaker } = require('./speaker-utils.js');

test('normalizes and matches speaker names',()=>{ assert.equal(normalizeSpeakerName('  Interviewee   A  '),'Interviewee A'); assert.equal(speakerMatches('Interviewee A','interviewee'),true); });
test('explicit You/self is excluded',()=>{ assert.equal(shouldTranslateSpeaker({speaker:'You',isSelf:true}).ok,false); assert.equal(shouldTranslateSpeaker({speaker:'You'}).ok,false); });
test('remote speaker is accepted when attributed',()=>{ assert.equal(shouldTranslateSpeaker({speaker:'Alice',isSelf:false,requireSpeakerAttribution:true}).ok,true); });
test('unknown speaker is rejected',()=>{ assert.equal(shouldTranslateSpeaker({speaker:'',requireSpeakerAttribution:true}).ok,false); });
test('target-speaker mode only accepts selected person',()=>{ assert.equal(shouldTranslateSpeaker({speaker:'Alice Smith',captureMode:'target_speaker',targetSpeaker:'Alice'}).ok,true); assert.equal(shouldTranslateSpeaker({speaker:'Bob',captureMode:'target_speaker',targetSpeaker:'Alice'}).ok,false); });
