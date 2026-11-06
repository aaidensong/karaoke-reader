// Shared by the browser and Node tools. Plain text keeps the existing sentence splitter.
globalThis.KR_SCRIPT = (() => {
  const categories = ['01-daily', '02-housing', '03-health', '04-money-admin', '05-transport',
    '06-travel', '07-work', '08-job-search', '09-social', '10-family', '11-service-call',
    '12-emergency', '13-speaking', '14-reading'];
  const levels = ['A2', 'B1', 'B2', 'C1'];
  const types = ['dialogue', 'monologue', 'qa'];
  const fields = ['id', 'title', 'category', 'situation', 'type', 'level', 'wpm', 'minutes', 'region'];
  function parse(raw){
    const rows = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    const meta = {}, errors = [], notices = [], paragraphs = [];
    if (rows[0]?.trim() !== '---') return { structured: false, meta, errors, notices, paragraphs };
    const end = rows.findIndex((row, i) => i > 0 && row.trim() === '---');
    if (end < 0) return { structured: true, meta, notices, paragraphs, errors: ['메타데이터 닫는 ---가 없습니다.'] };
    rows.slice(1, end).forEach((row, i) => {
      if (!row.trim()) return;
      const match = row.match(/^([a-z]+):\s*(.*?)\s*$/);
      if (!match || !fields.includes(match[1])) { errors.push(`${i + 2}행: 알 수 없는 메타데이터입니다.`); return; }
      const [, key, value] = match;
      if (Object.hasOwn(meta, key)) errors.push(`${key}: 메타데이터가 중복됩니다.`);
      meta[key] = value.replace(/^(["'])(.*)\1$/, '$2');
    });
    for (const key of fields) if (!meta[key]) errors.push(`${key}: 필수 메타데이터가 없습니다.`);
    if (meta.id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.id)) errors.push('id: 소문자·숫자·하이픈만 사용합니다.');
    if (meta.title && !/[가-힣]/.test(meta.title)) errors.push('title: 한국어 제목이 필요합니다.');
    for (const [key, values] of [['category', categories], ['level', levels], ['type', types], ['region', ['general', 'CA', 'US']]]){
      if (meta[key] && !values.includes(meta[key])) errors.push(`${key}: 허용되지 않은 값입니다.`);
    }
    for (const [key, min, max] of [['wpm', 60, 250], ['minutes', 1, 10]]){
      if (meta[key] && (!/^\d+$/.test(meta[key]) || +meta[key] < min || +meta[key] > max)) errors.push(`${key}: ${min}~${max} 정수여야 합니다.`);
      if (/^\d+$/.test(meta[key] || '')) meta[key] = +meta[key];
    }
    let started = false, previous = '', question = false, answer = false;
    rows.slice(end + 1).forEach((row, offset) => {
      const s = row.trim(), number = end + offset + 2;
      if (!s) { previous = ''; return; }
      if (!started && s.startsWith('※')) { notices.push(s); return; }
      started = true;
      const heading = /^##\s+/.test(s), other = s.startsWith('> ');
      if (s.startsWith('※')) errors.push(`${number}행: 안내문은 본문 앞에 둡니다.`);
      if (previous && previous !== 'heading') errors.push(`${number}행: 문단 사이에 빈 줄이 필요합니다(줄바꿈으로 끊긴 문단).`);
      if (meta.type === 'qa'){
        if (heading){
          if (question && !answer) errors.push(`${number}행: 이전 질문의 답변이 없습니다.`);
          question = true; answer = false;
        } else {
          if (!question) errors.push(`${number}행: 답변 앞에 ## 질문이 필요합니다.`);
          answer = true;
        }
        if (other || (/^#/.test(s) && !heading)) errors.push(`${number}행: qa 본문 형식이 다릅니다.`);
      } else if (/^#/.test(s) || (meta.type === 'monologue' && other)) errors.push(`${number}행: ${meta.type} 본문 형식이 다릅니다.`);
      paragraphs.push({ text: other ? s.slice(2) : s, heading, other, number });
      previous = heading ? 'heading' : 'paragraph';
    });
    if (!paragraphs.length) errors.push('본문이 없습니다.');
    if (meta.type === 'qa' && question && !answer) errors.push('마지막 질문의 답변이 없습니다.');
    return { structured: true, meta, errors, notices, paragraphs };
  }
  const words = text => text.toLowerCase().replace(/[‘’]/g, "'").match(/[a-z]+(?:['-][a-z]+)*/g) || [];
  const sentences = text => text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g)?.map(s => s.trim()).filter(Boolean) || [];
  return Object.freeze({ categories, levels, types, parse, words, sentences });
})();
