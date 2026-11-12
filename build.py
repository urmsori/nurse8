"""src/index.src.html 과 src/bank.js 를 합쳐 index.html 을 만든다.  사용: python3 build.py"""
import re, pathlib
root = pathlib.Path(__file__).parent
src = (root / 'src/index.src.html').read_text(encoding='utf-8')
bank = (root / 'src/bank.js').read_text(encoding='utf-8')

def conv(line):
    # k01, e01, e03 은 문제의 "밑줄 친 부분"을 따옴표로 적어 두었다. __x__ 로 바꾸면 앱이 밑줄로 그린다.
    if re.match(r"\{id:'(k01|e01|e03)'", line):
        head, sep, tail = line.partition(",exp:")
        return re.sub(r'"([^"]+)"', r'__\1__', head) + sep + tail
    return line

bank = '\n'.join(conv(l) for l in bank.split('\n')).replace('const BANK', 'var BANK')
assert src.count('/*BANK*/') == 1
(root / 'index.html').write_text(src.replace('/*BANK*/', bank), encoding='utf-8')
print('index.html 생성')
