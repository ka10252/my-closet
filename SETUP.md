# 나만의 옷장 — 셋업 가이드

내 옷을 사진 찍으면 **누끼 따서 스티커처럼** 모아두고, 카테고리별로 관리하는 웹앱.
누끼는 **브라우저 안에서** 처리돼서 사진이 외부로 안 나가고 API 비용도 0원.

## 기술 구성
- **Next.js 16** (App Router) + TypeScript + Tailwind
- **누끼**: `@imgly/background-removal` (브라우저 WASM) + 흰색 다이컷 테두리(canvas)
- **데이터/이미지/로그인**: Supabase (Postgres + Storage + Auth)
- **배포**: Vercel

---

## 1) Supabase 키 넣기
1. https://supabase.com 대시보드 → 본인 프로젝트 → **Project Settings → API**
2. `Project URL` 과 `anon public` 키를 복사
3. 프로젝트 루트의 `.env.local` 에 붙여넣기:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb....
   ```

## 2) DB / Storage 만들기
1. Supabase 대시보드 → **SQL Editor** → New query
2. `supabase/schema.sql` 파일 내용을 통째로 붙여넣고 **Run**
   - `clothes` 테이블, RLS(본인 데이터만 접근), `clothes` Storage 버킷이 한 번에 생성됨

## 3) Google 로그인 켜기
1. **Supabase → Authentication → Sign In / Providers → Google → Enable**
2. Google 로그인용 Client ID / Secret 발급:
   - https://console.cloud.google.com → APIs & Services → Credentials
   - **OAuth client ID** 생성 (Application type: Web)
   - **Authorized redirect URIs** 에 Supabase가 알려주는 콜백 URL 추가
     (`https://<project-ref>.supabase.co/auth/v1/callback`)
   - 발급된 Client ID/Secret 을 Supabase Google 설정에 입력
3. **Authentication → URL Configuration → Redirect URLs** 에 아래 추가:
   - `http://localhost:3000/auth/callback` (개발용)
   - `https://<배포도메인>/auth/callback` (배포 후)

> 로그인이 번거로우면 나중에 "비밀번호 한 개로 막기"로 바꿀 수도 있음. 말해줘.

## 4) 실행
```bash
cd ~/my-closet
npm run dev
```
→ http://localhost:3000 접속 → Google 로그인 → 옷 담기

## 5) 배포 (폰에서 쓰기)
1. GitHub 새 저장소에 push
2. https://vercel.com → Import → 이 저장소 선택
3. **Environment Variables** 에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 입력 → Deploy
4. 배포 URL 을 3-3 단계 Redirect URLs 에 추가
5. 폰 브라우저로 접속 → 공유 → **홈 화면에 추가** (PWA 앱처럼 설치)

---

## 폴더 구조
```
src/
  app/
    page.tsx            홈(로그인 가드 → 옷장)
    login/page.tsx      Google 로그인
    auth/callback/route.ts  로그인 콜백
    manifest.ts         PWA 매니페스트
  components/
    Closet.tsx          카테고리 필터 + 스티커 그리드 + 상세/삭제
    AddSheet.tsx        사진 → 누끼 → 카테고리 → 저장
  lib/
    sticker.ts          ★ 누끼 + 흰 다이컷 테두리 (앱의 심장)
    clothes.ts          옷 CRUD (Supabase)
    categories.ts       카테고리 정의
    supabase/           클라이언트/서버 Supabase
  proxy.ts              세션 갱신 (구 middleware)
supabase/schema.sql     DB/Storage/RLS 스키마
```

## 나중에 추가할 것 (2차)
- 스티커 자유 배치 "보드" 뷰 (Catch! 왼쪽 화면처럼)
- 색/계절/브랜드 태그 + 검색
- 코디 조합, 싱가폴 패킹 체크리스트
- 실제 앱 아이콘(`public/icon-192.png`, `icon-512.png`)
