# Obsidian Jekyll Export

Obsidian 노트를 Jekyll 블로그 포스트로 동기화하는 플러그인입니다.

## 기능

- Obsidian 노트를 Jekyll 포스트로 자동 변환
- Obsidian의 폴더 구조를 Jekyll 사이트에 그대로 유지
- Front Matter 자동 생성 및 변환
- 위키링크를 마크다운 링크로 변환
- 이미지 파일 자동 동기화
- 파일 변경 시 자동 동기화 지원

## 설치 방법

1. Obsidian 설정에서 Community Plugins를 열고 "Jekyll Export"를 검색합니다.
2. 플러그인을 설치하고 활성화합니다.
3. 설정에서 필요한 옵션을 구성합니다.

## 설정 옵션

### 기본 설정
- Source Folder: Obsidian 노트를 가져올 폴더 경로
- Target Folder: Jekyll 사이트의 루트 경로
  - 예: Obsidian 경로가 `vault/folder/note.md`인 경우
  - Jekyll 경로는 `jekyll-root/folder/_posts/note.md`로 변환됩니다.

### 동기화 설정
- Auto Sync: 파일 변경 시 자동 동기화 여부
- 제외 패턴: 동기화에서 제외할 폴더나 파일 패턴

### Front Matter 설정
- Front Matter 템플릿: 새 문서에 적용할 기본 Front Matter 템플릿

### 이미지 설정
- 이미지는 Jekyll 사이트의 assets/images 폴더에 통합 저장됩니다.

## 사용 방법

1. 설정에서 Obsidian 소스 폴더와 Jekyll 루트 폴더를 지정합니다.
2. 리본 메뉴의 업로드 아이콘을 클릭하여 수동으로 동기화하거나,
3. 자동 동기화를 활성화하여 파일 변경 시 자동으로 동기화합니다.

## 폴더 구조 예시

```
Obsidian Vault:
/vault
  /programming
    /python
      note1.md
  /blog
    post1.md

Jekyll Site:
/jekyll-site
  /programming
    /python
      /_posts
        YYYY-MM-DD-note1.md
  /blog
    /_posts
      YYYY-MM-DD-post1.md
  /assets
    /images
      image1.png
```

## 주의사항

- 동기화 전에 반드시 중요한 파일을 백업하세요.
- Jekyll 사이트의 구조와 설정에 따라 일부 기능이 다르게 동작할 수 있습니다.
- 대용량 이미지 파일은 동기화 시간이 오래 걸릴 수 있습니다.

## 라이선스

MIT License
