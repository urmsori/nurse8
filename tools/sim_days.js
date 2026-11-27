// 여러 날 학습 흉내. 실제 브라우저에서 날짜를 하루씩 넘기며, 화면이 이끄는 대로(가장 눈에 띄는 주 버튼만) 따라가는 학생을 흉내 낸다.
// 확인하는 것: (1) 푼다 → 틀린 것을 본다 → 틀린 것만 다시 푼다 → 다음 날 복습에 나온다는 흐름이 주 버튼만 눌러도 이어지는가,
// (2) 복습 간격(1·3·7·14일)과 하루 할 양이 의도대로인가, (3) 누르는 것이 다른 것에 가려지거나 겹치지 않는가.
// 사용: node tools/sim_days.js index.html [날 수=30] [하루 목표=20] [캡처 폴더]   (Playwright 필요. npm test 에는 넣지 않았다.)
const {chromium} = require('playwright');
const path = require('path');
const html = require('fs').readFileSync(path.resolve(process.argv[2] || 'index.html'));
let file = '';  // 실제 배포처럼 http 로 연다(file:// 은 저장이 가끔 막힌다)
const DAYS = +process.argv[3] || 30, GOAL = +process.argv[4] || 20, SHOTS = process.argv[5];
const START = new Date('2026-03-02T09:00:00');
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// 학생: 문제마다 아는 정도 m(0~1). 맞힐 확률 = 0.25 + 0.75m. 해설을 보면 오르고, 날이 지나면 조금 잊는다.
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const know = {}, lastSeen = {};
function mastery(id, dayNo) {
  if (!(id in know)) know[id] = 0.25 + 0.5 * rnd();
  else know[id] *= Math.pow(0.985, Math.max(0, dayNo - lastSeen[id]));
  lastSeen[id] = dayNo;
  return know[id];
}

// 화면에서 실행: 누르기 전에 그 자리가 실제로 눌리는지(다른 것에 가려지지 않았는지) 확인하고 누른다.
function tapIn(sel) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : null;
  if (!el) return {err: 'NOEL ' + sel};
  if (el.disabled) return {err: 'DISABLED ' + sel};
  let r = el.getBoundingClientRect(), note = '';
  if (r.top < 0 || r.bottom > innerHeight) { el.scrollIntoView({block: 'center'}); r = el.getBoundingClientRect(); note = 'scrolled'; }
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const covered = !(top === el || el.contains(top));
  const small = Math.min(r.width, r.height) < 43.5;
  el.click();
  return {covered: covered ? (top ? top.tagName + '.' + top.className : 'none') : '', small, note, label: el.textContent.trim().slice(0, 20)};
}
// 화면에서 실행: 지금 보이는 누를 것들이 서로 겹치는지, 스크롤로도 못 누르는 것이 있는지 본다.
function hitCheck() {
  const out = [];
  const vis = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.closest('dialog:not([open]),[hidden]') && el.getClientRects().length; };
  const els = [...document.querySelectorAll('button,a[href],input,select,textarea,summary,label.check')].filter(vis).filter(el => { const d = el.closest('details:not([open])'); return !d || el.matches('summary'); });
  const name = el => (el.getAttribute('data-act') || el.getAttribute('data-tab') || el.id || el.tagName) + ':' + (el.textContent.trim().slice(0, 12) || el.getAttribute('aria-label') || '');
  const y0 = scrollY;
  els.forEach(el => {
    if (el.closest('nav') && document.querySelector('nav.hide')) return;
    el.scrollIntoView({block: 'center'});
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), r.top + r.height / 2);
    if (!el.disabled && !(top === el || el.contains(top) || (top && top.closest('label') && top.closest('label').contains(el)))) out.push('가려짐 ' + name(el) + ' ← ' + (top ? name(top.closest('button,a,nav,div') || top) : '화면 밖'));
    if (Math.min(r.width, r.height) < 43.5 && !el.matches('input[type=checkbox]')) out.push('작음(' + Math.round(r.width) + 'x' + Math.round(r.height) + ') ' + name(el));
  });
  scrollTo(0, y0);
  const rs = els.map(el => [el, el.getBoundingClientRect()]);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [a, x] = rs[i], [b, y] = rs[j];
    if (a.contains(b) || b.contains(a)) continue;
    const fixedA = !!a.closest('nav,.foot,.selbar,.composer,#jobBar'), fixedB = !!b.closest('nav,.foot,.selbar,.composer,#jobBar');
    if (fixedA !== fixedB) continue; // 붙어 다니는 띠와 스크롤되는 내용의 겹침은 위의 '가려짐' 검사가 본다
    const w = Math.min(x.right, y.right) - Math.max(x.left, y.left), h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
    if (w > 1 && h > 1) out.push('겹침 ' + name(a) + ' × ' + name(b));
  }
  return [...new Set(out)];
}

(async () => {
  const server = require('http').createServer((q, r) => { r.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); r.end(html); });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  file = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 360, height: 740}, reducedMotion: 'reduce'});
  const page = await ctx.newPage();
  const errors = [], problems = {}, trace = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.clock.install({time: START});
  await page.addInitScript(goal => {
    try { if (!localStorage.getItem('nurse8-state-v1')) localStorage.setItem('nurse8-state-v1', JSON.stringify({goal})); } catch (e) {}
  }, GOAL);
  const note = (where, list) => list.forEach(x => { const k = where + ' :: ' + x; problems[k] = (problems[k] || 0) + 1; });
  const tap = async (sel, where) => {
    const r = await page.evaluate(tapIn, sel);
    if (r.err) throw new Error(where + ' ' + r.err);
    if (r.covered) note(where, ['주 버튼이 가려짐 ' + sel + ' ← ' + r.covered]);
    if (r.small) note(where, ['작은 버튼 ' + sel]);
    return r;
  };
  const checked = {};
  const check = async where => { if ((checked[where] = (checked[where] || 0) + 1) > 2) return; note(where, await page.evaluate(hitCheck)); if (SHOTS && checked[where] === 1) await page.screenshot({path: SHOTS + '/' + where + '.png', fullPage: false}); };
  const st = () => page.evaluate(() => { const S = window.__app.state(), s = window.__app.sess(); const q = s && !s.done ? BANK.concat(PAST).find(x => x.id === s.ids[s.idx]) : null;
    return {view: location.hash.slice(1) || 'home', sess: s ? {title: s.title, n: s.ids.length, idx: s.idx, graded: s.graded, done: s.done, peek: !!s.peek, right: s.right, ok: s.ok} : null, q: q ? {id: q.id, ans: q.ans} : null,
      big: (document.querySelector('.big') || {}).textContent || '', goalDone: !!document.querySelector('#goalDone'), h1: (document.querySelector('h1') || {}).textContent || '',
      primary: (document.querySelector('.foot .btn:not(.quiet)') || document.querySelector('#app .btn:not(.quiet):not(:disabled)') || {}).textContent || '', primaries: document.querySelectorAll('#app .btn:not(.quiet):not(:disabled)').length, newDay: S.newDay, due: document.querySelector('#navDue').hidden ? 0 : +document.querySelector('#navDue').textContent}; });
  const prog = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.state().prog)));

  const rows = []; let prevWrong = [], expectDue = {};
  for (let d = 0; d < DAYS; d++) {
    const today = addDays(START, d), t = iso(today), tomorrow = iso(addDays(today, 1));
    await page.clock.setSystemTime(today);
    await page.goto('about:blank'); await page.goto(file + '#home'); await page.waitForTimeout(60);
    let s = await st();
    const startBig = parseInt(s.big) || 0, startDue = s.due;
    // 어제 틀린 문제가 오늘 복습에 들어왔는가
    if (await page.evaluate(() => !!document.querySelector('#noStore'))) note('day' + d, ['저장이 막힘']);
    const p0 = await prog();
    const notDue = prevWrong.filter(id => !(p0[id] && p0[id].due <= t && p0[id].stage === 0));
    if (notDue.length) note('day' + d, ['어제 틀린 문제가 오늘 복습에 없음: ' + notDue.slice(0, 5).join(',')]);
    await check('홈');
    let solved = 0, wrongToday = new Set(), sets = 0, resolveRounds = 0, guard = 0, steps = [];
    while (guard++ < (+process.env.GUARD || 4000)) {
      s = await st();
      if (s.view !== 'quiz') {
        if (s.view !== 'home') { await page.goto(file + '#home'); await page.waitForTimeout(30); continue; }
        if (!s.big) { if (s.primaries) note('홈', ['오늘 할 양을 마쳤는데 주 버튼이 남아 있음: ' + s.primary]); break; } // 홈에 남은 문제가 없으면 오늘 끝
        if (s.primaries !== 1) note('홈', ['주 버튼이 ' + s.primaries + '개']);
        steps.push('홈[' + s.big + '] → ' + s.primary);
        await tap('[data-act="today"]', '홈'); sets++; continue;
      }
      if (s.sess && s.sess.done) {
        await check(s.h1 === '모두 맞혔습니다' ? '결과(모두 맞힘)' : '결과(틀린 문제 있음)');
        steps.push('결과[' + s.sess.title + ' ' + s.sess.right + '/' + s.sess.n + '] → ' + s.primary);
        const wrongIds = await page.evaluate(() => window.__app.sess().log.filter(x => !x.ok).map(x => x.id));
        const redo = /다시 풀기/.test(s.primary);
        if (wrongIds.length && !redo) note('결과', ['틀린 문제가 있는데 주 버튼이 다시 풀기가 아님: ' + s.primary]);
        if (!wrongIds.length && redo) note('결과', ['틀린 문제가 없는데 다시 풀기를 권함']);
        if (redo && d < 2 && !checked['틀린 문제 보기']) { await tap('[data-act="peekw"]', '결과'); await check('틀린 문제 보기'); await tap('.foot [data-act="quit"]', '틀린 문제 보기'); }
        const r = await tap('.foot .btn:not(.quiet)', '결과');
        if (redo) { resolveRounds++; const ids = await page.evaluate(() => window.__app.sess().ids);
          if (ids.slice().sort().join() !== wrongIds.slice().sort().join()) note('결과', ['다시 풀기에 틀린 문제만 나오지 않음']); }
        else if (/다음|더 풀기/.test(r.label)) sets++;
        continue;
      }
      if (s.sess && !s.sess.graded) {
        if (s.sess.idx === 0) await check('문제');
        const m = mastery(s.q.id, d), ok = rnd() < 0.25 + 0.75 * m;
        const pick = ok ? s.q.ans : (s.q.ans + 1 + Math.floor(rnd() * 3)) % 4;
        await page.evaluate(i => document.querySelectorAll('[data-act="pick"]')[i].click(), pick);
        await tap('[data-act="grade"]', '문제'); solved++;
        if (ok) { know[s.q.id] += 0.15 * (1 - know[s.q.id]);
          if (m < 0.4) { await tap('[data-act="conf"][data-c="guess"]', '채점(맞음)'); wrongToday.add(s.q.id); }
          else if (m < 0.55) await tap('[data-act="conf"][data-c="unsure"]', '채점(맞음)'); }
        else { know[s.q.id] += 0.35 * (1 - know[s.q.id]); wrongToday.add(s.q.id); }
        if (solved < 30) await check(ok ? '채점(맞음)' : '채점(틀림)');
        continue;
      }
      await tap('.foot [data-act="next"]', '채점');
    }
    if (guard >= (+process.env.GUARD || 4000)) note('day' + d, ['끝나지 않음']);
    s = await st();
    const p1 = await prog();
    // 오늘 틀리거나 찍은 문제는 내일 복습이어야 한다
    const bad = [...wrongToday].filter(id => !(p1[id] && p1[id].due === tomorrow && p1[id].stage === 0));
    if (bad.length) note('day' + d, ['틀리거나 찍은 문제가 내일 복습으로 잡히지 않음: ' + bad.slice(0, 5).join(',')]);
    const leftDue = Object.keys(p1).filter(id => p1[id].stage >= 0 && p1[id].stage < 4 && p1[id].due <= t).length;
    if (leftDue) note('day' + d, ['주 버튼만 따라갔는데 오늘 복습이 ' + leftDue + '개 남음']);
    if (!s.goalDone && s.big) note('day' + d, ['끝났는데 홈에 완료 표시가 없음']);
    const newN = s.newDay && s.newDay.d === t ? s.newDay.n : 0;
    rows.push({d: d + 1, 시작: startBig, 복습: startDue, 새문제: newN, 푼횟수: solved, 세트: sets, 다시풀기: resolveRounds, 틀림: wrongToday.size, 분: Math.round(solved * 66 / 60)});
    if (d < 3 || d === 7) trace.push('── ' + (d + 1) + '일째 ──\n' + steps.join('\n'));
    prevWrong = [...wrongToday];
    // 다른 화면도 가끔 눌러 본다
    if (d === 1 || d === 8) for (const v of ['quiz', 'records']) { await page.goto(file + '#' + v); await page.waitForTimeout(40); await check({quiz: '문제풀이', records: '기록'}[v]); }
  }
  const p = await prog();
  const stages = [0, 0, 0, 0, 0]; Object.values(p).forEach(x => { if (x.stage >= 0) stages[x.stage]++; });
  console.log(trace.join('\n'));
  console.log('\n날  시작 복습 새문제 푼횟수 세트 다시풀기 틀림 걸린분');
  rows.forEach(r => console.log(String(r.d).padStart(2) + '  ' + [r.시작, r.복습, r.새문제, r.푼횟수, r.세트, r.다시풀기, r.틀림, r.분].map(x => String(x).padStart(5)).join(' ')));
  const avg = k => Math.round(rows.reduce((a, r) => a + r[k], 0) / rows.length);
  console.log('평균: 하루 ' + avg('푼횟수') + '번 풀이, 약 ' + avg('분') + '분. 푼 문제 ' + Object.keys(p).length + '개, 복습 단계 [1일,3일,7일,14일,완료] = ' + stages.join(', '));
  const keys = Object.keys(problems);
  console.log(keys.length ? '\n문제 ' + keys.length + '가지\n' + keys.map(k => k + '  (' + problems[k] + '번)').join('\n') : '\n흐름과 누르기 문제 없음');
  if (errors.length) console.log('스크립트 오류', errors.slice(0, 5));
  await browser.close(); server.close();
  process.exitCode = keys.length || errors.length ? 1 : 0;
})();
