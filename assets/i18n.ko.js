// UI strings and labels. Loaded before app.js.
const KR_I18N = Object.freeze({
  "appName": "Karaoke Reader",
  "stageHint": "? 단축키 보기 · 파일을 끌어다 놓으면 대본으로 불러옵니다",
  "play": "▶ 재생",
  "wpm": "WPM",
  "fontSize": "글자",
  "sentenceGap": "문장 간격",
  "ipaOff": "발음기호 끔",
  "editScript": "대본 편집",
  "shortcuts": "단축키",
  "helpPlay": "재생 / 일시정지",
  "helpMove": "이전 / 다음 문장",
  "helpRestartLine": "현재 문장 처음부터 다시",
  "helpRestartScript": "대본 처음으로",
  "helpSpeed": "속도 ±10 WPM",
  "helpIpa": "발음기호 켜기 / 끄기",
  "helpFontSize": "글자 작게 / 크게",
  "helpFullscreen": "전체 화면",
  "helpEdit": "대본 편집",
  "helpToggle": "이 창 열기 / 닫기",
  "helpClose": "열린 창 닫기",
  "helpNote": "한글 입력 상태에서도 동작합니다. 대본 편집 창이 열려 있을 때는 Esc만 동작합니다.",
  "scriptTitle": "대본",
  "editorHint": "문장 부호(. ! ?)와 줄바꿈 기준으로 한 줄씩 나뉩니다. 한 줄로 묶고 싶은 구간은 직접 줄바꿈으로 조정하세요. 대본은 이 브라우저에만 저장됩니다.",
  "attachFile": "파일 첨부",
  "supportedFiles": ".txt .md .srt .vtt .docx 지원 · 이 창이나 화면 어디에든 끌어다 놓아도 됩니다",
  "byLine": " 줄바꿈 단위로만 나누기",
  "close": "닫기",
  "apply": "적용",
  "stageTitle": "클릭: 재생/일시정지",
  "previousSentence": "이전 문장",
  "nextSentence": "다음 문장",
  "pause": "❚❚ 정지",
  "wordToolError": "Word 변환 도구를 불러오지 못했습니다.",
  "unsupportedFile": "이 형식은 지원하지 않습니다. 텍스트를 복사해 붙여 넣어 주세요.",
  "emptyFile": "파일에서 텍스트를 찾지 못했습니다.",
  "ipaOn": "발음기호 켬",
  "loading": "불러오는 중…",
  "ipaError": "불러오기 실패 · 다시 시도",
  "reading": " 읽는 중…",
  "imported": " 불러옴 · 확인 후 적용을 누르세요"
});

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = KR_I18N[el.dataset.i18n];
}
for (const attr of ["title", "aria-label"]) {
  for (const el of document.querySelectorAll(`[data-i18n-${attr}]`)) {
    el.setAttribute(attr, KR_I18N[el.getAttribute(`data-i18n-${attr}`)]);
  }
}
