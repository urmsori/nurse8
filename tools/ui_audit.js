// 화면 점검(사용자가 정한 UI 규칙): 폭 320·360·390 에서 화면을 차례로 열어
// 늘 같은 글이 두 줄로 넘어가거나(WRAP) 잘리거나(TRUNC) 화면 밖으로 나가는 곳(OVER), 서로 겹치는 곳(OVERLAP),
// 버튼 묶음이 다음 줄로 흘러내리는 곳(ROWS), 가운뎃점으로 이어 붙인 글(DOT)을 찾는다.
// 문제 글, 단원 이름, 강사의 답, API 키 안내처럼 내용에 따라 달라지는 글(DYN)은 보지 않는다.
// 사용: node tools/ui_audit.js index.html [캡처를 남길 폴더]   (Playwright 가 있어야 한다. npm test 에는 들어 있지 않다.)
const {chromium} = require('playwright');
const DYN = '.stem,.passage,.opt .t,.msg,.item span,.item small,.exam p.body,.exam .sh .unit,.steps,.ctxq summary .t,#toast,.chip-w,#keyMsg,.foot mark,.st,#keyCard p';
function probe(dyn) {
  const out = [];
  const vis = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.closest('dialog:not([open]),.sr,[hidden]') && el.getClientRects().length; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.trim(), el = n.parentElement;
    if (!t || !el || el.closest('script,style') || !vis(el)) continue;
    if (el.closest(dyn)) continue;
    if (/·/.test(t)) out.push('DOT ' + t.slice(0, 40));
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter(x => x.width > 0);
    if (!rects.length) continue;
    const tops = [...new Set(rects.map(x => Math.round(x.top)))].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 6);
    const cs = getComputedStyle(el);
    const trunc = el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX);
    const over = rects.some(x => x.right > innerWidth + 1 || x.left < -1);
    if (tops.length > 1 || trunc || over) out.push((tops.length > 1 ? 'WRAP ' : '') + (trunc ? 'TRUNC ' : '') + (over ? 'OVER ' : '') + el.tagName.toLowerCase() + '.' + String(el.className).replace(/ /g, '.') + ': ' + t.slice(0, 40));
  }
  document.querySelectorAll('.chips,.sh,.head,.legend,.row,.rows > div,.rows > button,.foot,.selbar > div').forEach(c => {
    if (!vis(c) || c.closest(dyn) || c.querySelector('.chip-w')) return;
    const kids = [...c.children].filter(vis);
    const tops = [...new Set(kids.map(x => Math.round(x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2)))].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 12);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const x = kids[i].getBoundingClientRect(), y = kids[j].getBoundingClientRect(); if (Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2) out.push('OVERLAP ' + kids[i].textContent.trim().slice(0, 16) + ' / ' + kids[j].textContent.trim().slice(0, 16)); }
    if (tops.length > 1 && getComputedStyle(c).display === 'flex' && getComputedStyle(c).flexWrap === 'wrap') out.push('ROWS(' + tops.length + ') ' + String(c.className) + ': ' + kids.map(k => k.textContent.trim().slice(0, 12)).join(' | '));
    kids.forEach(k => { const b = k.getBoundingClientRect(); if (b.right > innerWidth + 1) out.push('OVER child ' + k.textContent.trim().slice(0, 20)); });
  });
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('HSCROLL page ' + document.documentElement.scrollWidth);
  return [...new Set(out)];
}
(async () => {
  const file = 'file://' + require('path').resolve(process.argv[2]), shots = process.argv[3];
  const b = await chromium.launch();
  const all = {};
  for (const width of [320, 360, 390]) for (const withKey of [true, false]) {
    const ctx = await b.newContext({viewport: {width, height: 800}});
    const p = await ctx.newPage();
    await p.addInitScript(withKey => {
      window.fetch = () => new Promise(() => {});
      if (localStorage.getItem('seeded')) return;
      localStorage.setItem('seeded', '1');
      const ids = [];
      for (let i = 2; i <= 30; i++) ids.push('m' + String(i).padStart(2, '0'));
      for (let i = 1; i <= 17; i++) ids.push('h' + String(i).padStart(2, '0'));
      const now = Date.now(), log = [], prog = {};
      const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
      ids.forEach((id, i) => {
        const day = i < 29 ? 1 : 0, ok = (i * 7) % 5 === 0 || i % 4 === 1 ? 0 : 1;
        log.push([now - day * 864e5 - (50 - i) * 60000, id, 1, ok, i % 6 === 2 ? 'g' : 's']);
        prog[id] = ok ? {seen: 1, wrong: 0, stage: -1, due: null, last: 'correct'} : {seen: 1, wrong: 1, stage: 0, due: d(i % 3 ? 0 : 2), last: 'wrong'};
      });
      localStorage.setItem('nurse8-log-v1', JSON.stringify(log));
      const days = {}; days[d(-1)] = 29; days[d(0)] = 17;
      localStorage.setItem('nurse8-state-v1', JSON.stringify({prog, days, examDate: d(20), goal: 20, newDay: {d: d(0), n: 17}, subjects: ['간호관리', '지역사회간호', '국어', '한국사']}));
      localStorage.setItem('nurse8-chats-v1', JSON.stringify([{id: 'c1', title: '활력징후가 뭐예요?', ctxId: 'm02', updatedAt: now, msgs: [{role: 'user', content: '활력징후가 뭐예요?'}, {role: 'assistant', content: '먼저 무엇을 재는 것인지부터 볼까요?'}]}]));
      if (withKey) localStorage.setItem('nurse8-key-v1', JSON.stringify({p: 'gemini', k: 'AIzaTest0123456789abcdefghij', m: 'gemini-3-flash'}));
    }, withKey);
    const tag = width + (withKey ? ' AI' : ' noAI');
    let k = 0;
    const check = async name => {
      await p.waitForTimeout(120);
      const r = await p.evaluate(probe, DYN);
      if (shots) await p.screenshot({path: shots + '/' + width + (withKey ? 'a' : 'n') + '-' + String(++k).padStart(2, '0') + name + '.png', fullPage: true});
      r.forEach(x => { const key = name + ' :: ' + x; (all[key] = all[key] || []).push(tag); });
    };
    const nav = async h => { await p.goto('about:blank'); await p.goto(file + '#' + h); await p.waitForTimeout(200); };
    const ansOf = () => p.evaluate(() => { const s = window.__app.sess(); return BANK.concat(PAST).find(x => x.id === s.ids[s.idx]).ans; });
    await nav('home'); await check('home');
    await p.click('[data-act="exam"]'); await check('settings'); await p.click('[data-act="dlgClose"]');
    await p.click('[data-act="today"]'); await check('quiz');
    await p.click('[data-act="askq"]'); await check('tutor-ctx'); await p.click('#nav a[data-tab="quiz"]'); await p.waitForTimeout(150);
    let a = await ansOf();
    await (await p.$$('[data-act="pick"]'))[(a + 1) % 4].click(); await p.click('[data-act="grade"]'); await check('wrong');
    await p.click('[data-act="quit"]'); await check('quitDlg'); await p.click('[data-act="quitNo"]');
    await p.click('[data-act="next"]'); a = await ansOf();
    await (await p.$$('[data-act="pick"]'))[a].click(); await p.click('[data-act="grade"]'); await check('right');
    await (await p.$$('[data-act="conf"]'))[1].click(); await check('guess');
    for (let i = 0; i < 20 && !(await p.$('.score')); i++) {
      await p.click('[data-act="next"]');
      if (await p.$('.score')) break;
      await (await p.$$('[data-act="pick"]'))[0].click(); await p.click('[data-act="grade"]');
    }
    await check('done');
    if (await p.$('[data-act="peekw"]')) { await p.click('[data-act="peekw"]'); await check('peekw'); await p.click('.foot [data-act="quit"]'); }
    await p.click('[data-act="tab"][data-v="home"]'); await check('home2');
    await nav('quiz'); await p.click('#pastBox summary'); await p.click('#addBox summary'); await check('picker');
    await nav('review'); await check('review');
    await nav('records'); await check('records');
    await p.click('[data-act="selMode"]'); await check('sel0');
    let cells = await p.$$('[data-act="selCell"]:not([disabled])'); await cells[2].click(); cells = await p.$$('[data-act="selCell"]:not([disabled])'); await cells[9].click(); await check('sel1');
    await p.click('#selBar [data-act="selMode"]'); await p.click('[data-act="recList"]'); await check('reclist');
    await (await p.$$('[data-act="peek"]:not([disabled])'))[0].click(); await check('peek');
    await nav('tutor'); await check('tutor');
    await ctx.close();
  }
  Object.keys(all).sort().forEach(k => console.log(k + '   [' + all[k].join(', ') + ']'));
  console.log(Object.keys(all).length ? '고칠 곳 ' + Object.keys(all).length + '개' : '문제 없음');
  await b.close();
  process.exitCode = Object.keys(all).length ? 1 : 0;
})();
