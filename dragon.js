/* Ember the dragon — an original character for RoboAshr.
   Uses the front camera: a hand reaching toward the screen shows up as a big, sudden change in the
   picture, and an on-device face detector (MediaPipe, nothing uploaded) tells whether you are
   looking at Ember or have turned your head away. Touching the screen counts as a hand too.

   Modes:
   - Training: Ember snarls at a reaching hand. Keep your hand there and look away; it calms down,
     gets curious, then closes its eyes and leans in to touch your hand. Each success builds trust.
   - Protective: Ember guards you. Sudden movement gets a roar and a burst of fire; if you leave,
     it looks for you.
   - Cute: big round eyes, purring, wants pets, and its eyes follow your face. */
(() => {
  'use strict';
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  const DNAME = (qs.get('dragon') || 'Ember').trim();
  const REACH_T = parseFloat(qs.get('reach')) || 0.12;   // share of the picture that changes when a hand comes close
  const STILL_T = 0.05;

  let mode = 'training';
  let trust = 0;                       // 0..100, earned in training mode
  const S = { snarl: 0, growl: 0, purr: 0, round: .45, closed: 0, lean: 0, flare: .15, tilt: 0, lookX: 0, lookY: 0,
              happy: 0, blush: 0, touch: 0, fire: 0, sad: 0, bob: 0 };
  const T = Object.assign({}, S);
  let stage = 'idle', stageT = 0, awayT = 0, backT = 0;
  let touching = false, touchStart = false, petUntil = 0, missing = false, lastFaceAt = 0, lastRoarAt = -99, nextIdleAct = 0;
  let wasAsleep = false, blinkAt = 3, running = false, lastT = 0;
  let lastSample = null, baseMean = null, reachStreak = 0, reachFlag = false;
  const seen = { present: false, facing: false, x: .5, y: .5, at: 0 };

  /* ---------- face detection (MediaPipe, on the device) ---------- */
  let fdet = null, fdetLoading = false, fdetFailed = false, lastDet = 0;
  async function loadFaceDetector() {
    if (fdet || fdetLoading || fdetFailed || !camOk) return;
    fdetLoading = true;
    try {
      const vision = await import(MP + '/vision_bundle.mjs');
      const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
      fdet = await vision.FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5
      });
    } catch (e) {
      fdetFailed = true;
    }
    fdetLoading = false;
  }
  function detectFace(now) {
    if (!fdet || !camVideo || camVideo.readyState < 2 || now - lastDet < 180) return;
    lastDet = now;
    let res;
    try { res = fdet.detectForVideo(camVideo, now); } catch (e) { return; }
    let best = null;
    for (const d of (res && res.detections) || []) {
      if (!best || d.categories[0].score > best.categories[0].score) best = d;
    }
    if (!best) { seen.present = false; seen.facing = false; return; }
    const kp = best.keypoints || [];
    let yaw = 0;   // nose left/right of the middle of the eyes = head turned
    if (kp.length >= 3) {
      const mid = (kp[0].x + kp[1].x) / 2, eyes = Math.abs(kp[1].x - kp[0].x) || 0.001;
      yaw = (kp[2].x - mid) / eyes;
    }
    seen.present = true;
    seen.facing = best.categories[0].score > 0.55 && Math.abs(yaw) < 0.38;
    const bb = best.boundingBox, vw = camVideo.videoWidth || 160, vh = camVideo.videoHeight || 120;
    if (bb) { seen.x = (bb.originX + bb.width / 2) / vw; seen.y = (bb.originY + bb.height / 2) / vh; }
    seen.at = now;
  }

  /* ---------- hand reaching toward the screen ---------- */
  function sampleReach() {
    if (!camOk || !prevFrame || prevFrame === lastSample) return;
    lastSample = prevFrame;
    const mean = prevFrame.mean;
    if (baseMean === null) baseMean = mean;
    const cover = baseMean > 20 ? 1 - mean / baseMean : 0;   // a hand close to the camera darkens it
    const big = motionLevel > REACH_T || cover > 0.35;
    if (!big && motionLevel < 0.03) baseMean = baseMean * 0.9 + mean * 0.1;
    reachStreak = big ? reachStreak + 1 : 0;
    if (reachStreak >= 2) reachFlag = true;
  }
  const still = () => !camOk || motionLevel < STILL_T;
  // looking away: the face detector says so; without it, holding still is the best we can do
  const lookingAway = () => fdet ? (!seen.present || !seen.facing) : (camOk ? still() : touching);

  /* ---------- sounds ---------- */
  let audio = null;
  function startAudio() {
    if (!ac || audio) return;
    const now = ac.currentTime;
    // growl: two low saws + rumble noise, shaken by a fast tremolo
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 4;
    const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 62;
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 65;
    const nz = ac.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true;
    const nzg = ac.createGain(); nzg.gain.value = .5;
    const trem = ac.createGain(); trem.gain.value = .6;
    const lfo = ac.createOscillator(); lfo.frequency.value = 13;
    const lfoG = ac.createGain(); lfoG.gain.value = .4;
    const g = ac.createGain(); g.gain.value = 0;
    o1.connect(lp); o2.connect(lp); nz.connect(nzg); nzg.connect(lp);
    lfo.connect(lfoG); lfoG.connect(trem.gain);
    lp.connect(trem); trem.connect(g); g.connect(sfxBus);
    // purr: low rumbling noise pulsing ~26 times a second
    const pz = ac.createBufferSource(); pz.buffer = noiseBuf; pz.loop = true;
    const plp = ac.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 180;
    const ptrem = ac.createGain(); ptrem.gain.value = .5;
    const plfo = ac.createOscillator(); plfo.frequency.value = 26;
    const plfoG = ac.createGain(); plfoG.gain.value = .5;
    const pg = ac.createGain(); pg.gain.value = 0;
    pz.connect(plp); plp.connect(ptrem); plfo.connect(plfoG); plfoG.connect(ptrem.gain); ptrem.connect(pg); pg.connect(sfxBus);
    const srcs = [o1, o2, nz, lfo, pz, plfo];
    srcs.forEach(s => s.start(now));
    audio = { g, pg, srcs };
  }
  function stopAudio() {
    if (!audio) return;
    audio.srcs.forEach(s => { try { s.stop(); } catch (e) {} });
    audio.g.disconnect(); audio.pg.disconnect();
    audio = null;
  }
  const snd = {
    chirp() { tone(900, .1, { type: 'sine', vol: .12, slide: 1500 }); tone(1100, .12, { type: 'sine', vol: .1, slide: 1800, delay: .12 }); },
    snort() { noise(.25, { vol: .25, hp: 400 }); tone(120, .2, { type: 'sawtooth', vol: .06, slide: 80 }); },
    roar() {
      tone(170, 1.3, { type: 'sawtooth', vol: .18, slide: 60 });
      tone(120, 1.3, { type: 'square', vol: .08, slide: 50 });
      noise(1.2, { vol: .25, hp: 200 });
      noise(.9, { vol: .16, hp: 1500, delay: .3 });
    },
    whimper() { tone(800, .35, { type: 'sine', vol: .08, slide: 520 }); tone(700, .4, { type: 'sine', vol: .07, slide: 450, delay: .4 }); },
    sparkle() { [1568, 2093, 2637].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .05, delay: i * .06 })); }
  };

  /* ---------- little effects ---------- */
  function hearts(n, emoji) {
    const fx = $('dFx');
    for (let i = 0; i < n; i++) {
      const h = el('text', { x: rand(110, 290), y: rand(150, 260), 'font-size': rand(22, 36), 'text-anchor': 'middle' }, fx);
      h.textContent = emoji || pick(['💚', '💙', '💛']);
      const a = h.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${rand(-30, 30)}px,${rand(-140, -90)}px)`, opacity: 0 }],
        { duration: rand(1200, 2000), delay: i * 120, easing: 'ease-out', fill: 'backwards' });
      a.onfinish = () => h.remove();
    }
  }
  function setHint(t) {
    if (dragonHint !== t) { dragonHint = t; updateBubble(); }
  }
  function go(s) { stage = s; stageT = 0; if (s !== 'calming') backT = 0; }

  /* ---------- the three modes ---------- */
  function trainingMode(t, dt, reached) {
    const away = lookingAway();
    const friend = trust >= 100;
    T.lookX = seen.present ? (0.5 - seen.x) * 2 : Math.sin(t * 0.6) * 0.4;
    T.lookY = seen.present ? (seen.y - 0.5) : 0;
    switch (stage) {
      case 'idle':
        Object.assign(T, { snarl: 0, growl: 0, purr: friend ? .15 : 0, round: friend ? .8 : .45, flare: .15, happy: friend ? .5 : 0, tilt: 0 });
        setHint(friend ? `${DNAME} trusts you! Reach out to say hi 🖐️` : `Slowly reach your hand toward ${DNAME}… 🖐️`);
        if (reached || touchStart) { snd.snort(); awayT = 0; go('snarl'); }
        break;
      case 'snarl':
        T.snarl = friend ? .35 : 1; T.growl = T.snarl; T.round = .05; T.flare = .6; T.happy = 0; T.purr = 0; T.tilt = 0;
        T.lookX = 0; T.lookY = 0;
        setHint(friend ? `${DNAME} is a little startled… ${fdet ? 'look away 👀' : 'stay still…'}`
                       : fdet ? `Grrr! ${DNAME} doesn't trust you yet… keep your hand there and turn your head away 👀`
                              : `Grrr! ${DNAME} doesn't trust you yet… keep your hand there and stay very still…`);
        if (away && (still() || touching)) awayT += dt; else awayT = Math.max(0, awayT - dt * 2);
        if (awayT > (friend ? .4 : 1.2)) { snd.chirp(); go('calming'); }
        else if (stageT > 14 && !touching) go('idle');
        break;
      case 'calming':
        Object.assign(T, { snarl: 0, growl: 0, round: .7, tilt: 12, flare: .2, lookX: 0, lookY: .3 });
        setHint(fdet ? `Shh… ${DNAME} is curious… keep looking away…` : `Shh… ${DNAME} is curious… stay still…`);
        if (reached && !touching) { snd.snort(); awayT = 0; go('snarl'); break; }   // sudden move: scared again
        if (!away) { backT += dt; if (backT > .4) { snd.snort(); awayT = 0; go('snarl'); } break; }
        backT = 0;
        awayT += dt;
        if (awayT > (friend ? 1.2 : 3)) { snd.sparkle(); go('trust'); }
        break;
      case 'trust':   // eyes closed, leaning in to touch your hand
        Object.assign(T, { closed: 1, lean: 1, touch: 1, purr: .7, round: .8, tilt: 0, lookX: 0, lookY: 0 });
        setHint(`✨ ${DNAME} is touching your hand…`);
        if (stageT > 2.8) {
          trust = Math.min(100, trust + 34);
          hearts(8); snd.chirp();
          go('friends');
        }
        break;
      case 'friends':
        Object.assign(T, { closed: 0, lean: .2, touch: 0, happy: 1, purr: .35, round: 1, blush: .6 });
        setHint(trust >= 100 ? `💚 ${DNAME} trusts you completely! You trained your dragon!`
                             : `💚 ${DNAME} trusts you a little more! Try again 🖐️`);
        if (stageT > 5) { T.blush = 0; go('idle'); }
        break;
    }
  }

  function protectiveMode(t, dt, reached) {
    Object.assign(T, { flare: .35, round: .35, snarl: 0, growl: 0, fire: 0, happy: 0, blush: 0, closed: 0, lean: 0, tilt: 0 });
    if (seen.present) {
      lastFaceAt = t;
      T.lookX = (0.5 - seen.x) * 1.2; T.lookY = (seen.y - 0.5) * .8; T.purr = .12; T.sad = 0;
      if (missing) { missing = false; snd.chirp(); hearts(4); }
      setHint(`${DNAME} is guarding you 🛡️`);
    } else {
      T.lookX = Math.sin(t * 1.3); T.lookY = -.2; T.purr = 0;
      if (fdet && t - lastFaceAt > 3) {
        if (!missing) { missing = true; snd.whimper(); }
        T.sad = .6;
        setHint(`${DNAME} is looking for you… where did you go?`);
      } else setHint(`${DNAME} is on guard 🛡️`);
    }
    if ((reached || touchStart) && t - lastRoarAt > 4) {
      lastRoarAt = t;
      snd.roar();
      setHint(`ROAR! 🔥 ${DNAME} is protecting you!`);
    }
    const since = t - lastRoarAt;
    if (since < 1.8) {
      setHint(`ROAR! 🔥 ${DNAME} is protecting you!`);
      T.snarl = 1; T.flare = 1; T.round = 0; T.sad = 0; T.lookX = 0;
      T.fire = since > .25 && since < 1.3 ? 1 : 0;
    } else if (since < 3.2) {
      setHint('All clear! 💚');
    }
  }

  function cuteMode(t, dt, reached) {
    Object.assign(T, { round: 1, blush: .7, happy: .5, flare: .1, snarl: 0, growl: 0, fire: 0, bob: 1, closed: 0, lean: 0, touch: 0 });
    if (seen.present) {
      lastFaceAt = t;
      T.lookX = (0.5 - seen.x) * 2; T.lookY = (seen.y - 0.5) * 1.5; T.sad = 0;
      if (missing) { missing = false; snd.chirp(); setTimeout(snd.chirp, 200); setTimeout(snd.chirp, 400); hearts(6); }
    } else {
      T.lookX = Math.sin(t * .8) * .6;
      if (fdet && t - lastFaceAt > 3) { if (!missing) { missing = true; snd.whimper(); } T.sad = .5; T.happy = 0; }
    }
    if (reached || touching) {
      if (t > petUntil) hearts(3, '💕');
      petUntil = t + 2.5;
    }
    if (t < petUntil) {
      Object.assign(T, { closed: .85, lean: .5, purr: .8, happy: 1, tilt: 8 });
      setHint('Purrrr… 💕');
    } else {
      T.purr = .12;
      setHint(missing ? `${DNAME} misses you… come back! 🥺` : `${DNAME} wants pets! Reach out 🖐️`);
      if (t > nextIdleAct) {   // little random cute things
        nextIdleAct = t + rand(6, 12);
        const act = pick(['tilt', 'chirp', 'sneeze']);
        if (act === 'tilt') { T.tilt = pick([-14, 14]); snd.chirp(); setTimeout(() => { T.tilt = 0; }, 1500); }
        else if (act === 'chirp') { snd.chirp(); hearts(1, '💙'); }
        else { snd.snort(); snd.sparkle(); hearts(4, '✨'); }
      }
    }
  }

  /* ---------- drawing ---------- */
  const at = id => document.getElementById(id);
  function render(t) {
    const bob = Math.sin(t * 3) * S.bob * 5 + Math.sin(t * 1.6) * 2;
    const down = S.lean * 40 + S.snarl * 14 + (asleep ? 30 : 0);
    const sc = 1 + S.lean * .35 - S.snarl * .03;
    at('dHead').setAttribute('transform',
      `translate(200,${(250 + down + bob).toFixed(1)}) rotate(${(S.tilt + Math.sin(t * .7) * 2).toFixed(1)}) scale(${sc.toFixed(3)}) translate(-200,-250)`);
    // cat eyes: thin slits when angry, big round pupils when happy or curious
    const rx = Math.max(1.6, 3.5 + S.round * 14 + S.happy * 3 - S.snarl * 2).toFixed(1);
    at('dPupilL').setAttribute('rx', rx); at('dPupilR').setAttribute('rx', rx);
    const lx = (S.lookX * 12).toFixed(1), ly = (S.lookY * 9).toFixed(1);
    at('dIrisL').setAttribute('transform', `translate(${lx},${ly})`);
    at('dIrisR').setAttribute('transform', `translate(${(-S.lookX * 12).toFixed(1)},${ly})`);
    if (t > blinkAt) blinkAt = t + rand(2.5, 6);
    const blink = (blinkAt - t) > 0 && (blinkAt - t) < 0.14 ? 1 : 0;
    const lid = asleep ? 84 : Math.min(84, Math.max(S.closed * 84, blink * 84) + S.snarl * 20);
    at('dLidL').setAttribute('height', lid.toFixed(1)); at('dLidR').setAttribute('height', lid.toFixed(1));
    const low = (S.happy * 12).toFixed(1);
    for (const id of ['dLowL', 'dLowR']) { at(id).setAttribute('y', (40 - low).toFixed(1)); at(id).setAttribute('height', low); }
    const brow = `rotate(${(S.snarl * 20 - S.sad * 14).toFixed(1)} 0 -40) translate(0,${(S.snarl * 6).toFixed(1)})`;
    at('dBrowL').setAttribute('transform', brow); at('dBrowR').setAttribute('transform', brow);
    const fr = -S.snarl * 32 + S.blush * 8 - S.sad * 22 + Math.sin(t * 2) * 2;
    at('dFrillL').setAttribute('transform', `rotate(${fr.toFixed(1)} 86 210)`);
    at('dFrillR').setAttribute('transform', `rotate(${(-fr).toFixed(1)} 314 210)`);
    at('dSnarl').setAttribute('opacity', S.snarl.toFixed(2));
    at('dMouth').setAttribute('opacity', (1 - S.snarl).toFixed(2));
    at('dNostrils').setAttribute('transform', `translate(200,252) scale(${(1 + S.snarl * .4).toFixed(2)}) translate(-200,-252)`);
    const wf = S.flare * 28 + Math.sin(t * 1.4) * 2;
    at('dWingL').setAttribute('transform', `rotate(${(-wf).toFixed(1)} 152 410)`);
    at('dWingR').setAttribute('transform', `rotate(${wf.toFixed(1)} 248 410)`);
    at('dBlushL').setAttribute('opacity', S.blush.toFixed(2)); at('dBlushR').setAttribute('opacity', S.blush.toFixed(2));
    at('dTouch').setAttribute('opacity', (S.touch * (.65 + .35 * Math.sin(t * 4))).toFixed(2));
    const fire = at('dFire');
    fire.setAttribute('opacity', S.fire.toFixed(2));
    fire.setAttribute('transform', `translate(200,330) scale(${(.5 + S.fire * .8 + Math.sin(t * 30) * .05).toFixed(2)}) translate(-200,-330)`);
    document.body.classList.toggle('dsnarl', S.snarl > .6);
    // trust meter
    const f = $('fill');
    f.style.width = Math.max(2, trust) + '%';
    f.style.background = trust >= 100 ? '#5be37a' : '#4dd6e0';
    if (audio) {
      audio.g.gain.setTargetAtTime(asleep ? 0 : S.growl * .5, ac.currentTime, .06);
      audio.pg.gain.setTargetAtTime((asleep ? .08 : S.purr) * .6, ac.currentTime, .1);
    }
  }

  /* ---------- loop ---------- */
  function loop(now) {
    if (!dragonMode) { running = false; return; }
    const t = now / 1000, dt = Math.min(.1, (now - lastT) / 1000);
    lastT = now;
    stageT += dt;
    sampleReach();
    detectFace(now);
    const reached = reachFlag; reachFlag = false;
    const tapped = touchStart;
    if (asleep) {
      Object.assign(T, { snarl: 0, growl: 0, purr: .08, closed: 1, lean: 0, fire: 0, touch: 0, happy: 0, flare: .05, sad: 0 });
      wasAsleep = true;
    } else {
      if (wasAsleep) { wasAsleep = false; snd.chirp(); setTimeout(snd.chirp, 220); hearts(3); go('idle'); }
      if (!repairing) {
        if (mode === 'training') trainingMode(t, dt, reached);
        else if (mode === 'protective') protectiveMode(t, dt, reached);
        else cuteMode(t, dt, reached);
      }
    }
    const k = Math.min(1, dt * 6), kf = Math.min(1, dt * 12);
    for (const key in S) S[key] += (T[key] - S[key]) * (key === 'snarl' || key === 'growl' || key === 'fire' ? kf : k);
    if (tapped) touchStart = false;   // a new touch counts once
    render(t);
    if (qs.has('debug')) {
      window.dragonDebug = `${mode}/${stage} face:${fdet ? (seen.present ? (seen.facing ? 'facing' : 'turned') : 'none') : !camOk ? 'no camera' : fdetFailed ? 'failed' : 'loading'}` +
        ` move:${(motionLevel * 100).toFixed(0)}% away:${awayT.toFixed(1)}s trust:${trust}`;
    }
    requestAnimationFrame(loop);
  }

  /* ---------- switching ---------- */
  function setMode(m) {
    mode = m;
    go('idle'); missing = false; petUntil = 0; T.tilt = 0; T.sad = 0;
    ['dTrainBtn', 'dProtectBtn', 'dCuteBtn'].forEach(id => $(id).classList.toggle('on',
      (id === 'dTrainBtn' && m === 'training') || (id === 'dProtectBtn' && m === 'protective') || (id === 'dCuteBtn' && m === 'cute')));
    document.body.dataset.dmode = m;
    snd.chirp();
  }
  function enter() {
    if (dragonMode || !awake) return;
    dragonMode = true;
    stopTalking(); speaking = false;
    if (awaiting) { clearTimeout(awaiting.timer); awaiting = null; }
    if (pending) { clearTimeout(pending.timer); pending = null; }
    recording = false; chunks = [];
    if (scary) { scary = false; document.body.classList.remove('scary'); }
    document.body.classList.add('dragon');
    document.querySelector('#meter .ico').textContent = '💚';
    lastFaceAt = performance.now() / 1000;
    startAudio();
    loadFaceDetector();
    setMode(mode);
    hearts(3);
    lastT = performance.now();
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function exit() {
    if (!dragonMode) return;
    dragonMode = false;
    stopAudio();
    document.body.classList.remove('dragon', 'dsnarl');
    document.querySelector('#meter .ico').textContent = '🧠';
    dragonHint = '';
    lastTalk = performance.now();
    happyUntil = secs() + 2;
    sfx.boot();
    updateBubble();
  }

  const svg = $('dragon');
  svg.addEventListener('pointerdown', e => { e.preventDefault(); touching = true; touchStart = true; noteActivity(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => svg.addEventListener(ev, () => { touching = false; }));
  $('dragonBtn').addEventListener('click', () => { if (awake && !repairing) { if (asleep) noteActivity(); enter(); } });
  $('robotBtn').addEventListener('click', () => exit());
  $('dTrainBtn').addEventListener('click', () => { noteActivity(); setMode('training'); });
  $('dProtectBtn').addEventListener('click', () => { noteActivity(); setMode('protective'); });
  $('dCuteBtn').addEventListener('click', () => { noteActivity(); setMode('cute'); });

  // for testing (and the debug page)
  window.dragon = {
    enter, exit, setMode, seen,
    get stage() { return stage; }, get mode() { return mode; }, get trust() { return trust; },
    set trust(v) { trust = v; }, get faceReady() { return !!fdet; }, get faceFailed() { return fdetFailed; },
    reach() { reachFlag = true; }, S
  };
})();
