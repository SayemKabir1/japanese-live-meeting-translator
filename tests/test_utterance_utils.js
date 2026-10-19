const u=require('../extension/src/utterance-utils.js');
function eq(a,b,m){if(a!==b)throw new Error(`${m}\nexpected: ${b}\nactual: ${a}`)}
function deep(a,b,m){const A=JSON.stringify(a),B=JSON.stringify(b);if(A!==B)throw new Error(`${m}\nexpected: ${B}\nactual: ${A}`)}
eq(u.deriveRollingDelta('', 'こんにちは。'),'こんにちは。','first caption');
eq(u.deriveRollingDelta('こんにちは。','こんにちは。おはようございます。'),'おはようございます。','rolling appended');
eq(u.deriveRollingDelta('お名前は何ですか？','お名前は何ですか？お名前は何ですか？'),'お名前は何ですか？','duplicate rolling delta');
eq(u.stripLeadingDuplicate('お名前は何ですか？なるほど。',['お名前は何ですか？']),'なるほど。','strip committed duplicate');
deep(u.extractQuestionUnits('あー、私はあのちょっと待ったです。今どこに住んでいますか？'),{complete:['今どこに住んでいますか？'],nonQuestionComplete:['あー、私はあのちょっと待ったです。'],remainder:''},'lead-in is merged with question');
deep(u.extractQuestionUnits('自己紹介をお願いします。今はどこに住んでいますか？'),{complete:['自己紹介をお願いします。','今はどこに住んでいますか？'],nonQuestionComplete:[],remainder:''},'request and question are separate units');
console.log('utterance-utils: 6/6 passed');
