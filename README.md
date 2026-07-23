# Jekyll Exporter for Obsidian

Obsidian 노트를 원본으로 유지하면서 Jekyll 포스트를 반복 가능하고 안전하게 발행하는 데스크톱 플러그인입니다.

## 핵심 기능

- 원본 디렉터리 구조를 유지한 `_posts` 자동 생성
- Front Matter 템플릿: `{{title}}`, `{{date}}`, `{{datetime}}`
- 원본과 발행본 사이의 안정적인 `post_id` 동기화
- 기존 `nanoId`와 permalink 보존
- 전체, 본문만, Front Matter만 덮어쓰기
- 위키 링크와 Obsidian/Markdown 이미지 변환
- 코드 펜스와 인라인 코드 내부의 링크·이미지 문법 보존
- 이미지 출력 경로 검증과 디렉터리 자동 생성
- OpenAI 호환 API를 이용한 선택적 자동 태그 생성
- 장치별 활성 대상 폴더와 permalink 설정
- 원자적 파일 저장과 중복 발행 방지

## 요구 사항

- Obsidian `1.11.4` 이상
- 데스크톱 Obsidian
- Jekyll 출력 디렉터리에 대한 쓰기 권한

## BRAT 설치

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat)을 설치하고 활성화합니다.
2. BRAT 설정에서 **Add beta plugin**을 선택합니다.
3. `Fred-Ko/obsidian-jekyll-exporter`를 입력합니다.
4. Jekyll Exporter를 활성화합니다.

BRAT은 최신 GitHub 릴리스에 첨부된 `main.js`, `manifest.json`, `styles.css`를 설치합니다.

## 설정

### 발행 대상

하나 이상의 절대 경로를 등록하고 현재 장치에서 사용할 활성 폴더를 선택합니다. 예를 들어 원본 노트가
`블로그/Graphql/GraphQL Design.md`라면 다음 위치에 발행됩니다.

```text
<활성 대상>/블로그/Graphql/_posts/YYYY-MM-DD-graphql+design.md
```

기존 파일명 규칙과의 호환성을 위해 단어 구분에는 `+`를 사용합니다.

### Front Matter

기본 템플릿은 다음과 같습니다.

```yaml
---
title: { { title } }
date: { { date } }
---
```

원본 노트에 이미 있는 값은 템플릿보다 우선합니다. 해석되지 않은 선택적 플레이스홀더는 결과에서 제거됩니다.

### 자동 태그

API Base URL, 모델, API Secret을 설정한 뒤 자동 태그 생성을 활성화합니다.

API 키는 Obsidian SecretStorage에 저장됩니다. 1.x의 `data.json`에 평문 API 키가 있다면 2.0 최초 실행 시
SecretStorage로 자동 이관하고 설정 파일에서는 제거합니다.

태그 API가 실패해도 본문 발행은 계속하며 기존 태그를 삭제하지 않습니다.

## 발행

- 리본의 업로드 아이콘
- 파일 우클릭 → **Jekyll로 발행**
- 명령 팔레트 → **Jekyll Exporter: 현재 노트를 Jekyll로 발행**

이미 발행된 글이 있으면 변경 범위를 선택할 수 있습니다.

| 선택                | Front Matter            | 발행 본문 |
| ------------------- | ----------------------- | --------- |
| Front Matter와 본문 | 원본 기준, 기존 ID 보존 | 원본 변환 |
| 본문만              | 기존 발행본 유지        | 원본 변환 |
| Front Matter만      | 원본 기준, 기존 ID 보존 | 기존 유지 |
| 취소                | 변경 없음               | 변경 없음 |

## 게시물 ID 불변식

- 새 글은 UUID `post_id`를 한 번만 생성합니다.
- 원본 또는 발행본 한쪽에 ID가 있으면 해당 값을 양쪽에 복원합니다.
- 양쪽 ID가 다르거나 UUID 형식이 잘못되면 잘못된 글을 덮어쓰지 않도록 발행을 중단합니다.
- 발행본의 기존 `nanoId`는 재발행 시 우선 보존됩니다.

## 개발

```bash
npm ci
npm run check
npm run build
```

주요 명령:

| 명령                    | 역할                                 |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | esbuild 감시 빌드                    |
| `npm run test`          | Vitest 단위 테스트                   |
| `npm run test:coverage` | 커버리지 기준을 포함한 전체 테스트   |
| `npm run lint`          | ESLint 정적 검사                     |
| `npm run typecheck`     | 엄격한 TypeScript 검사               |
| `npm run format:check`  | Prettier 포맷 검사                   |
| `npm run check`         | 포맷, 린트, 타입, 테스트 전체 실행   |
| `npm run build`         | 타입 검사 후 프로덕션 `main.js` 생성 |

구조와 설계 원칙은 [아키텍처 문서](docs/ARCHITECTURE.md)를 참고하세요.

## 릴리스

`npm version`으로 버전을 변경하면 manifest와 호환 버전 목록이 자동 동기화됩니다.

```bash
npm version patch
git push origin main --follow-tags
```

태그가 푸시되면 GitHub Actions가 전체 품질 검사를 통과한 산출물만 GitHub Release에 첨부합니다.

## 라이선스

[MIT](LICENSE)
