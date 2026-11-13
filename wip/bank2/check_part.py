"""새로 쓰는 문제 묶음 하나를 검사한다.  사용: python3 check_part.py <묶음 파일.json> [id 범위 시작 끝]"""
import collections, json, re, sys
sys.path.insert(0, '/home/user/nurse8/tools')
from check_bank import check
qs = json.load(open(sys.argv[1], encoding='utf8'))
errs = check(qs)
pos = collections.Counter(q.get('ans') for q in qs)
units = collections.Counter(q.get('unit') for q in qs)
lens = sorted(len(q['q']) for q in qs)
neg = sum(1 for q in qs if re.search(r'않은 것|아닌 것|없는 것|틀린 것', q['q'].split('\n')[0]))
hap = sum(1 for q in qs if re.search(r'모두 고르', q['q']))
box = sum(1 for q in qs if '\n\n' in q['q'])
print('%d문제, 정답 위치 %s' % (len(qs), [pos[i] for i in range(4)]))
print('단원: ' + ', '.join('%s %d' % u for u in units.most_common()))
print('문제 글 길이: 가장 짧은 %d, 가운데 %d, 가장 긴 %d' % (lens[0], lens[len(lens) // 2], lens[-1]))
print('자료·지문 상자 %d, 부정 발문 %d, 합답형 %d' % (box, neg, hap))
long_ans = [q['id'] for q in qs if len(q['opts']) == 4 and len(q['opts'][q['ans']]) > 1.5 * max(len(o) for i, o in enumerate(q['opts']) if i != q['ans']) and len(q['opts'][q['ans']]) > 12]
if long_ans:
    print('정답 선지만 유난히 긴 문제: ' + ', '.join(long_ans))
if len(sys.argv) > 3:
    lo, hi = int(sys.argv[2]), int(sys.argv[3])
    out = [q['id'] for q in qs if not (lo <= int(re.sub(r'\D', '', q['id'])) <= hi)]
    old = [q['id'] for q in qs if int(re.sub(r'\D', '', q['id'])) <= 200]
    print('기존 id 를 유지한 문제 %d개' % len(old))
print('\n'.join(errs) if errs else '형식 오류 없음')
sys.exit(1 if errs else 0)
