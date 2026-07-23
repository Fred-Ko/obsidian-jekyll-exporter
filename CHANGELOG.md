# Changelog

## 2.0.0

- 1,500줄 단일 파일을 Domain, Core, Application, Infrastructure, Settings, UI 계층으로 분리
- 기존 평문 OpenAI API 키를 Obsidian SecretStorage로 자동 마이그레이션
- UUID `post_id`와 `nanoId` 불변식 강화
- 덮어쓰기 모달 재사용과 닫기 동작 수정
- 코드 펜스와 인라인 코드 내부의 Markdown 변환 방지
- 이미지 경로 검증, 대상 디렉터리 생성, Vault 기반 자산 해석 추가
- 정확한 기존 포스트 탐색과 원자적 파일 교체 추가
- API 실패 시 기존 태그를 보존하도록 격리
- 장치별 설정 스키마 도입
- 엄격한 TypeScript, ESLint, Prettier, Vitest, CI 품질 게이트 추가

## 1.0.47

- 원본 노트와 발행본 사이의 안정적인 `post_id` 생성·복원·충돌 검증 추가
