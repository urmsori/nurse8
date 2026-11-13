// GitHub Pages 모드: window.claude 없이 사용자가 넣은 API 키로 AI 회사(Gemini, Claude, OpenAI)를 직접 부른다.
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+'[pages] '+m);if(!c)process.exitCode=1;};
const ANT='sk-ant-test-0123456789abcdef',GEM='AIzaTest0123456789abcdefghij',OAI='sk-proj-test0123456789abcdef';
const NOWS='sk-ant-nows-0123456789abcdef',CORS='sk-ant-cors-0123456789abcdef';
let qn=0;
const makeQs=text=>{const n=+((/4지선다 문제 (\d+)개/.exec(text)||[])[1]||1);return JSON.stringify(Array.from({length:n},()=>({unit:'동기부여',q:'새 문제 '+(++qn)+'?',opts:['a','b','c','d'],ans:1,exp:'해설'})));};
// 답을 주지 않고 매달려 있다가, 취소(signal abort)되면 AbortError 로 끝난다.
const hang=signal=>new Promise((_,rej)=>{if(signal)signal.addEventListener('abort',()=>rej(Object.assign(new Error('aborted'),{name:'AbortError'})));});
function sse(events){const enc=new TextEncoder();const text=events.map(e=>'data: '+(typeof e==='string'?e:JSON.stringify(e))+'\n\n').join('');
  // 일부러 이벤트 중간에서 잘라 조각으로 보낸다.
  const parts=[text.slice(0,37),text.slice(37,120),text.slice(120)].map(s=>enc.encode(s));let i=0;
  return {ok:true,status:200,body:{getReader:()=>({read:async()=>i<parts.length?{done:false,value:parts[i++]}:{done:true}})}};}
function chunks(t){const a=[];for(let i=0;i<t.length;i+=4)a.push(t.slice(i,i+4));return a;}
const err=(status,error)=>({ok:false,status,json:async()=>({error})});
const json=o=>({ok:true,status:200,json:async()=>o});
const antReply=t=>[{type:'message_start',message:{}},{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:''}},
  ...chunks(t).map(x=>({type:'content_block_delta',index:1,delta:{type:'text_delta',text:x}})),{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}];
const gemReply=t=>[{candidates:[{content:{role:'model',parts:[{text:'속으로 한 생각',thought:true}]}}]},
  ...chunks(t).map(x=>({candidates:[{content:{role:'model',parts:[{text:x}]}}]})),{candidates:[{content:{parts:[]},finishReason:'STOP'}]}];
const oaiReply=t=>[{choices:[{delta:{role:'assistant',content:''}}]},...chunks(t).map(x=>({choices:[{delta:{content:x}}]})),{choices:[{delta:{},finish_reason:'stop'}]},'[DONE]'];
function makeDom(reqs,flags,recs,before){return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.github.io/nurse8/',beforeParse(w){
  w.scrollTo=()=>{};w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;
  w.addEventListener('error',e=>flags.errors.push(e.message));
  if(before)before(w);
  w.fetch=async(url,o)=>{o=o||{};const body=o.body?JSON.parse(o.body):null,h=o.headers||{};reqs.push({url,method:o.method||'GET',headers:h,body});
    const isGen=!!body&&/JSON 배열만/.test(JSON.stringify(body));
    if(flags.hang==='all'||(flags.hang==='gen'&&isGen)||(flags.hang==='chat'&&body&&!isGen)||(flags.hang==='models'&&!body))return hang(o.signal);
    const say=body?(isGen?makeQs(JSON.stringify(body)):'강사의 답입니다.'):'';
    if(flags.hang==='mid'&&body&&!isGen){const bytes=new TextEncoder().encode(antReply('강사의 답').slice(0,-2).map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''));let sent=false;
      return {ok:true,status:200,body:{getReader:()=>({read:()=>{if(sent)return hang(o.signal);sent=true;return Promise.resolve({done:false,value:bytes});}})}};}
    if(url.startsWith('https://api.anthropic.com/')){
      if(h['x-api-key']===NOWS)return err(400,{type:'invalid_request_error',message:'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use.'});
      if(h['x-api-key']===CORS)return err(401,{type:'authentication_error',message:'CORS requests are not allowed for this Organization because of its settings.'});
      if(h['x-api-key']!==ANT||flags.mode==='bad')return err(401,{type:'authentication_error',message:'invalid x-api-key'});
      if(/\/v1\/models/.test(url))return json({data:[{id:'claude-opus-5-5'}]});
      if(flags.mode==='nofb'&&body.fallbacks)return err(400,{type:'invalid_request_error',message:'fallbacks: unsupported beta'});
      return sse(antReply(say));}
    if(url.startsWith('https://generativelanguage.googleapis.com/')){
      if(h['x-goog-api-key']!==GEM)return err(400,{code:400,message:'API key not valid. Please pass a valid API key.',status:'INVALID_ARGUMENT',details:[{reason:'API_KEY_INVALID'}]});
      if(!body)return json({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.6-flash',supportedGenerationMethods:['generateContent']},
        {name:'models/gemini-3.10-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-4.0-flash-preview',supportedGenerationMethods:['generateContent']},
        {name:'models/gemini-3.10-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/gemini-9.0-flash',supportedGenerationMethods:['embedContent']},{name:'models/gemini-3.10-pro',supportedGenerationMethods:['generateContent']}]});
      if(flags.mode==='quota')return err(429,{code:429,message:'Quota exceeded',status:'RESOURCE_EXHAUSTED'});
      return sse(gemReply(say));}
    if(url.startsWith('https://api.openai.com/')){
      if(h.authorization!=='Bearer '+OAI)return err(401,{message:'Incorrect API key provided',type:'invalid_request_error',code:'invalid_api_key'});
      if(!body)return json({data:[{id:'gpt-4o'},{id:'gpt-5'},{id:'gpt-5.2'},{id:'gpt-5.2-mini'},{id:'gpt-5.4-mini'},{id:'gpt-image-9'},{id:'text-embedding-3-small'}].filter(m=>!(flags.retired&&m.id==='gpt-5.2'))});
      if(flags.retired&&body.model==='gpt-5.2')return err(404,{message:'The model `gpt-5.2` does not exist',type:'invalid_request_error',code:'model_not_found'});
      if(flags.mode==='nocredit')return err(429,{message:'You exceeded your current quota',type:'insufficient_quota',code:'insufficient_quota'});
      return sse(oaiReply(say));}
    throw new TypeError('network');};
  w.webkitSpeechRecognition=function(){const r=this;recs.push(r);r.start=()=>setTimeout(()=>r.onstart&&r.onstart(),0);r.stop=()=>setTimeout(()=>r.onend&&r.onend(),0);};
}});}
(async()=>{
const reqs=[],flags={mode:'ok',errors:[],retired:false},recs=[];
const w=makeDom(reqs,flags,recs).window,d=w.document;await wait(50);
const $=s=>d.querySelector(s),$$=s=>[...d.querySelectorAll(s)];
const click=el=>{if(!el)throw new Error('missing element');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
const submit=f=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const type=v=>{const i=$('#keyIn');i.value=v;i.dispatchEvent(new w.Event('input',{bubbles:true}));};
const connect=async v=>{type(v);submit($('form[data-form="key"]'));await wait(40);};
const ask=async t=>{$('#chatIn').value=t;submit($('form[data-form="chat"]'));await wait(60);};
const conn=()=>JSON.parse(w.localStorage.getItem('nurse8-key-v1')||'null');
const forget=async()=>{w.location.hash='records';await wait(30);click($('[data-act="forgetKey"]'));w.location.hash='tutor';await wait(30);};
let n=0;
const res=(f,v)=>Object.assign([{transcript:v}],{isFinal:f});
ok(!w.claude,'no window.claude');
w.location.hash='tutor';await wait(30);
// 안내 카드
ok($('form[data-form="key"]')&&$('#chatIn').disabled,'guide card shown, chat disabled');
ok($$('[data-act="prov"]').length===3&&$('[data-act="prov"][aria-pressed="true"]').dataset.p==='gemini','three providers, Gemini preselected');
ok($$('.steps li').length>=5&&/Gemini 앱이 아니라/.test($('.steps').textContent)&&/aistudio\.google\.com/.test($('a.btn').href)&&$('a.btn').target==='_blank','Gemini steps and link');
ok(/API 키는/.test($('.sheet .body').textContent),'explains what an API key is');
click($('[data-act="prov"][data-p="openai"]'));
ok(/platform\.openai\.com/.test($('a.btn').href)&&/ChatGPT 구독/.test($('.sheet').textContent),'OpenAI steps and subscription note');
click($('[data-act="prov"][data-p="anthropic"]'));
ok(/platform\.claude\.com\/settings\/keys/.test($('a.btn').href)&&/Create key/.test($('.steps').textContent)&&/Workspace/.test($('.steps').textContent)&&/claude\.ai/.test($('.steps').textContent),'Claude link and steps');
await connect(NOWS);
ok(!conn()&&/Workspace를 고르지 않고/.test($('#keyMsg').textContent),'Claude key without workspace: explained');
await connect(CORS);
ok(!conn()&&/막혀 있습니다/.test($('#keyMsg').textContent),'Claude org blocks browser calls: explained');
n=reqs.length;ok($('#connChip').textContent==='연결 안 됨','status chip: not connected');
flags.hang='models';type(ANT);submit($('form[data-form="key"]'));await wait(30);
ok($('#keyWait')&&$('#connChip').textContent==='연결 확인 중…'&&$('[data-act="keyCancel"]')&&!$('form[data-form="key"] [type="submit"]'),'connecting: progress shown with cancel');
click($('[data-act="keyCancel"]'));await wait(20);
ok(!conn()&&!$('#keyWait')&&$('form[data-form="key"] [type="submit"]')&&$('#connChip').textContent==='연결 안 됨'&&$('#keyIn').value===ANT,'connect cancelled, key kept in the box');
flags.hang='';type('');n=reqs.length;
await connect('nope');
ok(!conn()&&$('#keyMsg')&&reqs.length===n,'too-short key rejected without a request');
await connect('sk-ant-wrong-0123456789abcdef');
ok(!conn()&&/키가 맞지 않습니다/.test($('#keyMsg').textContent)&&$('#keyIn').value!=='','wrong key: message shown, input kept');
// Claude
await connect('  "'+ANT+'" ');
ok(conn()&&conn().p==='anthropic'&&conn().k===ANT&&conn().m==='claude-opus-5-5'&&!$('form[data-form="key"]')&&!$('#chatIn').disabled,'Claude connected (quotes and spaces stripped)');
ok(!/sk-ant/.test(w.localStorage.getItem('nurse8-state-v1')||''),'key not in synced state');
ok($('[data-act="mic"]'),'mic button from Web Speech API');
ok($('#connChip').textContent==='Claude 연결됨'&&/\bon\b/.test($('#connChip').className),'status chip: connected');
await ask('삼투압이 뭐예요?');
let r=reqs[reqs.length-1];
ok(r.url==='https://api.anthropic.com/v1/messages'&&r.headers['x-api-key']===ANT&&r.headers['anthropic-dangerous-direct-browser-access']==='true'&&r.headers['anthropic-version'],'Claude headers');
ok(r.body.model==='claude-opus-5-5'&&r.body.stream===true&&r.body.fallbacks==='default'&&r.body.output_config.effort==='low'&&!('thinking' in r.body),'Claude body');
ok(r.body.messages[0].role==='user'&&/질문 하나/.test(r.body.messages[0].content)&&/삼투압/.test(r.body.messages[0].content),'tutor prompt + question');
ok(/강사의 답입니다/.test($$('.msg.a').pop().textContent),'Claude streamed answer shown');
ok(w.__app.chats().length===1,'chat saved');
click($('[data-act="mic"]'));await wait(20);
ok(recs.length===1&&recs[0].lang==='ko-KR'&&$('[data-act="mic"]').getAttribute('aria-pressed')==='true','listening');
recs[0].onresult({resultIndex:0,results:[res(true,'혈압 '),res(false,'정상 범위')]});
ok($('#chatIn').value==='혈압 정상 범위','dictation fills input: '+$('#chatIn').value);
recs[0].onresult({resultIndex:1,results:[res(true,'혈압 '),res(true,'정상 범위는?')]});
n=reqs.length;click($('[data-act="mic"]'));await wait(60);
ok(reqs.length===n+1&&/혈압 정상 범위는\?/.test(reqs[n].body.messages.map(m=>m.content).join('\n')),'stop mic sends dictated text');
w.location.hash='quiz';await wait(30);
ok($('#genN')&&$('#genN').value==='5'&&$('#jobBar').hidden,'count selector defaults to 5');
click($('[data-act="gen"]'));await wait(60);
r=reqs[reqs.length-1];ok(r.body.output_config.effort==='medium'&&w.__app.state().custom.length===5&&w.__app.state().custom[0].ai&&$('#jobBar').hidden,'5 generated questions saved, marked AI');
$('#genN').value='20';$('#genN').dispatchEvent(new w.Event('input',{bubbles:true}));
n=reqs.length;click($('[data-act="gen"]'));await wait(120);
ok(w.__app.state().custom.length===25&&reqs.length===n+4&&new Set(w.__app.state().custom.map(q=>q.id)).size===25,'20 questions made in 4 batches, ids unique');
// 뒤에서 돌기: 만드는 동안 다른 화면을 쓰고 강사에게도 물을 수 있다
flags.hang='gen';click($('[data-act="gen"]'));await wait(30);
ok(!$('#jobBar').hidden&&/만드는 중 0\/20/.test($('#jobBar').textContent)&&$('#jobNote')&&!$('[data-act="gen"]')&&$$('[data-act="jobCancel"]').length===2,'job bar and note while generating');
w.location.hash='home';await wait(30);
ok($('h1').textContent==='오늘'&&!$('#jobBar').hidden,'job bar stays on other screens');
w.location.hash='tutor';await wait(30);await ask('만드는 동안 질문');
ok(/강사의 답입니다/.test($$('.msg.a').pop().textContent)&&!$('#jobBar').hidden,'tutor answers while generating');
click($('#jobBar [data-act="jobCancel"]'));await wait(30);
ok($('#jobBar').hidden&&w.__app.state().custom.length===25&&/취소/.test($('#toast').textContent),'job cancelled');
flags.hang='';
// 대화 멈추기
flags.hang='chat';$('#chatIn').value='멈출 질문';submit($('form[data-form="chat"]'));await wait(30);
ok($('[data-act="stop"]')&&!$('form[data-form="chat"] [type="submit"]'),'stop button while answering');
click($('[data-act="stop"]'));await wait(30);
ok(/답을 멈췄습니다/.test($$('.msg.n').pop().textContent)&&!$('[data-act="stop"]')&&$('form[data-form="chat"] [type="submit"]')&&!$('#stream'),'answer stopped before any text');
flags.hang='mid';$('#chatIn').value='중간에 멈출 질문';submit($('form[data-form="chat"]'));await wait(60);
ok($('#stream')&&/강사의 답/.test($('#stream').textContent),'partial answer streaming');
click($('[data-act="stop"]'));await wait(30);
ok(/강사의 답/.test($$('.msg.a').pop().textContent)&&/답을 멈췄습니다/.test($$('.msg.n').pop().textContent),'stopped mid-answer keeps the partial text');
flags.hang='';
flags.mode='nofb';w.location.hash='tutor';await wait(30);
n=reqs.length;await ask('다시');
ok(reqs.length===n+2&&!reqs[n+1].body.fallbacks&&!reqs[n+1].headers['anthropic-beta']&&/강사의 답/.test($$('.msg.a').pop().textContent),'retry without fallbacks');
flags.mode='bad';await ask('또');
ok(/API 키가 맞지 않습니다/.test($$('.msg.n').pop().textContent)&&!conn()&&$('form[data-form="key"]'),'bad key cleared, guide back');
flags.mode='ok';
// Gemini: 고른 회사와 달라도 키 모양으로 맞춘다
click($('[data-act="newChat"]'));
ok($('[data-act="prov"][aria-pressed="true"]').dataset.p==='anthropic','still on Claude tab');
await connect(GEM);
ok(conn()&&conn().p==='gemini'&&conn().m==='gemini-3.10-flash','Gemini connected, newest stable flash picked: '+(conn()&&conn().m));
await ask('활력징후가 뭐예요?');
r=reqs[reqs.length-1];
ok(/\/v1beta\/models\/gemini-3\.10-flash:streamGenerateContent\?alt=sse$/.test(r.url)&&r.headers['x-goog-api-key']===GEM&&!/key=/.test(r.url),'Gemini request');
ok(r.body.contents[0].role==='user'&&/활력징후/.test(r.body.contents[0].parts[0].text)&&/질문 하나/.test(r.body.contents[0].parts[0].text),'Gemini contents');
let a=$$('.msg.a').pop().textContent;ok(/강사의 답입니다/.test(a)&&!/속으로/.test(a),'Gemini answer shown, thoughts skipped');
await ask('하나 더');
r=reqs[reqs.length-1];ok(r.body.contents.map(c=>c.role).join(',')==='user,model,user','Gemini roles alternate');
flags.mode='quota';await ask('또');
ok(/한도를 넘었습니다/.test($$('.msg.n').pop().textContent)&&conn(),'Gemini quota message, key kept');
flags.mode='ok';
w.location.hash='records';await wait(30);
ok(/Google Gemini에 연결/.test(d.body.textContent)&&/gemini-3\.10-flash/.test(d.body.textContent),'records shows connection');
click($('[data-act="forgetKey"]'));ok(!conn()&&!$('[data-act="forgetKey"]'),'disconnect');
// OpenAI
w.location.hash='tutor';await wait(30);
flags.mode='nocredit';await connect(OAI);
ok(conn()&&conn().p==='openai'&&conn().m==='gpt-5.2','OpenAI connected, newest flagship picked: '+(conn()&&conn().m));
click($('[data-act="newChat"]'));await ask('질문');
ok(/충전된 금액이 없습니다/.test($$('.msg.n').pop().textContent)&&conn(),'OpenAI no-credit message, key kept');
flags.mode='ok';await ask('질문');
r=reqs[reqs.length-1];
ok(r.url==='https://api.openai.com/v1/chat/completions'&&r.headers.authorization==='Bearer '+OAI&&r.body.model==='gpt-5.2'&&r.body.stream===true&&r.body.messages[0].role==='user','OpenAI request');
ok(/강사의 답입니다/.test($$('.msg.a').pop().textContent),'OpenAI answer shown');
flags.retired=true;n=reqs.length;await ask('모델이 없어진 뒤');
ok(reqs.length===n+3&&reqs[n+2].body.model==='gpt-5'&&conn().m==='gpt-5'&&/강사의 답/.test($$('.msg.a').pop().textContent),'retired model: re-picked and retried');
ok(flags.errors.length===0,'no script errors '+flags.errors.join('|'));
// 1.2 까지 저장하던 형식(Claude 키 글자만)도 읽는다
const reqs2=[],flags2={mode:'ok',errors:[]};
const w2=makeDom(reqs2,flags2,[],x=>x.localStorage.setItem('nurse8-key-v1',ANT)).window;await wait(50);
w2.location.hash='tutor';await wait(30);
ok(!w2.document.querySelector('form[data-form="key"]')&&!w2.document.querySelector('#chatIn').disabled,'legacy key still works');
w2.document.querySelector('#chatIn').value='안녕';w2.document.querySelector('form[data-form="chat"]').dispatchEvent(new w2.Event('submit',{bubbles:true,cancelable:true}));await wait(60);
ok(reqs2.length===1&&reqs2[0].body.model==='claude-opus-5-5'&&flags2.errors.length===0,'legacy key calls Claude');
// 하루 목표를 마친 날: 완료 표시가 나오고, 더 풀면 새 문제가 한 세트 나온다
const today=(()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');})();
const w3=makeDom([],{mode:'ok',errors:[]},[],x=>x.localStorage.setItem('nurse8-state-v1',JSON.stringify({v:1,goal:10,newDay:{d:today,n:10},days:{[today]:10},prog:{},custom:[],updatedAt:1}))).window;await wait(50);
const d3=w3.document;
ok(w3.__app.state().goal===10&&d3.querySelector('#goalDone')&&!d3.querySelector('.big')&&/한 세트 더/.test(d3.querySelector('[data-act="today"]').textContent),'goal met: done message and one-more-set button');
d3.querySelector('[data-act="today"]').dispatchEvent(new w3.MouseEvent('click',{bubbles:true}));
ok(w3.__app.sess()&&w3.__app.sess().ids.length===10,'extra set after goal has 10 questions');
// 어제의 기록은 오늘 목표에 들어가지 않는다
const w4=makeDom([],{mode:'ok',errors:[]},[],x=>x.localStorage.setItem('nurse8-state-v1',JSON.stringify({v:1,goal:10,newDay:{d:'2020-01-01',n:10},prog:{},custom:[],updatedAt:1}))).window;await wait(50);
ok(w4.document.querySelector('.big').textContent==='10문제','yesterday does not count toward today');
})().catch(e=>{console.log('FAIL [pages] exception',e);process.exitCode=1;});
