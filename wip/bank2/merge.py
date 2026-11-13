"""검토가 끝난 묶음들을 합쳐 src/bank/<과목 글자>.json 을 바꾼다.  사용: python3 merge.py <과목 글자> <묶음 파일> ..."""
import collections, json, re, sys
f = sys.argv[1]
qs = []
for p in sys.argv[2:]:
    qs += json.load(open(p, encoding='utf8'))
ids = collections.Counter(q['id'] for q in qs)
dup = [i for i, n in ids.items() if n > 1]
assert not dup, dup
qs.sort(key=lambda q: int(re.sub(r'\D', '', q['id'])))
old = json.load(open('/home/user/nurse8/src/bank/%s.json' % f, encoding='utf8'))
kept = len(set(q['id'] for q in old) & set(ids))
open('/home/user/nurse8/src/bank/%s.json' % f, 'w', encoding='utf8').write('[\n' + ',\n'.join(json.dumps(q, ensure_ascii=False) for q in qs) + '\n]\n')
print('%s: %d문제 (기존 번호 유지 %d, 새 번호 %d, 없어진 기존 문제 %d)' % (f, len(qs), kept, len(qs) - kept, len(old) - kept))
