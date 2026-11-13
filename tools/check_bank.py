"""문제 은행(src/bank/*.json) 형식 검사.  사용: python3 tools/check_bank.py [파일...]

파일을 주면 그 파일만, 안 주면 전체를 검사한다. 내용이 맞는지는 보지 않고 형식만 본다.
"""
import collections, json, pathlib, re, sys

# 파일 이름(문제 id 의 첫 글자) → 과목
FILES = {'m': '간호관리', 'c': '지역사회간호', 'k': '국어', 'e': '영어', 'h': '한국사'}
KEYS = {'id', 'subj', 'unit', 'q', 'opts', 'ans', 'exp'}


def load(root, only=None):
    out = []
    for f in FILES:
        p = pathlib.Path(root) / 'src/bank' / (f + '.json')
        if only and p.resolve() not in only:
            continue
        out += json.loads(p.read_text(encoding='utf-8'))
    return out


def check(bank):
    errs, seen, stems = [], set(), {}
    for i, q in enumerate(bank):
        qid = q.get('id', '?%d' % i) if isinstance(q, dict) else '?%d' % i
        def bad(msg):
            errs.append('%s: %s' % (qid, msg))
        if not isinstance(q, dict):
            bad('객체가 아니다'); continue
        if set(q) != KEYS:
            bad('키가 다르다: %s' % sorted(set(q) ^ KEYS))
            continue
        m = re.fullmatch(r'([mckeh])(\d{2,3})', str(q['id']))
        if not m:
            bad('id 형식은 글자 하나와 숫자 2~3자리')
        elif FILES[m.group(1)] != q['subj']:
            bad('id 의 첫 글자와 과목이 맞지 않는다')
        if q['id'] in seen:
            bad('id 가 겹친다')
        seen.add(q['id'])
        for k in ('unit', 'q', 'exp'):
            if not isinstance(q[k], str) or not q[k].strip():
                bad('%s 가 비었다' % k)
        if not (isinstance(q['opts'], list) and len(q['opts']) == 4 and all(isinstance(o, str) and o.strip() for o in q['opts'])):
            bad('선지는 글자 4개'); continue
        if len(set(o.strip() for o in q['opts'])) != 4:
            bad('같은 선지가 있다')
        if q['ans'] not in (0, 1, 2, 3) or isinstance(q['ans'], bool):
            bad('ans 는 0~3')
        if len(q['unit']) > 12:
            bad('단원 이름이 길다(12자 이내)')
        if len(q['exp']) < 40:
            bad('해설이 너무 짧다')
        if len(q['q']) > 1200 or any(len(o) > 300 for o in q['opts']) or len(q['exp']) > 1500:
            bad('너무 길다')
        text = q['q'] + ''.join(q['opts'])
        if text.count('__') % 2 and not re.search(r'_{4,}', text):
            bad('밑줄 표시 __ 의 짝이 맞지 않는다')
        if re.search(r'[①②③④]', ''.join(q['opts'])):
            bad('선지에 ①②③④ 번호를 넣지 않는다(앱이 붙인다)')
        key = re.sub(r'\s+', '', q['q'])
        if len(key) > 25 and key in stems:
            bad('%s 와 문제 글이 같다' % stems[key])
        stems.setdefault(key, q['id'])
    return errs


# ── 기출 모음(src/past/<연도>-<과목 글자>.json) ──
PAST_KEYS = KEYS | {'no'}


def load_past(root):
    """[(파일 이름, 문제 목록)] 을 최근 연도부터 돌려준다."""
    out = []
    for p in sorted((pathlib.Path(root) / 'src/past').glob('*.json'), reverse=True):
        out.append((p.stem, json.loads(p.read_text(encoding='utf-8'))))
    return out


def check_past(papers):
    errs = []
    for name, qs in papers:
        m = re.fullmatch(r'(20\d\d)-([mckeh])', name)
        if not m:
            errs.append('%s: 파일 이름은 <연도>-<과목 글자>' % name); continue
        yy, f = m.group(1)[2:], m.group(2)
        if len(qs) != 20:
            errs.append('%s: 20문항이 아니다(%d)' % (name, len(qs)))
        for i, q in enumerate(qs):
            qid = q.get('id', '?') if isinstance(q, dict) else '?'
            def bad(msg):
                errs.append('%s %s: %s' % (name, qid, msg))
            if not isinstance(q, dict) or set(q) != PAST_KEYS:
                bad('키가 다르다'); continue
            if q['id'] != 'p%s%s%02d' % (yy, f, i + 1) or q['no'] != i + 1:
                bad('id 는 p<연도 두 자리><과목 글자><번호 두 자리>, no 는 문항 번호여야 한다')
            if q['subj'] != FILES[f]:
                bad('과목이 파일과 다르다')
            for k in ('unit', 'q', 'exp'):
                if not isinstance(q[k], str) or not q[k].strip():
                    bad('%s 가 비었다' % k)
            if not (isinstance(q['opts'], list) and len(q['opts']) == 4 and all(isinstance(o, str) and o.strip() for o in q['opts'])):
                bad('선지는 글자 4개'); continue
            if q['ans'] not in (0, 1, 2, 3) or isinstance(q['ans'], bool):
                bad('ans 는 0~3')
            if len(q['unit']) > 12:
                bad('단원 이름이 길다(12자 이내)')
            if len(q['exp']) < 40:
                bad('해설이 너무 짧다')
            if len(q['q']) > 6000 or any(len(o) > 800 for o in q['opts']) or len(q['exp']) > 2000:
                bad('너무 길다')
            if re.search(r'[①②③④]', ''.join(q['opts'])):
                bad('선지에 ①②③④ 번호를 넣지 않는다(앱이 붙인다)')
    return errs


def report(bank):
    by = collections.defaultdict(list)
    for q in bank:
        by[q['subj']].append(q)
    for subj, qs in by.items():
        pos = collections.Counter(q['ans'] for q in qs)
        units = collections.Counter(q['unit'] for q in qs)
        print('%s: %d문제, 정답 위치 %s' % (subj, len(qs), [pos[i] for i in range(4)]))
        print('  단원 %d개: %s' % (len(units), ', '.join('%s %d' % u for u in units.most_common())))


if __name__ == '__main__':
    root = pathlib.Path(__file__).resolve().parent.parent
    only = {pathlib.Path(a).resolve() for a in sys.argv[1:]} or None
    bank = load(root, only)
    errs = check(bank)
    report(bank)
    papers = load_past(root)
    if papers and not only:
        errs += check_past(papers)
        print('기출: %d회분 %d문항 (%s)' % (len(papers), sum(len(q) for _, q in papers), ', '.join(n for n, _ in papers)))
    print('\n'.join(errs) if errs else '형식 오류 없음')
    sys.exit(1 if errs else 0)
