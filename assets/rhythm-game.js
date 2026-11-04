(() => {
'use strict';
const $=id=>document.getElementById(id);
const settings={beginner:{bpm:72,tolerance:.230,label:'はじめて',patterns:[['タン','タン','タン','タン'],['タン','タタ','タン','タン'],['タン','ウン','タン','タン'],['タン','タン','タタ','タン'],['タタ','タン','ウン','タン']]},challenge:{bpm:84,tolerance:.190,label:'ちょっと挑戦',patterns:[['タタ','タン','タタ','タン'],['タン','ウン','タタ','タン'],['タタ','タタ','タン','ウン'],['ウン','タタ','タン','タタ'],['タタ','ウン','タタ','タン']]}};
let level='beginner', round=0, scores=[], taps=[], state='setup', sound=true, audio, gain, sources=[], origin=0, duration=0, frame=0, clock=()=>performance.now()/1000, roundClock=clock, heard=false;
const total=()=>scores.reduce((a,b)=>a+b,0), beatSeconds=()=>60/settings[level].bpm;
const expected=()=>settings[level].patterns[round].flatMap((v,i)=>v==='ウン'?[]:v==='タタ'?[i*beatSeconds(),(i+.5)*beatSeconds()]:[i*beatSeconds()]);
function track(name,stars=0){if(location.protocol!=='https:'||!['alicepiano-komatsu.com','www.alicepiano-komatsu.com'].includes(location.hostname))return;try{window.gtag?.('event',name,{send_to:'G-1B9Q314H3W',difficulty:level,round:round+1,stars,total_stars:total(),transport_type:'beacon'});}catch(_){}}
function best(){try{const n=Number(localStorage.getItem('alice-rhythm-stars-v1-'+level));return Number.isInteger(n)&&n>=5&&n<=15?n:0;}catch(_){return 0;}}
function bestText(){return 'あなたのベスト：'+(best()?best()+' / 15 ★':'まだ記録がありません');}
function stop(){cancelAnimationFrame(frame);sources.forEach(o=>{try{o.stop();}catch(_){}});sources=[];}
async function prepare(){try{const A=window.AudioContext||window.webkitAudioContext;if(A){if(!audio){audio=new A();gain=audio.createGain();gain.connect(audio.destination);}if(audio.state==='suspended')await Promise.race([audio.resume(),new Promise(r=>setTimeout(r,400))]);gain.gain.value=sound?1:0;}}catch(_){}roundClock=audio?.state==='running'?()=>audio.currentTime:()=>performance.now()/1000;}
let noiseBuffer;
function ensureNoiseBuffer(){
 if(!audio||noiseBuffer)return;
 const len=Math.max(1,Math.floor(audio.sampleRate*.09));
 noiseBuffer=audio.createBuffer(1,len,audio.sampleRate);
 const data=noiseBuffer.getChannelData(0);
 for(let i=0;i<len;i++){
   const env=Math.pow(1-i/len,2.4);
   data[i]=(Math.random()*2-1)*env;
 }
}
function tone(time,quiet=false,accent=false){
 if(!sound||audio?.state!=='running')return;
 try{
   if(quiet){
     const o=audio.createOscillator(),g=audio.createGain();
     o.type='square';
     o.frequency.setValueAtTime(accent?1450:1080,time);
     o.frequency.exponentialRampToValueAtTime(accent?1050:780,time+.045);
     g.gain.setValueAtTime(0,time);
     g.gain.linearRampToValueAtTime(accent?.07:.035,time+.003);
     g.gain.exponentialRampToValueAtTime(.0001,time+.07);
     o.connect(g);g.connect(gain);o.start(time);o.stop(time+.075);
     o.onended=()=>{o.disconnect();g.disconnect();};
     sources.push(o);
     return;
   }
   ensureNoiseBuffer();
   const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),ng=audio.createGain();
   src.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.value=1450;filter.Q.value=.75;
   ng.gain.setValueAtTime(0,time);
   ng.gain.linearRampToValueAtTime(.24,time+.004);
   ng.gain.exponentialRampToValueAtTime(.0001,time+.105);
   src.connect(filter);filter.connect(ng);ng.connect(gain);src.start(time);src.stop(time+.11);
   src.onended=()=>{src.disconnect();filter.disconnect();ng.disconnect();};
   sources.push(src);

   const body=audio.createOscillator(),bg=audio.createGain();
   body.type='triangle';
   body.frequency.setValueAtTime(260,time);
   body.frequency.exponentialRampToValueAtTime(150,time+.08);
   bg.gain.setValueAtTime(0,time);
   bg.gain.linearRampToValueAtTime(.12,time+.004);
   bg.gain.exponentialRampToValueAtTime(.0001,time+.11);
   body.connect(bg);bg.connect(gain);body.start(time);body.stop(time+.12);
   body.onended=()=>{body.disconnect();bg.disconnect();};
   sources.push(body);
 }catch(_){}
}
function show(id){['setup','play','result'].forEach(n=>$(n).hidden=n!==id);}
function icons(v){const paths=v==='タン'?'<ellipse cx="14" cy="32" rx="7" ry="5"/><path d="M20 32V6" stroke="currentColor" stroke-width="3"/>':v==='タタ'?'<ellipse cx="9" cy="32" rx="6" ry="4"/><ellipse cx="28" cy="29" rx="6" ry="4"/><path d="M14 32V9L33 6V29M14 9L33 6" fill="none" stroke="currentColor" stroke-width="4"/>':'<path d="M12 20H28" stroke="currentColor" stroke-width="4"/><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2"/>';return '<svg viewBox="0 0 40 42" aria-hidden="true" fill="currentColor">'+paths+'</svg>';}
function resetRound(){stop();state='ready';heard=false;taps=[];$('round-result').hidden=true;$('listen').disabled=false;$('listen').classList.add('primary');$('imitate').disabled=true;$('imitate').classList.remove('primary','next-action');$('tap').disabled=true;$('tap').classList.remove('ready');$('countdown').hidden=true;$('status').textContent='① まず「おてほんをきく」を押してね♪';$('round-title').textContent='リズム '+(round+1)+' / 5';$('beats').innerHTML=settings[level].patterns[round].map((v,i)=>'<div class="beat">'+icons(v)+'<strong>'+v+'</strong><small>'+(i+1)+'拍め</small></div>').join('');$('progress').innerHTML=Array.from({length:5},(_,i)=>'<span class="'+(i<round?'done':i===round?'current':'')+'"></span>').join('');$('progress').setAttribute('aria-label',(round+1)+' / 5 ラウンド');}
function start(){stop();round=0;scores=[];show('play');resetRound();track('rhythm_game_start');}
function tick(){const t=roundClock()-origin,b=beatSeconds();
 if(state==='demo'){$('status').textContent='① おてほんをきいてね♪';if(t>=duration){state='ready';heard=true;$('listen').disabled=false;$('listen').classList.remove('primary');$('imitate').disabled=false;$('imitate').classList.add('primary','next-action');$('status').textContent='② 次は「まねしてみる」を押してね♪';}}
 if(state==='count'||state==='input'){
   if(t<0){
     const count=Math.min(4,Math.max(1,Math.floor((t+4*b)/b)+1));
     $('countdown').hidden=false;$('countdown-label').textContent=String(count);$('countdown-help').textContent='4の次からスタート！';
     $('status').textContent='② カウント中。まだ押さなくて大丈夫♪';
     $('tap').disabled=true;$('tap').classList.remove('ready');
   }else{
     state='input';$('tap').disabled=false;
     if(t<Math.min(.6,b*.7)){
       $('countdown').hidden=false;$('countdown-label').textContent='スタート！';$('countdown-help').textContent='③ リズムに合わせて「たたく！」';
       $('tap').classList.add('ready');
     }else{
       $('countdown').hidden=true;$('tap').classList.remove('ready');
     }
     $('status').textContent=t<b?'③ スタート！ いまからたたいてね♪':(Math.min(4,Math.floor(t/b)+1))+'拍め';
   }
   if(t>=duration+settings[level].tolerance){finishRound();return;}
 }
 [...$('beats').children].forEach((el,i)=>{el.classList.toggle('active',t>=i*b&&t<(i+1)*b&&(state==='demo'||state==='input'));el.classList.toggle('pulse',state==='demo'&&expected().some(e=>Math.abs(t-e)<.1)&&t>=i*b&&t<(i+1)*b);});
 if(['demo','count','input'].includes(state))frame=requestAnimationFrame(tick);
}
async function launch(demo){if(state!=='ready'||(!demo&&!heard))return;state='loading';$('listen').disabled=true;$('imitate').disabled=true;$('imitate').classList.remove('next-action');await prepare();if(state!=='loading')return;stop();taps=[];const b=beatSeconds();duration=4*b;origin=roundClock()+.15+(demo?0:4*b);state=demo?'demo':'count';if(!demo){$('tap').scrollIntoView({block:'center',behavior:'auto'});$('countdown').hidden=false;$('countdown-label').textContent='1';$('countdown-help').textContent='4の次からスタート！';}if(demo)expected().forEach(t=>tone(origin+t));else{for(let i=-4;i<0;i++)tone(origin+i*b,true,i===-4);for(let i=0;i<4;i++)tone(origin+i*b,true,false);}frame=requestAnimationFrame(tick);}
// Greedy nearest unused tap within tolerance; no input can satisfy two notes.
function judge(wanted,actual,tolerance){const used=new Set(),deltas=[];let hits=0;for(const e of wanted){let bestIndex=-1,delta=Infinity;actual.forEach((t,i)=>{if(!used.has(i)&&Math.abs(t-e)<delta){delta=Math.abs(t-e);bestIndex=i;}});if(bestIndex>=0&&delta<=tolerance){used.add(bestIndex);hits++;deltas.push(delta);}}const missing=wanted.length-hits,extra=actual.length-hits;const quality=hits/Math.max(wanted.length,actual.length,1);const averageDelta=hits?deltas.reduce((sum,delta)=>sum+delta,0)/hits:Infinity;return {hits,missing,extra,stars:quality>=.9&&averageDelta<=tolerance*.55?3:quality>=.65?2:1,quality,averageDelta};}
function finishRound(){state='round-result';stop();$('tap').disabled=true;$('tap').classList.remove('ready');$('countdown').hidden=true;[...$('beats').children].forEach(el=>el.classList.remove('active','pulse'));const result=judge(expected(),taps,settings[level].tolerance);scores[round]=result.stars;$('round-result').hidden=false;$('stars').textContent='★'.repeat(result.stars);$('stars').classList.toggle('celebrate',result.stars>=2);$('feedback').textContent=result.stars===3?'ぴったり！すごい♪':result.stars===2?'いい感じ！♪':result.quality>=.4?'おしい！もう一回やってみよう♪':'もう一度きいてみよう♪';$('status').textContent='このリズム、できたね♪';$('next').textContent=round===4?'結果を見る':'つぎへ';track('rhythm_game_round_complete',result.stars);}
function tap(){const t=roundClock()-origin;if(state!=='input'||t<0||t>duration+settings[level].tolerance)return;taps.push(t);tone(roundClock());}
$('tap').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();tap();});$('tap').addEventListener('click',e=>{if(e.detail===0)tap();});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&['count','input'].includes(state)){e.preventDefault();if(!e.repeat)tap();}});
$('listen').addEventListener('click',()=>launch(true));$('imitate').addEventListener('click',()=>launch(false));$('redo').addEventListener('click',resetRound);
$('next').addEventListener('click',()=>{if(state!=='round-result')return;if(round<4){round++;resetRound();return;}state='result';show('result');let updated=false,saved=true;try{if(total()>best()){localStorage.setItem('alice-rhythm-stars-v1-'+level,String(total()));updated=true;}}catch(_){saved=false;}$('total').textContent=total()+' / 15 ★';$('message').textContent=total()>=13?'リズム名人！♪':total()>=9?'とってもいいリズム！♪':'その調子！またやってみよう♪';$('best').textContent=bestText()+(updated?' ベスト記録更新！':'')+(saved?'':'（このブラウザでは保存できませんでした）');$('result-title').focus();track('rhythm_game_complete');if(total()===15)track('rhythm_game_perfect');});
document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{level=b.dataset.level;start();}));$('retry').addEventListener('click',start);$('change').addEventListener('click',()=>{state='setup';show('setup');setupBest();});$('other').addEventListener('click',()=>track('rhythm_game_other_game_click'));$('sound').addEventListener('click',()=>{sound=!sound;if(gain)gain.gain.value=sound?1:0;$('sound').textContent='音：'+(sound?'オン':'オフ');$('sound').setAttribute('aria-pressed',String(sound));});
function setupBest(){const old=level;$('setup-best').textContent=Object.keys(settings).map(l=>{level=l;return settings[l].label+'：'+(best()?best()+' / 15 ★':'まだ記録がありません');}).join(' ／ ');level=old;}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['demo','count','input','loading'].includes(state)){resetRound();$('status').textContent='もう一度おてほんから始めよう♪';}});setupBest();
})();
