# English Words

아이들용 영어 단어장. Cloudflare Pages(정적 화면) + Pages Functions(API) + Hyperdrive → 기존 MySQL.

```
public/            화면 (index.html, style.css, app.js, mascot.png)
functions/         API  (/api/words, /api/results, /api/login, /api/session) + 보안 헤더
lib/               DB 연결, 인증/검증 공용 코드
schema.sql         추가 테이블(login_attempts) 생성 스크립트
```

## 설치 순서

1. **DB 준비** — 기존 테이블 `vocab_words`, `users`, `quiz_history` 를 그대로 씁니다.
   `schema.sql` 을 실행해 `login_attempts` 테이블만 추가하세요. 앱 전용 계정 권장 (schema.sql 예시).
   Cloudflare 에서 접속할 수 있어야 하므로 TLS 를 켠 공개 포트이거나 Cloudflare Tunnel 이 필요합니다.
2. **Hyperdrive 생성**
   ```
   npm install
   npx wrangler hyperdrive create english-words-db --connection-string="mysql://words_app:비밀번호@DB주소:3306/DB이름"
   ```
   출력된 id 를 `wrangler.toml` 의 `id` 에 넣습니다.
3. **비밀 값 등록** (코드나 git 에 넣지 않습니다)
   ```
   npx wrangler pages secret put ADMIN_PASSWORD
   npx wrangler pages secret put SESSION_SECRET     # 32자 이상 무작위 문자열
   ```
4. **마스코트** — 기존 사이트의 `mascot.png` 를 `public/` 에 복사 (없어도 동작합니다).
5. **배포** — `npm run deploy`

로컬 실행: `.dev.vars.example` 을 `.dev.vars` 로 복사해 값을 채우고, `wrangler.toml` 의 hyperdrive 항목에
`localConnectionString = "mysql://..."` 을 추가한 뒤 `npm run dev`.

## 단어 넣기

화면 아래 "관리자" → 날짜(월·수·금) 선택 → `apple = 사과` 또는 `apple = 사과 | I eat an apple. | 나는 사과를 먹어요.`
형식으로 여러 줄 붙여넣기. 지금처럼 DB 에 직접 INSERT 해도 됩니다.

게임 기록은 `users`(이름) + `quiz_history`(quiz_type: meaning/match/spelling/monthly, score: 100점 만점)에 저장됩니다.
