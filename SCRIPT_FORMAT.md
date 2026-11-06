# 대본 파일 형식

대본은 `library/<category>/<id>.md`에 UTF-8로 저장합니다. 앱에 직접 불러오는 마크다운 파일도 같은 형식이면 제목, 안내문, 대화 상대 구분과 권장 WPM을 적용합니다. 메타데이터가 없는 텍스트는 기존 문장 분할 방식의 독백으로 처리합니다.

```md
---
id: health-book-appointment
title: 병원 진료 예약 전화
category: 03-health
situation: 병원 예약 전화
type: dialogue
level: A2
wpm: 120
minutes: 2
region: general
---
※ 대화 속 이름, 날짜, 금액은 가상입니다.

> Good morning. How can I help you?

I'd like to book an appointment, please.
```

| 필드 | 값 |
|---|---|
| id | 영문 소문자·숫자·하이픈, 전체에서 유일, 파일명과 일치 |
| title | 한국어 제목 |
| category | 아래 분야 중 하나, 상위 폴더명과 일치 |
| situation | 연습할 상황 |
| type | `dialogue`, `monologue`, `qa` |
| level | `A2`, `B1`, `B2`, `C1` |
| wpm | 60~250 정수 |
| minutes | 1~10 정수 |
| region | `general`, `CA`, `US` |

모든 필드를 작성합니다. 메타데이터는 한 줄에 `키: 값` 하나씩 쓰며, 위아래를 `---`로 닫습니다. 문자열은 따옴표 없이 쓰거나 한 쌍의 따옴표로 감쌀 수 있습니다. 목록, 여러 줄 값 등 확장 YAML 문법은 사용하지 않습니다.

분야: `01-daily`, `02-housing`, `03-health`, `04-money-admin`, `05-transport`, `06-travel`, `07-work`, `08-job-search`, `09-social`, `10-family`, `11-service-call`, `12-emergency`, `13-speaking`, `14-reading`.

본문은 문단 하나를 한 줄로 쓰고 문단 사이를 빈 줄로 구분합니다. 메타데이터 뒤, 본문 앞의 `※` 안내문은 화면에 작게 표시하고 읽기 대상에서 제외합니다.

- `dialogue`: 상대 대사는 `> `로 시작합니다. 연습할 내 대사는 일반 문단으로 씁니다. 상대 대사는 흐린 색과 다른 글꼴로 표시하며 단어를 채우지 않습니다. 단어 수와 WPM으로 표시 시간을 정하고, **내 대사만 연습**을 켜면 1초 뒤 넘어갑니다.
- `monologue`: 일반 문단만 씁니다.
- `qa`: `## 질문` 줄 다음에 답변 문단을 씁니다. 질문 다음 답변은 빈 줄 없이 바로 시작해도 됩니다. 여러 질문은 빈 줄로 구분합니다.

```md
## What do you usually do on weekends?
I usually go for a walk near my home.

## What would you like to try next?
I'd like to join a cooking class.
```

## 추가와 검사

작성 기준은 [library/AGENTS.md](library/AGENTS.md)를 따릅니다. 현재 포함된 3개 대본은 유형별 동작 확인용으로, 일반 콘텐츠의 2~4분 기준보다 짧습니다. 실제 콘텐츠를 늘리는 작업은 별도 대본 작업에서 진행합니다. 대본 라이선스는 CC BY 4.0입니다.

```sh
npm ci
npm run lint:library
npm run build:library
git add library
```

`build:library`는 메타데이터, 본문 경로, 파일 전체의 SHA-256을 담은 `library/index.json`을 id순으로 생성합니다. 이 목록과 대본을 함께 커밋합니다. 본문만 고쳐도 다시 빌드합니다. 목록에 본문은 포함하지 않으며 앱은 선택한 대본만 요청합니다.

`lint:library`는 메타데이터, 중복 id, 폴더·파일명 불일치, 문단 줄바꿈, 금지어를 오류로 처리하고 종료 코드 1을 반환합니다. 25단어 초과 문장, 사전 미등록 단어 5개 초과, 다른 대본과 문장 내 단어 4-gram 중복률 30% 초과는 경고로 출력합니다. 중복률은 각 대본의 고유 4-gram 중 상대 대본에도 있는 비율이며 문장 경계를 넘지 않습니다. 경고는 검토하되 종료 코드를 바꾸지 않습니다.

금지어는 `tools/banned-words.txt`에서 한 줄에 한 단어 또는 구로 관리합니다. 대소문자와 문장 부호를 정규화하고 단어 경계로 검사합니다. 명단에 없는 실명·브랜드와 내용의 적합성은 작성자 검토가 필요합니다.

특정 경로도 검사할 수 있습니다. 아래 위반 대본은 기본 라이브러리 검사 대상에 포함되지 않으며, 의도적으로 실패합니다.

```sh
npm run lint:library -- tools/fixtures
```

GitHub Actions는 push와 PR마다 lint, build, 생성 목록과 커밋본의 비교, `check:sw`를 실행합니다. 앱 파일을 수정한 경우에는 `npm run stamp:sw`도 실행해 `sw.js`를 함께 커밋합니다.
