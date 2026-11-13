// GitHub Pages 모드: window.claude 없이 사용자가 넣은 API 키로 Anthropic API를 직접 부른다.
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+'[pages] '+m);if(!c)process.exitCode=1;};
const KEY='sk-ant-test-0123456789abcdef';
function sse(events){const enc=new TextEncoder();const text=events.map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join('');
  // 일부러 이벤트 중간에서 잘라 조각으로 보낸다.
  const parts=[text.slice(0,37),text.slice(37,120),text.slice(120)].map(s=>enc.encode(s));let i=0;
  return {getReader:()=>({read:async()=>i<parts.length?{done:false,value:parts[i++]}:{done:true}})};}
function chunks(t){const a=[];for(let i=0;i<t.length;i+=4)a.push(t.slice(i,i+4));return a;}
const reply=t=>[{type:'message_start',message:{}},{type:'content_block_start',index:0,content_block:{type:'thinking'}},
  {type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:''}},{type:'content_block_start',index:1,content_block:{type:'text',text:''}},
  ...chunks(t).map(x=>({type:'content_block_delta',index:1,delta:{type:'text_delta',text:x}})),
  {type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}];
(async()=>{
const errors=[],reqs=[];let mode='ok';const recs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.github.io/nurse8/',beforeParse(w){
  w.scrollTo=()=>{};w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;
  w.addEventListener('error',e=>errors.push(e.message));
  w.fetch=async(url,o)=>{const body=JSON.parse(o.body);reqs.push({url,headers:o.headers,body});
    if(mode==='bad')return {ok:false,status:401,json:async()=>({type:'error',error:{type:'authentication_error',message:'invalid x-api-key'}})};
    if(mode==='nofb'&&body.fallbacks)return {ok:false,status:400,json:async()=>({type:'error',error:{type:'invalid_request_error',message:'fallbacks: unsupported beta'}})};
    const last=body.messages[body.messages.length-1].content;
    const t=/JSON 배열만/.test(last)?'[{"unit":"동기부여","q":"새 문제?","opts":["a","b","c","d"],"ans":1,"exp":"해설"}]':'강사의 답입니다.';
    return {ok:true,status:200,body:sse(reply(t))};};
  w.webkitSpeechRecognition=function(){const r=this;recs.push(r);r.start=()=>setTimeout(()=>r.onstart&&r.onstart(),0);r.stop=()=>setTimeout(()=>r.onend&&r.onend(),0);};
}});
const w=dom.window,d=w.document;await wait(50);
const $=s=>d.querySelector(s),$$=s=>[...d.querySelectorAll(s)];
const click=el=>{if(!el)throw new Error('missing element');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
const submit=f=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const res=(f,v)=>Object.assign([{transcript:v}],{isFinal:f});
ok(!w.claude,'no window.claude');
w.location.hash='tutor';await wait(30);
ok($('form[data-form="key"]')&&$('#chatIn').disabled,'key card shown, chat disabled');
$('#keyIn').value='nope';submit($('form[data-form="key"]'));
ok(!w.localStorage.getItem('nurse8-key-v1')&&$('form[data-form="key"]'),'invalid key rejected');
$('#keyIn').value=KEY;submit($('form[data-form="key"]'));
ok(w.localStorage.getItem('nurse8-key-v1')===KEY&&!$('form[data-form="key"]')&&!$('#chatIn').disabled,'key saved, chat enabled');
ok(!/sk-ant/.test(w.localStorage.getItem('nurse8-state-v1')||''),'key not in synced state');
ok($('[data-act="mic"]'),'mic button from Web Speech API');
$('#chatIn').value='삼투압이 뭐예요?';submit($('form[data-form="chat"]'));await wait(50);
let r=reqs[reqs.length-1];
ok(r.url==='https://api.anthropic.com/v1/messages'&&r.headers['x-api-key']===KEY&&r.headers['anthropic-dangerous-direct-browser-access']==='true'&&r.headers['anthropic-version'],'direct API headers');
ok(r.body.model==='claude-opus-5-5'&&r.body.stream===true&&r.body.fallbacks==='default'&&r.body.output_config.effort==='low'&&!('thinking' in r.body),'request body');
ok(r.body.messages[0].role==='user'&&/질문 하나/.test(r.body.messages[0].content)&&/삼투압/.test(r.body.messages[0].content),'tutor prompt + question');
ok(/강사의 답입니다/.test($$('.msg.a').pop().textContent),'streamed answer shown');
ok(w.__app.chats().length===1,'chat saved');
click($('[data-act="mic"]'));await wait(20);
ok(recs.length===1&&recs[0].lang==='ko-KR'&&$('[data-act="mic"]').getAttribute('aria-pressed')==='true','listening');
recs[0].onresult({resultIndex:0,results:[res(true,'혈압 '),res(false,'정상 범위')]});
ok($('#chatIn').value==='혈압 정상 범위','dictation fills input: '+$('#chatIn').value);
recs[0].onresult({resultIndex:1,results:[res(true,'혈압 '),res(true,'정상 범위는?')]});
const n=reqs.length;click($('[data-act="mic"]'));await wait(60);
ok(reqs.length===n+1&&/혈압 정상 범위는\?/.test(reqs[n].body.messages.map(m=>m.content).join('\n')),'stop mic sends dictated text');
w.location.hash='quiz';await wait(30);
ok($('[data-act="gen"]'),'generate available');
click($('[data-act="gen"]'));await wait(60);
r=reqs[reqs.length-1];ok(r.body.output_config.effort==='medium'&&w.__app.state().custom.length===1&&w.__app.state().custom[0].ai,'generated question saved, marked AI');
mode='nofb';w.location.hash='tutor';await wait(30);
const m=reqs.length;$('#chatIn').value='다시';submit($('form[data-form="chat"]'));await wait(60);
ok(reqs.length===m+2&&!reqs[m+1].body.fallbacks&&!reqs[m+1].headers['anthropic-beta']&&/강사의 답/.test($$('.msg.a').pop().textContent),'retry without fallbacks');
mode='bad';$('#chatIn').value='또';submit($('form[data-form="chat"]'));await wait(60);
ok(/API 키가 맞지 않습니다/.test($$('.msg.n').pop().textContent)&&!w.localStorage.getItem('nurse8-key-v1')&&$('form[data-form="key"]'),'bad key cleared, card back');
mode='ok';$('#keyIn').value=KEY;submit($('form[data-form="key"]'));
w.location.hash='records';await wait(30);click($('[data-act="forgetKey"]'));
ok(!w.localStorage.getItem('nurse8-key-v1')&&!$('[data-act="forgetKey"]'),'forget key');
ok(errors.length===0,'no script errors '+errors.join('|'));
})().catch(e=>{console.log('FAIL [pages] exception',e);process.exitCode=1;});
