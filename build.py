"""src/index.src.html 과 src/bank/*.json 을 합쳐 index.html 을 만든다.  사용: python3 build.py"""
import json, pathlib, sys
root = pathlib.Path(__file__).parent
sys.path.insert(0, str(root / 'tools'))
from check_bank import FILES, load, check

src = (root / 'src/index.src.html').read_text(encoding='utf-8')
bank = load(root)
errors = check(bank)
if errors:
    print('\n'.join(errors[:40]))
    sys.exit('문제 은행에 오류가 %d개 있습니다.' % len(errors))
# 문제마다 한 줄. </script> 가 문제 글에 들어 있어도 HTML 이 깨지지 않게 < 를 이스케이프한다.
lines = ',\n'.join(json.dumps(q, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') for q in bank)
assert src.count('/*BANK*/') == 1
(root / 'index.html').write_text(src.replace('/*BANK*/', 'var BANK = [\n' + lines + '\n];'), encoding='utf-8')
print('index.html 생성: 문제 %d개' % len(bank))
