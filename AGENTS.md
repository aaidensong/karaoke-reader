# Karaoke Reader

대본을 넣으면 노래방 자막처럼 현재 문장이 화면 중앙에 고정되고, 단어가 WPM에 맞춰 왼쪽부터 채워지는 영어 읽기·말하기 연습 도구.
GitHub Pages 정적 사이트로 공개한다. 링크만 받으면 설치나 가입 없이 바로 쓸 수 있어야 한다.
사용자는 라이브러리에서 실생활 상황별 대본을 골라 연습하거나, 자기 대본을 넣어 연습한다. 라이브러리 대본은 수백 개 규모로 늘어난다.
서버, 로그인, 쿠키 없음. 방문·이벤트 집계에는 GoatCounter만 사용한다. 대본과 설정은 사용자 브라우저(localStorage)에만 저장한다.

작업은 두 종류로 나뉜다. 작업 요청에 어느 쪽인지 명시된다.
- 프로그램 작업: 이 파일의 규칙을 따른다. library/ 안의 대본은 형식 검사용 테스트 대본 외에는 만들지 않는다.
- 대본 작업: 이 파일의 "대본 파일 형식"과 library/AGENTS.md를 따른다. 앱 코드와 tools/는 수정하지 않는다.

## 출발점 파일 (저장소 루트에 있음)

- karaoke-reader.html: 현재 동작하는 단일 파일 버전.
  구현된 기능: 단어 단위 채움(단어 길이와 쉼표 뒤 지연 반영), 문장 분할(마크다운 # 제목은 분할하지 않음),
  WPM·글자 크기·문장 간격 조절, 파일 불러오기(.txt .md .srt .vtt .docx, 드래그 앤 드롭),
  발음기호 토글(음절 구분 점, 주강세 음절 색 강조), 단축키 11개(e.code 기준이라 한글 자판에서도 동작), 라이트/다크 테마.
  임베드 환경용이라 doctype, html, head, charset·viewport meta, [hidden]{display:none} 기본 규칙이 빠져 있다.
- build-ipa.mjs: npm 패키지 cmu-pronouncing-dictionary를 미국식 IPA로 변환한다.
  출력: 음절은 "." 구분, 주강세 ˈ, 부강세 ˌ 를 음절 앞에 붙임. 예) regression → rə.ˈɡrɛ.ʃən

## 목표 저장소 구조

```
index.html
assets/app.css, assets/app.js
assets/i18n.ko.js              UI 문구를 한 파일에 모음(영어 추가 대비)
sw.js                          서비스 워커(앱 파일, 발음 사전 캐시)
manifest.webmanifest
data/ipa-en-us.json            발음 사전(빌드 산출물)
library/<category>/<id>.md     대본 파일
library/index.json             대본 목록(빌드 산출물)
library/AGENTS.md              대본 작성 규칙
tools/build-ipa.mjs
tools/build-library.mjs        index.json 생성
tools/lint-library.mjs         대본 형식 검사
tools/banned-words.txt         금지어 목록
.github/workflows/library.yml  push와 PR마다 lint:library, build:library 실행
package.json                   build:ipa, build:library, lint:library 스크립트
LICENSE, NOTICE.md, README.md, SCRIPT_FORMAT.md(아래 대본 파일 형식을 사람용으로 정리)
```

## 대본 파일 형식 (프로그램과 대본 작업이 공유하는 계약. 변경은 사람의 승인 후에만)

경로: `library/<category>/<id>.md`

```
---
id: health-book-appointment       영문 소문자·숫자·하이픈, 전체에서 유일
title: 병원 진료 예약 전화           한국어
category: 03-health               아래 14개 중 하나, 폴더명과 일치
situation: 병원 예약 전화
type: dialogue                    dialogue | monologue | qa
level: A2                         A2 | B1 | B2 | C1
wpm: 120                          60~250
minutes: 2                        1~10
region: general                   general | CA | US
---
※ 대화 속 이름, 날짜, 금액은 가상입니다.
```

본문 규칙
- qa: `## 질문` 줄 다음에 답변 문단
- dialogue: 상대 대사는 `> ` 로 시작, 사용자가 연습할 대사는 일반 문단
- monologue: 일반 문단만
- 문단 하나는 한 줄. 빈 줄로 문단 구분
- 메타데이터 다음, 본문 앞의 `※` 로 시작하는 줄은 안내문. 화면에 작게 표시하고 재생 대상에서 뺀다

category 목록: 01-daily 02-housing 03-health 04-money-admin 05-transport 06-travel 07-work 08-job-search 09-social 10-family 11-service-call 12-emergency 13-speaking 14-reading

## 발음 사전 다운로드

- 처음부터 받지 않는다. 사용자가 발음기호를 처음 켤 때 페이지 안 UI로 확인을 받는다: "발음 사전을 내려받습니다(약 0.9MB, 최초 1회)". alert/confirm 금지. 확인 전에는 네트워크 요청 없음.
- 받는 동안 진행률 표시, 실패 시 "다시 시도". 받은 사전은 서비스 워커가 캐시해 오프라인에서도 켜진다.
- 설정에 "발음 사전 삭제" 버튼. 파일 분할은 하지 않는다.

## 라이브러리 기능

- 라이브러리 화면: 분야 탭, 수준·유형 필터, 제목·상황 검색. 대본을 누르면 바로 재생 화면으로.
- index.json만 먼저 받고, 대본 본문은 선택할 때 받는다.
- URL 해시 `#script=<id>` 로 접속하면 해당 대본이 열린 상태로 시작하고 권장 WPM 자동 적용. 공유 버튼으로 이 링크 복사.
- dialogue: 상대 대사는 흐린 색과 다른 글꼴, 단어 채움 없이 단어 수 기준 시간만 머문다. "내 대사만 연습" 토글을 켜면 상대 대사는 1초만 보여주고 넘어간다.
- 사용자가 직접 넣은 대본도 같은 형식이면 같은 방식으로 표시. 메타데이터가 없으면 monologue로 처리.

## 형식 검사 (tools/lint-library.mjs, 오류 시 종료 코드 1)

- 오류: 메타데이터 누락·범위 밖 값, id 중복, 폴더와 category 불일치, 줄바꿈으로 끊긴 문단, 금지어 포함
- 경고: 25단어 초과 문장, 발음 사전에 없는 단어가 대본당 5개 초과(단어 목록 출력), 다른 대본과 문장 4-gram 중복률 30% 초과
- 출력: 분야별·수준별·유형별 대본 수 표, 위반 목록

## 프로그램 작업 단계와 완료 기준

| 단계 | 작업 | 완료 기준 |
|---|---|---|
| 1 | 저장소 세팅: 구조대로 파일 분리, 일반 HTML 문서로 완성, README 초안, LICENSE | 로컬 서버에서 기존 기능이 모두 동일하게 동작. 콘솔 오류 0 |
| 2 | 발음 사전 빌드: tools/build-ipa.mjs, npm run build:ipa | 단어 수 126,046. regression → rə.ˈɡrɛ.ʃən, minute → ˈmɪ.nət. NOTICE.md 작성 |
| 3 | 발음 사전 다운로드: 확인 문구, 진행률, 재시도, 삭제 | 확인 전 사전 요청 0건. 두 번째 켤 때 요청 0건 |
| 4 | PWA와 오프라인: manifest, 서비스 워커, 아이콘 | 비행기 모드에서 앱과 발음기호 동작. 새 버전 배포 시 새로고침 한 번으로 반영 |
| 5 | 라이브러리: SCRIPT_FORMAT.md, build-library, lint-library, banned-words, GitHub Actions, 라이브러리 화면, dialogue 표시, 공유 링크. 테스트용 대본 3개(qa, dialogue, monologue 각 1개)와 고의로 형식을 어긴 대본 1개(tools/fixtures/에 두고 lint 대상 경로를 인자로 받게 함) | 정상 대본 3개 lint 통과, 위반 대본 실패. 대본 300개를 가정한 더미 index.json으로 목록 화면이 끊김 없이 동작 |
| 6 | 모바일: 터치 조작, 하단 바 재배치 | 375px 폭에서 재생, 문장 이동, 발음기호, 라이브러리 동작 |
| 7 | 배포: GitHub Pages, README 완성(사용법, 단축키, 대본 추가 방법) | 공개 URL에서 1~6단계 완료 기준 재확인 |

## 라이선스

- 앱 코드 MIT, 대본 CC BY 4.0.
- NOTICE.md에 cmu-pronouncing-dictionary(ISC) 저작권 문구.
- CMU 사전 원본(github.com/cmusphinx/cmudict)의 LICENSE를 직접 확인해 그 문구도 옮긴다. 확인하지 못하면 확인하지 못했다고 보고한다.

## 프로그램 작업 규칙

1. 요청받은 단계 하나만 진행한다.
2. 이미 동작하는 기능은 재설계하지 말고 옮기기만 한다. 특히 단어 채움 로직, 문장 분할 규칙, e.code 기준 단축키, 발음기호 음절·강세 표시, 채움 효과를 단어 글자(.t)에만 적용하는 구조(Safari 대응).
3. 프레임워크, 번들러, 외부 API를 추가하지 않는다. 분석 도구는 GoatCounter만 사용하고, 대본 내용과 사용자가 넣은 텍스트·파일명은 보내지 않는다. 그 밖에 필요하면 PR 설명에 제안만 한다.
4. 이 문서와 다르게 해야 할 이유가 생기면 구현하지 말고 PR 설명에 이유와 대안을 적는다.
5. 대본 파일 형식을 바꾸지 않는다.
6. 앱 파일을 바꾸면 `npm run stamp:sw`를 실행하고 커밋한다. 커밋 전에 `npm run check:sw`로 버전 일치를 확인한다. APP_FILES 목록은 sw.js 한 곳에서 관리한다.

## 프로그램 PR 설명 형식

- 변경 파일 목록
- 완료 기준별 확인 방법과 결과(확인 못 한 항목은 확인 못 했다고 적는다)
- 이 문서와 달라진 점과 이유
- 추측으로 채운 부분
