(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const names = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ'];
  // Diatonic steps from middle C. Treble staff bottom line E4=130,
  // G4=110, B4=90, D5=70, top line F5=50. Middle C4 ledger=150.
  const pitches = [
    {step:0,midi:60}, {step:1,midi:62}, {step:2,midi:64},
    {step:3,midi:65}, {step:4,midi:67}, {step:5,midi:69},
    {step:6,midi:71}, {step:7,midi:72}, {step:8,midi:74},
    {step:9,midi:76}, {step:10,midi:77}
  ];
  const levels = {beginner:{label:'はじめて',count:6},challenge:{label:'ちょっと挑戦',count:11}};
  const buttons = [...document.querySelectorAll('[data-answer]')];
  let level = 'beginner', questions = [], index = 0, score = 0;
  let mistaken = false, locked = true, started = 0, elapsed = 0, interval;
  let sound = true, audio;
  function track(event) {
    if (location.protocol !== 'https:' || !['alicepiano-komatsu.com','www.alicepiano-komatsu.com'].includes(location.hostname)) return;
    try { if (typeof window.gtag === 'function') window.gtag('event', event, {
      send_to:'G-1B9Q314H3W',difficulty:level,score,time_seconds:Number(elapsed.toFixed(2)),transport_type:'beacon'
    }); } catch (_) { /* Analytics must never block play. */ }
  }
  function best() {
    try { const n = Number(localStorage.getItem('alice-note-best-v1-' + level)); return Number.isFinite(n) && n > 0 ? n : null; }
    catch (_) { return null; }
  }
  function bestText() { const n = best(); return levels[level].label + 'のベスト：' + (n === null ? 'まだ記録がありません' : n.toFixed(1) + ' 秒'); }
  function setupBest() {
    const previous = level;
    $('setup-best').textContent = Object.keys(levels).map(l => {level=l;return bestText();}).join(' ／ ');
    level=previous;
  }
  function shuffle(list) {
    for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
    return list;
  }
  function makeQuestions() {
    // Shuffled bags: each pitch appears at most twice; avoid adjacent same names.
    const out=[];
    while(out.length<10){
      const bag=shuffle(pitches.slice(0,levels[level].count));
      while(bag.length && out.length<10){
        const last=out[out.length-1];
        let pos=bag.findIndex(n=>!last || n.step%7!==last.step%7);
        if(pos<0) pos=0;
        out.push(bag.splice(pos,1)[0]);
      }
    }
    return out;
  }
  function show(section) { ['setup','play','result'].forEach(id=>{$(id).hidden=id!==section;}); }
  function updateProgress(completed) {
    $('progress').setAttribute('aria-valuenow',String(completed));
    [...$('progress').children].forEach((dot,i)=>{
      dot.classList.toggle('done',i<completed);
      dot.classList.toggle('current',i===completed && completed<10);
    });
  }
  function unlockAudio() {
    if(!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if(!Audio) return;
      if(!audio) audio=new Audio();
      if(audio.state==='suspended') audio.resume().catch(()=>{});
    } catch (_) { /* Silent play remains available. */ }
  }
  function playTone(midi) {
    if(!sound) return;
    try {
      unlockAudio();
      if(!audio || audio.state!=='running') return;
      const t=audio.currentTime, frequency=440*Math.pow(2,(midi-69)/12);
      // Fast attack and decaying harmonics approximate a soft piano tone.
      [1,2,3,4].forEach((harmonic,i)=>{
        const osc=audio.createOscillator(),gain=audio.createGain();
        osc.type='sine'; osc.frequency.value=frequency*harmonic;
        gain.gain.setValueAtTime(0,t);
        gain.gain.linearRampToValueAtTime(.18/[1,3,6,10][i],t+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,t+(.85-i*.12));
        osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+1);
        osc.onended=()=>{osc.disconnect();gain.disconnect();};
      });
    } catch (_) { /* Audio failures do not affect scoring or progress. */ }
  }
  function renderQuestion() {
    mistaken=false;locked=false;
    const pitch=questions[index], y=150-pitch.step*10, down=pitch.step>=6;
    $('note').innerHTML=(pitch.step===0?'<path d="M196 150H244" stroke="currentColor" stroke-width="1.5"/>':'')+
      '<ellipse cx="220" cy="'+y+'" rx="12" ry="8" transform="rotate(-18 220 '+y+')" fill="currentColor"/>'+
      '<path d="M'+(down?209:231)+' '+y+'v'+(down?60:-60)+'" stroke="currentColor" stroke-width="2"/>';
    $('question').textContent=(index+1)+' / 10';
    $('score').textContent=score+' / 10';
    $('feedback').textContent='音名を選んでね';
    $('feedback').classList.remove('is-correct');
    updateProgress(index);
    buttons.forEach(b=>{b.disabled=false;});
  }
  function start() {
    clearInterval(interval);unlockAudio();questions=makeQuestions();index=0;score=0;elapsed=0;
    show('play');renderQuestion();$('play-best').textContent=bestText();$('timer').textContent='0.0';
    started=performance.now();
    interval=setInterval(()=>{$('timer').textContent=((performance.now()-started)/1000).toFixed(1);},100);
    track('note_game_start');buttons[0].focus({preventScroll:true});
  }
  function finish() {
    let saved=true, newBest=false;
    if(score===10){
      const old=best();
      if(old===null || elapsed<old){try{localStorage.setItem('alice-note-best-v1-'+level,String(elapsed));newBest=true;}catch(_){saved=false;}}
    }
    $('result-score').textContent=score;$('result-time').textContent=elapsed.toFixed(1);
    $('result-message').textContent=score===10?'パーフェクト！ 🎵':'最後までよくがんばりました！ また気軽に挑戦してね。';
    $('new-best').hidden=!newBest;
    $('result-best').textContent=bestText()+(saved?'':'（このブラウザでは記録を保存できませんでした）');
    show('result');$('result-title').focus({preventScroll:true});
    track('note_game_complete');if(score===10)track('note_game_perfect');
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{
    if(locked) return;
    unlockAudio();
    const pitch=questions[index];
    if(Number(button.dataset.answer)!==pitch.step%7){mistaken=true;$('feedback').textContent='もう一度考えてみよう';return;}
    locked=true;if(!mistaken)score++;
    $('score').textContent=score+' / 10';$('feedback').textContent=['正解！','やったね♪','その調子！'][index%3]+' '+names[pitch.step%7]+'だね♪';
    $('feedback').classList.add('is-correct');updateProgress(index+1);
    buttons.forEach(b=>{b.disabled=true;});playTone(pitch.midi);
    if(index===9){elapsed=(performance.now()-started)/1000;clearInterval(interval);$('timer').textContent=elapsed.toFixed(1);}
    setTimeout(()=>{if(index===9)finish();else{index++;renderQuestion();buttons[0].focus({preventScroll:true});}},550);
  }));
  document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{level=b.dataset.level;start();}));
  $('retry').addEventListener('click',start);
  $('change-level').addEventListener('click',()=>{show('setup');setupBest();$('setup-title').focus({preventScroll:true});});
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent='音：'+(sound?'オン':'オフ');$('sound').setAttribute('aria-pressed',String(sound));if(sound)unlockAudio();});
  $('lesson-link').addEventListener('click',()=>track('note_game_lesson_click'));
  setupBest();
})();
