// usage: npm ci && npm run build:ipa
// converts CMU ARPAbet to US IPA with syllable dots (.) and stress marks (ˈ primary, ˌ secondary)
import { dictionary } from 'cmu-pronouncing-dictionary';
import fs from 'fs';
const C={B:'b',CH:'tʃ',D:'d',DH:'ð',F:'f',G:'ɡ',HH:'h',JH:'dʒ',K:'k',L:'l',M:'m',N:'n',NG:'ŋ',P:'p',R:'r',S:'s',SH:'ʃ',T:'t',TH:'θ',V:'v',W:'w',Y:'j',Z:'z',ZH:'ʒ'};
const V={AA:'ɑ',AE:'æ',AH:'ʌ',AO:'ɔ',AW:'aʊ',AY:'aɪ',EH:'ɛ',ER:'ɝ',EY:'eɪ',IH:'ɪ',IY:'i',OW:'oʊ',OY:'ɔɪ',UH:'ʊ',UW:'u'};
const ON=new Set(['pl','pr','bl','br','tr','dr','kl','kr','ɡl','ɡr','fl','fr','θr','ʃr','sp','st','sk','sm','sn','sl','sw','tw','kw','dw','pj','bj','kj','fj','mj','hj','spr','str','skr','spl','skw','skj','spj','tʃ','dʒ']);
function ipa(arp){
  const ph=arp.trim().split(/\s+/).filter(p=>/^[A-Z]+[012]?$/.test(p)); const out=[]; // items {s, v:bool, st}
  for(const p of ph){const m=p.match(/^([A-Z]+)([012])?$/); const b=m[1], st=m[2];
    if(V[b]){let s=V[b]; if(st==='0'){ if(b==='AH') s='ə'; if(b==='ER') s='ɚ'; if(b==='IH') s='ɪ'; }
      if(st!=='0' && b==='ER') s='ɝ';
      out.push({s,v:1,st});} else out.push({s:C[b],v:0});}
  // split into syllables: each vowel takes the longest legal onset before it
  const vi=out.map((x,i)=>x.v?i:-1).filter(i=>i>=0);
  if(vi.length<2) return out.map(x=>x.s).join('');
  const starts=vi.map((i,n)=>{ if(n===0) return 0; const prev=vi[n-1]; const cons=out.slice(prev+1,i).map(c=>c.s);
    let take=0; for(let k=Math.min(3,cons.length);k>=1;k--){const cl=cons.slice(cons.length-k).join(''); if(k===1||ON.has(cl)){take=k;break;}}
    return i-take; });
  const syl=starts.map((st,n)=>{ const en=n+1<starts.length?starts[n+1]:out.length; const v=out[vi[n]];
    return (v.st==='1'?'ˈ':v.st==='2'?'ˌ':'')+out.slice(st,en).map(x=>x.s).join(''); });
  return syl.join('.');
}
const out={};
for(const [w,a] of Object.entries(dictionary)){ if(/\(\d+\)$/.test(w))continue; out[w]=ipa(a); }
const output = new URL('../data/ipa-en-us.json', import.meta.url);
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(output,JSON.stringify(out));
console.log(Object.keys(out).length, ['pronunciation','fluency','regression','minute','the','comes','processing'].map(w=>w+' /'+out[w]+'/').join('  '));
