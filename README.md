# nurse8

8급 간호직 공무원 필기시험 학습 웹앱. 문제를 풀고, 틀린 문제를 간격을 두고 다시 풀게 한다.

- 과목: 간호관리, 지역사회간호, 국어, 영어, 한국사
- 기본 문제 36개와 정답, 해설은 AI 없이 동작한다
- AI 강사(소크라테스식 문답), 문제 생성, 음성은 현재 Claude 아티팩트 안에서만 동작한다

## 실행

`index.html` 하나로 동작한다. GitHub Pages는 저장소 루트를 그대로 서비스하면 된다.

## 개발

```
python3 build.py     # src/ 를 합쳐 index.html 생성
npm install          # 테스트용 jsdom
npm test             # 빌드 후 클릭 테스트
```

작업 맥락과 규칙은 `CLAUDE.md` 에 있다.
