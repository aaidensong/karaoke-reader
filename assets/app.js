const SAMPLE = `Most people think fluency comes from knowing more words. In practice, it comes from processing familiar words faster.
When you read at a steady pace, your eyes stop jumping back to the start of the sentence. That habit, called regression, quietly doubles your reading time.
A moving line removes the option to go back. You either keep up, or you notice exactly where you fell behind.
Start at a speed that feels slightly too easy. Raise it by ten words per minute each session.
Read the line out loud when you can. Your mouth will find the weak spots that your eyes skip over.
If a sentence trips you twice, mark it and practice it on its own. Then put it back into the full script and run it again.`;

const $ = id => document.getElementById(id);
const store = {get(k,d){try{const v=localStorage.getItem('kr.'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},
               set(k,v){try{localStorage.setItem('kr.'+k,JSON.stringify(v))}catch(e){}}};

const savedText = store.get('text', null);
const firstVisit = !store.get('visited', false) && !(typeof savedText === 'string' && savedText.trim());
let text = savedText ?? SAMPLE, byLine = store.get('byline', false);
let lines = [], idx = 0, wordIdx = 0, wordStart = 0, playing = false, raf = 0, gapUntil = 0, elapsed = 0, lastT = 0;
const savedSize = store.get('size', null);
// Older versions saved 40 on every startup, so only other legacy values imply a choice.
let sizeCustomized = store.get('sizeCustomized', savedSize !== null && savedSize !== 40) === true;
let wpm = store.get('wpm',150), size = savedSize ?? 40, gapMs = store.get('gap',400);
let currentScriptId = null, ownLines = store.get('ownLines', false) === true;
const startedScripts = new Set();
function track(event, id = currentScriptId || 'custom'){ window.KR_ANALYTICS?.track(event, id); }
$('own-lines').checked = ownLines;

function split(t){
  const rows = t.replace(/\r/g,'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
  if (byLine) return rows;
  // markdown headings stay whole so labels like "C1." are not split as sentences
  return rows.flatMap(r => /^#{1,6}\s/.test(r) ? [r] : r.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g).map(s=>s.trim()).filter(Boolean));
}
// word duration: base share + length weight, scaled so the average word = 60000/wpm ms
function durations(words){
  const w = words.map(x => 0.6 + 0.4 * Math.min(x.replace(/[^A-Za-z0-9']/g,'').length, 14) / 5);
  const per = 60000 / wpm;
  const mean = w.reduce((a,b)=>a+b,0) / w.length;
  // a comma or semicolon at the end of a word gets a short breath
  return w.map((x,i) => x / mean * per * (/[,;:]$/.test(words[i]) ? 1.3 : 1));
}

function build(){
  const parsed = KR_SCRIPT.parse(text);
  const rows = parsed.structured ? parsed.paragraphs.flatMap(p =>
    split(p.heading ? '## ' + p.text.replace(/^##\s+/, '') : p.text).map(s => ({ s, other: p.other }))) : split(text).map(s => ({ s, other: false }));
  lines = rows.map(({ s, other }) => { const m = s.match(/^(#{1,6})\s+(.*)$/); const t = m ? m[2] : s; return { s: t, h: m ? m[1].length : 0, words: t.split(/\s+/), other }; });
  $('script-name').textContent = parsed.structured ? parsed.meta.title || '' : '';
  $('script-notice').textContent = parsed.notices.join('\n');
  $('script-notice').hidden = !parsed.notices.length;
  $('own-lines-label').hidden = parsed.meta.type !== 'dialogue';
  $('share').hidden = !currentScriptId;
  $('reel').innerHTML = lines.map((l,i) =>
    `<div class="ln${l.h?' hd h'+Math.min(l.h,3):''}${l.other?' other':''}" data-i="${i}">${l.words.map(w=>`<span class="w"><span class="t">${w.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span></span>`).join(' ')}</div>`).join('');
  idx = Math.min(idx, Math.max(0, lines.length-1)); wordIdx = 0; elapsed = 0;
  render(true);
}

function render(jump){
  const els = $('reel').children;
  for (let i=0;i<els.length;i++){
    const el = els[i];
    el.className = 'ln' + (lines[i].h?' hd h'+Math.min(lines[i].h,3):'') + (lines[i].other?' other':'') + (i===idx?' cur':i<idx?' past':'') + (i===idx&&ipaOn&&dict&&!lines[i].other?' ipa':'');
    if (i===idx && ipaOn && dict && !lines[i].other) addIpa(el, i);
    if (i===idx){
      [...el.children].forEach((w,j)=>{ w.className = 'w' + (lines[i].other?'':j<wordIdx?' done':j===wordIdx&&playing?' on':''); w.style.removeProperty('--p'); });
    } else [...el.children].forEach(w=>w.className='w');
  }
  layoutObserver.disconnect();
  layoutObserver.observe($('stage'));
  layoutObserver.observe($('reel'));
  if (els[idx]) layoutObserver.observe(els[idx], { box: 'border-box' });
  requestAnimationFrame(center);
  $('prog').style.width = lines.length ? ((idx + (lines[idx] ? wordIdx/lines[idx].words.length : 0)) / lines.length * 100) + '%' : '0';
  stat();
}
function center(){
  const reel = $('reel'), cur = reel.children[idx]; if(!cur) return;
  const box = cur.getBoundingClientRect();
  const top = Math.max(12, $('stage').clientHeight * 0.42 - box.height/2);
  // Subtract the reel's rect to cancel its animated transform and keep fractional pixels.
  const y = top - (box.top - reel.getBoundingClientRect().top);
  reel.style.transform = `translateY(${y}px)`;
}
// Font-size transitions and IPA/font loading change line geometry after render().
// Only move the reel here; rendering again would reset the active word's fill.
const layoutObserver = new ResizeObserver(center);
function stat(){
  const s = Math.floor(elapsed/1000);
  $('stat').textContent = `${lines.length?idx+1:0} / ${lines.length} · ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

let durs = [];
function lineDurations(){
  return !lines[idx] ? [] : lines[idx].other ? [ownLines ? 1000 : lines[idx].words.length * 60000 / wpm] : durations(lines[idx].words);
}
function startLine(t){ durs = lineDurations(); wordIdx = 0; wordStart = t; render(); }

function tick(t){
  if (!playing) return;
  elapsed += t - lastT; lastT = t;
  if (gapUntil){
    if (t < gapUntil){ raf = requestAnimationFrame(tick); return; }
    gapUntil = 0;
    if (idx >= lines.length-1){ track('play-complete'); stop(); return; }
    idx++; startLine(t);
  }
  const line = $('reel').children[idx];
  if (!line){ stop(); return; }
  if (lines[idx].other){
    if (t - wordStart >= durs[0]){
      wordIdx = lines[idx].words.length;
      // Own-lines mode holds the partner's line for one second including the transition.
      gapUntil = t + (ownLines ? .001 : gapMs);
    }
    stat(); raf = requestAnimationFrame(tick); return;
  }
  const d = durs[wordIdx], p = (t - wordStart) / d;
  const w = line.children[wordIdx];
  if (p >= 1){
    w.className = 'w done'; w.style.removeProperty('--p');
    wordIdx++; wordStart = t;
    if (wordIdx >= durs.length){ gapUntil = t + gapMs; }
    else line.children[wordIdx].className = 'w on';
    $('prog').style.width = ((idx + wordIdx/durs.length) / lines.length * 100) + '%';
  } else { w.className = 'w on'; w.style.setProperty('--p', (p*100).toFixed(1)+'%'); }
  stat();
  raf = requestAnimationFrame(tick);
}

function play(){
  if (!lines.length) return;
  // Custom texts stay in memory for deduplication; only the literal "custom" is sent.
  const key = currentScriptId ? `library:${currentScriptId}` : `custom:${text}`;
  if (!startedScripts.has(key)){ startedScripts.add(key); track('play-start'); }
  if (idx >= lines.length-1 && wordIdx >= lines[idx].words.length) { idx = 0; wordIdx = 0; }
  playing = true; $('playlbl').textContent = KR_I18N.pause;
  const t = performance.now(); lastT = t;
  durs = lineDurations();
  wordStart = t; render();
  raf = requestAnimationFrame(tick);
}
function stop(){ playing = false; gapUntil = 0; cancelAnimationFrame(raf); $('playlbl').textContent = KR_I18N.play; render(); }
function toggle(){ playing ? stop() : play(); }
function go(d){
  idx = Math.max(0, Math.min(lines.length-1, idx+d)); gapUntil = 0;
  if (playing){ const t=performance.now(); startLine(t); } else { wordIdx = 0; render(); }
}

function setWpm(v){ wpm = Math.max(60, Math.min(400, v)); $('wpm').value = wpm; $('wpmv').textContent = wpm; store.set('wpm', wpm);
  if (playing && lines[idx]){ const t = performance.now(), i = lines[idx].other ? 0 : wordIdx; const p = Math.min(1,(t-wordStart)/(durs[i]||1)); durs = lineDurations(); wordStart = t - p*(durs[i]||0); } }
function syncSize(){
  if (sizeCustomized) document.documentElement.style.setProperty('--size', size+'px');
  else {
    document.documentElement.style.removeProperty('--size');
    size = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--size'));
  }
  $('fs').value = size; $('fsv').textContent = size;
}
function setSize(v){
  size = v; sizeCustomized = true;
  store.set('size', v); store.set('sizeCustomized', true);
  syncSize();
}
function setGap(v){ gapMs = v; $('gap').value = v; $('gapv').textContent = (v/1000).toFixed(1)+'s'; store.set('gap', v); }

$('play').onclick = toggle;
$('stage').onclick = toggle;
$('prev').onclick = () => go(-1);
$('next').onclick = () => go(1);
$('wpm').oninput = e => setWpm(+e.target.value);
$('fs').oninput = e => setSize(+e.target.value);
$('gap').oninput = e => setGap(+e.target.value);
$('edit').onclick = openEditor;
$('cancel').onclick = () => $('drawer').hidden = true;
$('drawer').onclick = e => { if (e.target.id==='drawer') $('drawer').hidden = true; };
$('apply').onclick = () => {
  const next = $('src').value.trim() || SAMPLE, parsed = KR_SCRIPT.parse(next);
  if (parsed.errors.length){ $('script-error').textContent = KR_I18N.scriptInvalid + ' ' + parsed.errors.join(' '); $('script-error').hidden = false; return; }
  text = next; byLine = $('byline').checked;
  currentScriptId = null; libraryLoad?.abort();
  history.replaceState(null, '', location.pathname + location.search);
  $('script-status').textContent = ''; $('share-link').hidden = true;
  if (parsed.structured) setWpm(parsed.meta.wpm);
  store.set('text', text); store.set('byline', byLine);
  idx = 0; $('drawer').hidden = true; build();
  track('script-open');
};
// file import: plain text, subtitles (timestamps stripped), Word via mammoth loaded on demand
function cleanSubs(t){
  return t.replace(/^WEBVTT.*$/m,'').split(/\n/).filter(l => !/^\d+\s*$/.test(l.trim()) && !/-->/.test(l) && !/^(NOTE|STYLE)\b/.test(l.trim()))
    .map(l => l.replace(/<[^>]+>/g,'').trim()).filter(Boolean).join(' ');
}
function loadMammoth(){
  return window.mammoth ? Promise.resolve() : new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    s.onload = ok; s.onerror = () => no(new Error(KR_I18N.wordToolError));
    document.head.appendChild(s);
  });
}
async function importFile(f){
  if (!f) return;
  const name = f.name.toLowerCase();
  $('fmsg').textContent = f.name + KR_I18N.reading;
  try {
    let t;
    if (name.endsWith('.docx')){ await loadMammoth(); t = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value; }
    else if (/\.(pdf|doc|pages|hwp)$/.test(name)) throw new Error(KR_I18N.unsupportedFile);
    else { t = await f.text(); if (/\.(srt|vtt)$/.test(name)) t = cleanSubs(t); }
    t = t.trim();
    if (!t) throw new Error(KR_I18N.emptyFile);
    if ($('drawer').hidden) openEditor();
    $('src').value = t;
    $('fmsg').textContent = f.name + KR_I18N.imported;
  } catch (err) { if ($('drawer').hidden) openEditor(); $('fmsg').textContent = err.message; }
}
$('pick').onclick = () => $('file').click();
$('file').onchange = e => { importFile(e.target.files[0]); e.target.value = ''; };
let dragDepth = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; document.body.classList.add('over'); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0){ dragDepth = 0; document.body.classList.remove('over'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('over'); importFile(e.dataTransfer.files[0]); });

// The page and service worker share a scope-specific dictionary cache, independent of app versions.
const appBase = new URL('./', location.href);
const dictURL = new URL('data/ipa-en-us.json', appBase).href;
const dictCacheName = `karaoke-reader:${appBase.pathname}:dictionary-v1`;
let dict = null, ipaOn = false, dictController = null, dictState = 'idle';
let dictCached = false, dictDeleting = false, dictPersistence = Promise.resolve();
function validDict(data){
  return data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length &&
    Object.values(data).every(value => typeof value === 'string' && value.length);
}
async function restoreDict(){
  const remembered = store.get('ipa', false) === true;
  try {
    const cache = await caches.open(dictCacheName);
    const response = await cache.match(dictURL);
    if (response){
      dictCached = true;
      const data = await response.json();
      if (!validDict(data)) throw new Error();
      dict = data;
    }
  } catch (error){
    // Corrupt or inaccessible storage must never trigger a network request.
    try { await (await caches.open(dictCacheName)).delete(dictURL); dictCached = false; } catch (_) {}
  }
  ipaOn = remembered && !!dict;
  store.set('ipa', ipaOn);
  updateIpaButton();
  renderKeep();
}
async function persistDict(json, controller){
  try {
    const cache = await caches.open(dictCacheName);
    // Build a decoded response: compressed Content-Length/Encoding no longer describe these bytes.
    await cache.put(dictURL, new Response(json, { headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
    if (dictController !== controller || controller.signal.aborted){
      await cache.delete(dictURL);
      return false;
    }
    dictCached = true;
    return true;
  } catch (error){ return false; }
}
function lookup(raw){
  const w = raw.toLowerCase().replace(/[‘’]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
  if (!w || /^\d+$/.test(w)) return null;
  const base = w.replace(/'s$/, '');
  let p = dict[w] || (dict[base] && dict[base] + 'z') || dict[w.replace(/'/g, '')];
  if (!p && w.includes('-')) { const parts = w.split('-').map(x => dict[x]); if (parts.every(Boolean)) p = parts.join('.'); }
  return p || '';
}
// one span per syllable; primary stress coloured, secondary emphasised, dots mark syllable breaks
function addIpa(el, li){
  if (el.dataset.ipaDone) return;
  el.dataset.ipaDone = 1;
  [...el.children].forEach((w, j) => {
    const p = lookup(lines[li].words[j]);
    const ph = document.createElement('span'); ph.className = 'ph';
    if (p === null) ph.textContent = ' ';
    else if (!p) ph.textContent = '—';
    else {
      ph.append('/');
      p.split('.').forEach((sy, n) => {
        if (n) { const d = document.createElement('span'); d.className = 'sep'; d.textContent = '·'; ph.append(d); }
        const t = document.createElement('span');
        t.className = sy[0] === 'ˈ' ? 's1' : sy[0] === 'ˌ' ? 's2' : '';
        t.textContent = sy; ph.append(t);
      });
      ph.append('/');
    }
    w.append(ph);
  });
}
function updateIpaButton(){
  $('ipa').setAttribute('aria-pressed', ipaOn);
  $('ipalbl').textContent = ipaOn ? KR_I18N.ipaOn : KR_I18N.ipaOff;
}
function updateDictSettings(message){
  $('dict-consent').hidden = dictState === 'idle';
  $('dict-download').hidden = dictState !== 'loading';
  $('dict-start').hidden = dictState !== 'prompt';
  $('dict-retry').hidden = dictState !== 'error';
  $('dict-delete').disabled = dictDeleting || (!dict && !dictCached);
  $('settings-close').textContent = dictState === 'loading' ? KR_I18N.cancelDownload : KR_I18N.close;
  $('dict-status').textContent = message || (dict ? (dictCached ? KR_I18N.ipaReady : KR_I18N.ipaMemoryOnly) : KR_I18N.ipaMissing);
}
async function openSettings(){
  await dictReady;
  updateDictSettings();
  if (!$('settings').open) $('settings').showModal();
}
async function setIpa(on){
  await dictReady;
  if (dictDeleting) return;
  if (on && !dict){
    dictState = 'prompt';
    await openSettings();
    $('dict-start').focus();
    return;
  }
  ipaOn = on;
  store.set('ipa', ipaOn);
  updateIpaButton();
  renderKeep();
}
async function downloadDict(){
  await dictReady;
  await dictPersistence;
  if (dict || dictController || dictDeleting || !['prompt', 'error'].includes(dictState)) return;
  track('dictionary-confirm');
  const controller = new AbortController();
  dictController = controller;
  dictState = 'loading';
  $('dict-progress').removeAttribute('value');
  updateDictSettings(KR_I18N.ipaDownloading);
  $('settings-close').focus();
  try {
    // no-store bypasses the HTTP cache; explicit Cache API writes below are separate.
    // The worker can still serve its cache, and deletion removes that entry before the next consent.
    const response = await fetch(dictURL, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error();
    const reader = response.body.getReader();
    // Content-Length may describe compressed bytes; use indeterminate progress in that case.
    const compressed = !!response.headers.get('Content-Encoding');
    const total = compressed ? 0 : Number(response.headers.get('Content-Length'));
    const decoder = new TextDecoder();
    let received = 0, json = '';
    while (true){
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      json += decoder.decode(value, { stream: true });
      const percent = total > 0 ? Math.min(99, Math.floor(received / total * 100)) : null;
      if (percent !== null) $('dict-progress').value = percent;
      $('dict-status').textContent = compressed ? KR_I18N.ipaDownloading :
        `${KR_I18N.ipaDownloading} ${percent === null ? '' : percent + '% · '}${(received / 1024).toFixed(1)} KB ${KR_I18N.ipaReceived}`;
    }
    json += decoder.decode();
    const data = JSON.parse(json);
    if (!validDict(data)) throw new Error();
    if (dictController !== controller || controller.signal.aborted) return;
    dictPersistence = persistDict(json, controller);
    const saved = await dictPersistence;
    if (dictController !== controller || controller.signal.aborted) return;
    dict = data;
    dictController = null;
    dictState = 'idle';
    $('dict-progress').value = 100;
    updateDictSettings(saved ? KR_I18N.ipaReady : KR_I18N.ipaMemoryOnly);
    await setIpa(true);
    if (saved) $('settings').close();
  } catch (error){
    if (dictController !== controller) return;
    dictController = null;
    dictState = 'error';
    updateDictSettings(KR_I18N.ipaError);
    $('dict-retry').focus();
  }
}
function cancelDictDownload(){
  if (['prompt', 'loading', 'error'].includes(dictState)) track('dictionary-cancel');
  if (dictController){
    dictController.abort();
    dictController = null;
  }
  dictState = 'idle';
}
async function deleteDict(){
  await dictReady;
  if (dictDeleting) return;
  dictDeleting = true;
  cancelDictDownload();
  dict = null;
  ipaOn = false;
  store.set('ipa', false);
  updateIpaButton();
  for (const el of $('reel').children){
    delete el.dataset.ipaDone;
    el.classList.remove('ipa');
    el.querySelectorAll('.ph').forEach(ph => ph.remove());
  }
  updateDictSettings(KR_I18N.ipaDeleting);
  let removed = false;
  try {
    await dictPersistence;
    if ('caches' in window) await (await caches.open(dictCacheName)).delete(dictURL);
    dictCached = false;
    removed = true;
  } catch (error){ dictCached = true; }
  dictDeleting = false;
  updateDictSettings(removed ? KR_I18N.ipaDeleted : KR_I18N.ipaDeleteError);
  renderKeep();
  $('settings-close').focus();
}
$('settingsbtn').onclick = openSettings;
$('settings-close').onclick = () => { cancelDictDownload(); $('settings').close(); };
$('settings').oncancel = cancelDictDownload;
$('dict-start').onclick = downloadDict;
$('dict-retry').onclick = downloadDict;
$('dict-delete').onclick = deleteDict;
// update only the current line so the word being filled is not reset
function renderKeep(){
  const el = $('reel').children[idx]; if (!el) return;
  el.classList.toggle('ipa', ipaOn && !!dict && !lines[idx].other);
  if (ipaOn && dict && !lines[idx].other) addIpa(el, idx);
  setTimeout(center, 30);
}
$('ipa').onclick = () => setIpa(!ipaOn);

function openEditor(){ stop(); $('src').value = text; $('byline').checked = byLine; $('script-error').hidden = true; $('drawer').hidden = false; $('src').focus(); }

function restartLine(){ gapUntil = 0; wordIdx = 0; if (playing) startLine(performance.now()); else render(); }
function toggleHelp(force){ const h = $('help'); h.hidden = force === undefined ? !h.hidden : !force; }
function fullscreen(){
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(()=>{}); } catch(e) {}
}
$('helpbtn').onclick = () => toggleHelp();
$('help').onclick = e => { if (e.target.id === 'help') toggleHelp(false); };
// mouse clicks should not leave focus on a button, or Space would press that button again
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && e.detail > 0) b.blur(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ $('drawer').hidden = true; toggleHelp(false); return; }
  if (!$('drawer').hidden || $('settings').open || $('library').open) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target.tagName;
  if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA') return;
  const c = e.code, once = !e.repeat;
  const act = {
    Space:      () => once && toggle(),
    ArrowRight: () => go(1),
    ArrowLeft:  () => go(-1),
    ArrowUp:    () => setWpm(wpm + 10),
    ArrowDown:  () => setWpm(wpm - 10),
    KeyR:       () => { if (!once) return; if (e.shiftKey){ idx = 0; restartLine(); } else restartLine(); },
    KeyP:       () => once && setIpa(!ipaOn),
    KeyE:       () => once && openEditor(),
    KeyF:       () => once && fullscreen(),
    Minus:      () => setSize(Math.max(24, size - 2)),
    Equal:      () => setSize(Math.min(72, size + 2)),
    NumpadSubtract: () => setSize(Math.max(24, size - 2)),
    NumpadAdd:  () => setSize(Math.min(72, size + 2)),
    Slash:      () => once && toggleHelp(),
  }[c];
  if (!act) return;
  e.preventDefault();
  act();
});
window.addEventListener('resize', () => { syncSize(); center(); });

// The index stays in memory; script bodies are fetched only when selected, never put in Cache API.
let libraryIndex = null, indexRequest = null, libraryLoad = null, failedScript = null;
let category = '', filterFrame = 0;
const message = (key, values) => KR_I18N[key].replace(/\{(\w+)\}/g, (_, name) => values[name]);
function option(value, label){ const el = document.createElement('option'); el.value = value; el.textContent = label; return el; }
function categoryLabel(value){ return KR_I18N.categoryLabels[KR_SCRIPT.categories.indexOf(value)]; }
for (const value of ['', ...KR_SCRIPT.categories]){
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.category = value;
  button.textContent = value ? categoryLabel(value) : KR_I18N.allCategories;
  button.setAttribute('aria-pressed', value === '');
  button.onclick = () => {
    category = value;
    for (const tab of $('library-categories').children) tab.setAttribute('aria-pressed', tab === button);
    renderLibrary();
  };
  $('library-categories').append(button);
}
$('library-level').append(option('', KR_I18N.allLevels), ...KR_SCRIPT.levels.map(level => option(level, level)));
$('library-type').append(option('', KR_I18N.allTypes), ...KR_SCRIPT.types.map(type => option(type, KR_I18N.typeLabels[type])));
function renderLibrary(){
  if (!libraryIndex) return;
  const search = $('library-search').value.trim().toLocaleLowerCase();
  const matches = libraryIndex.filter(s => (!category || s.category === category) &&
    (!$('library-level').value || s.level === $('library-level').value) &&
    (!$('library-type').value || s.type === $('library-type').value) &&
    `${s.title} ${s.situation}`.toLocaleLowerCase().includes(search));
  const fragment = document.createDocumentFragment();
  for (const script of matches){
    const button = document.createElement('button'); button.type = 'button'; button.className = 'library-card';
    const title = document.createElement('strong'); title.textContent = script.title;
    const situation = document.createElement('span'); situation.textContent = script.situation;
    const details = document.createElement('small');
    details.textContent = [categoryLabel(script.category), script.level, KR_I18N.typeLabels[script.type],
      `${script.wpm} ${KR_I18N.wpm}`, message('scriptMinutes', { minutes: script.minutes })].join(' · ');
    button.append(title, situation, details);
    button.onclick = () => openLibraryScript(script.id);
    fragment.append(button);
  }
  $('library-list').replaceChildren(fragment);
  $('library-status').textContent = matches.length ? message('libraryCount', { count: matches.length }) : KR_I18N.libraryEmpty;
}
async function ensureLibraryIndex(){
  if (libraryIndex) return libraryIndex;
  if (indexRequest) return indexRequest;
  $('library-status').textContent = KR_I18N.libraryLoading; $('library-retry').hidden = true;
  indexRequest = (async () => {
    const response = await fetch(new URL('library/index.json', appBase), { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json(), ids = new Set();
    if (!Array.isArray(data) || data.some(s => {
      if (!s || typeof s.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id) || ids.has(s.id) ||
        !KR_SCRIPT.categories.includes(s.category) || !KR_SCRIPT.levels.includes(s.level) || !KR_SCRIPT.types.includes(s.type) ||
        typeof s.title !== 'string' || typeof s.situation !== 'string' || !Number.isInteger(s.wpm) || s.wpm < 60 || s.wpm > 250 ||
        !Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 10 || s.path !== `library/${s.category}/${s.id}.md`) return true;
      ids.add(s.id); return false;
    })) throw new Error();
    libraryIndex = data; renderLibrary(); return data;
  })();
  try { return await indexRequest; }
  catch (error){ $('library-status').textContent = KR_I18N.libraryError; $('library-retry').hidden = false; throw error; }
  finally { indexRequest = null; }
}
async function openLibrary(){
  stop(); $('library').showModal();
  try { await ensureLibraryIndex(); renderLibrary(); } catch (_) {}
  $('library-search').focus();
}
async function openLibraryScript(id, updateHash = true){
  stop(); libraryLoad?.abort();
  const controller = new AbortController(); libraryLoad = controller; failedScript = id;
  $('script-status').textContent = KR_I18N.scriptLoading;
  $('library-status').textContent = KR_I18N.scriptLoading;
  $('share-link').hidden = true;
  try {
    const scripts = await ensureLibraryIndex();
    if (controller.signal.aborted) return;
    const script = scripts.find(s => s.id === id);
    if (!script){
      $('script-status').textContent = KR_I18N.scriptNotFound;
      $('library-status').textContent = KR_I18N.scriptNotFound;
      return;
    }
    const response = await fetch(new URL(script.path, appBase), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error();
    const source = await response.text(), parsed = KR_SCRIPT.parse(source);
    if (!parsed.structured || parsed.errors.length || parsed.meta.id !== id || parsed.meta.category !== script.category) throw new Error();
    if (controller.signal.aborted) return;
    stop();
    text = source; byLine = false; currentScriptId = id; idx = 0;
    store.set('text', text); store.set('byline', false);
    setWpm(parsed.meta.wpm); build();
    track('script-open');
    const hash = '#script=' + encodeURIComponent(id);
    if (updateHash && location.hash !== hash) history.pushState(null, '', hash);
    failedScript = null; $('script-status').textContent = ''; $('library-retry').hidden = true;
    if ($('library').open) $('library').close();
    $('librarybtn').focus();
  } catch (error){
    if (controller.signal.aborted) return;
    $('script-status').textContent = KR_I18N.scriptLoadError;
    $('library-status').textContent = KR_I18N.scriptLoadError;
    $('library-retry').hidden = false;
  }
}
function openHashScript(){
  const id = new URLSearchParams(location.hash.slice(1)).get('script');
  if (id) openLibraryScript(id, false);
  else {
    libraryLoad?.abort(); currentScriptId = null; failedScript = null;
    $('share').hidden = true; $('share-link').hidden = true; $('script-status').textContent = '';
  }
}
$('librarybtn').onclick = openLibrary;
$('library-close').onclick = () => $('library').close();
$('library-retry').onclick = async () => {
  if (failedScript) await openLibraryScript(failedScript);
  else { try { await ensureLibraryIndex(); } catch (_) {} }
};
for (const id of ['library-search', 'library-level', 'library-type']) $(id).oninput = () => {
  cancelAnimationFrame(filterFrame); filterFrame = requestAnimationFrame(renderLibrary);
};
$('own-lines').onchange = () => {
  ownLines = $('own-lines').checked; store.set('ownLines', ownLines);
  if (lines[idx]?.other) restartLine();
};
$('share').onclick = async () => {
  if (!currentScriptId) return;
  const url = new URL('./', appBase); url.hash = 'script=' + encodeURIComponent(currentScriptId);
  const sharedId = currentScriptId;
  try {
    await navigator.clipboard.writeText(url.href);
    track('share-copy', sharedId);
    $('script-status').textContent = KR_I18N.shareCopied;
  } catch (_){
    $('share-link').hidden = false; $('share-link').value = url.href;
    $('share-link').focus(); $('share-link').select();
    $('script-status').textContent = KR_I18N.shareFallback;
  }
};
$('share-link').oncopy = () => { if (currentScriptId) track('share-copy'); };
window.addEventListener('hashchange', openHashScript);

setWpm(wpm); syncSize(); setGap(gapMs); build();
updateIpaButton();
const dictReady = restoreDict();
openHashScript();
if (!new URLSearchParams(location.hash.slice(1)).get('script')) track('script-open');
// A shared link takes priority, including an empty or unknown script parameter.
if (firstVisit && !new URLSearchParams(location.hash.slice(1)).has('script')) openLibrary();
store.set('visited', true);

// Install a complete app version, then reload existing controlled pages once on activation.
if ('serviceWorker' in navigator){
  const wasControlled = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled && !reloading){ reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register(new URL('sw.js', appBase), { updateViaCache: 'none' })
    .then(registration => registration.update()).catch(() => {});
}
