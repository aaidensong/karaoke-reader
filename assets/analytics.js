// Only fixed event names and IDs resolved from the library index enter this module.
// https://www.goatcounter.com/help/start · /help/js · /help/events
(() => {
  const local = /(^|\.)localhost$|^127\.|^\[::1\]$/.test(location.hostname) || location.protocol === 'file:';
  const events = new Set(['script-open', 'play-start', 'play-complete', 'dictionary-confirm', 'dictionary-cancel', 'share-copy']);
  let ready = false, failed = false;
  const pending = [];
  function send(hit){
    try { window.goatcounter.count(hit); } catch (_) { /* Analytics must never interrupt practice. */ }
  }
  window.KR_ANALYTICS = {
    track(event, scriptId = 'custom'){
      if (local || failed || !events.has(event)) return;
      const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scriptId) ? scriptId : 'custom';
      const path = event.startsWith('dictionary-') ? event : `${event}:${id}`;
      const hit = { path, title: event, referrer: '', event: true, no_session: true };
      if (ready) send(hit);
      else if (pending.length < 100) pending.push(hit);
    }
  };
  // Do not even load the third-party script on local hosts.
  if (local) return;
  window.goatcounter = { no_onload: true, no_events: true };
  const script = document.createElement('script');
  script.dataset.goatcounter = 'https://karaoke-reader.goatcounter.com/count';
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.referrerPolicy = 'no-referrer';
  script.onerror = () => { failed = true; pending.length = 0; };
  script.onload = () => {
    const counter = window.goatcounter;
    if (typeof counter?.count !== 'function' || typeof counter?.get_data !== 'function'){
      failed = true; pending.length = 0; return;
    }
    // count.js also includes location.search in `q`, even with an explicit path.
    // Allowlist its payload before the first manual count so query text cannot leak.
    const getData = counter.get_data;
    counter.get_data = vars => {
      const data = getData(vars);
      return { p: data.p, t: data.t, e: data.e, s: data.s, b: data.b, ns: data.ns };
    };
    ready = true;
    send({ path: '/karaoke-reader/', title: 'Karaoke Reader', referrer: '', event: false });
    pending.splice(0).forEach(send);
  };
  document.head.appendChild(script);
})();
