# Architecture

## 목표

Jekyll Exporter는 다음 불변식을 우선합니다.

1. Obsidian 노트가 콘텐츠의 원본이다.
2. `post_id`와 `nanoId`는 재발행해도 안정적으로 유지된다.
3. 사용자가 선택한 덮어쓰기 범위 밖의 데이터는 변경하지 않는다.
4. 실패한 발행은 완성되지 않은 대상 파일을 남기지 않는다.
5. 핵심 변환 규칙은 Obsidian 런타임 없이 테스트할 수 있어야 한다.

## 의존성 방향

```text
UI ───────────────┐
                  ▼
Obsidian adapter → Application → Core ← Domain
                  ▲
Infrastructure ───┘
```

- `domain`: 설정, Front Matter, 결과와 선택지를 표현하는 타입
- `core`: 파일명, Front Matter, ID, permalink, Markdown 변환과 검증
- `application`: 하나의 포스트 발행 과정을 조정하는 유스케이스
- `infrastructure`: 파일 시스템, Obsidian Vault, 이미지, OpenAI API 어댑터
- `settings`: 장치별 설정과 SecretStorage 마이그레이션
- `ui`: 설정 탭과 덮어쓰기 모달
- `main.ts`: Obsidian 생명주기와 조립만 담당하는 Composition Root

핵심 계층은 UI나 Obsidian 구체 구현을 직접 참조하지 않습니다. Application은 포트 인터페이스를 통해 저장소,
프롬프터, 자산 발행기와 태그 서비스를 사용합니다.

## 발행 순서

1. 설정과 대상 루트를 검증합니다.
2. 원본 노트와 기존 발행본의 Front Matter를 파싱합니다.
3. 사용자가 덮어쓰기 범위를 선택합니다.
4. `post_id`와 `nanoId`를 조정하고 충돌을 검사합니다.
5. 필요한 경우 본문 링크와 이미지를 변환합니다.
6. 자동 태그 실패는 경고로 격리합니다.
7. Front Matter 템플릿과 permalink를 적용합니다.
8. 임시 파일에 쓴 뒤 원자적으로 발행 파일을 교체합니다.
9. 같은 메타데이터를 원본 노트에 반영합니다.
10. 날짜 변경으로 경로가 달라졌다면 이전 발행 파일을 제거합니다.

## 설정 스키마

2.0부터 설정은 `shared`와 `devices`로 분리합니다.

- 공유: 대상 목록, 템플릿, 이미지 경로, API 주소·모델·Secret 이름, 자동 태그 여부
- 장치별: 활성 대상 폴더, permalink 방식

실제 API 키 값은 설정 JSON에 저장하지 않습니다. 기존 평문 키는 로드 시 SecretStorage로 옮긴 후 새 스키마로
저장합니다.

## 테스트 전략

- Core: 입력과 출력이 명확한 순수 단위 테스트
- Application: 메모리 기반 포트 구현을 사용한 발행 시나리오 테스트
- Settings: 레거시 스키마와 SecretStorage 마이그레이션 테스트
- CI: Prettier, ESLint, TypeScript, Vitest, esbuild

외부 API 호출과 실제 Obsidian UI는 얇은 어댑터로 제한합니다.
