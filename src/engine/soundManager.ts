/**
 * 프로시저럴 사운드 매니저 — Web Audio API 기반
 * 에셋 없이 OscillatorNode + GainNode 조합으로 효과음 생성
 */

let ctx: AudioContext | null = null;
let muted = false;
let volume = 0.5;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

/** iOS 첫 터치 시 AudioContext resume (한 번만) */
export function ensureAudioResumed() {
  const c = getCtx();
  if (c.state === "suspended") {
    c.resume();
  }
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
}

export function getVolume(): number {
  return volume;
}

// ─── 유틸 ───

function makeGain(c: AudioContext, vol: number): GainNode {
  const g = c.createGain();
  g.gain.value = vol * volume;
  g.connect(c.destination);
  return g;
}

function noise(c: AudioContext, duration: number, gain: GainNode) {
  const len = c.sampleRate * duration;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(gain);
  src.start(c.currentTime);
  src.stop(c.currentTime + duration);
}

function osc(
  c: AudioContext,
  type: OscillatorType,
  freq: number,
  duration: number,
  gain: GainNode,
  freqEnd?: number,
) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd !== undefined) {
    o.frequency.linearRampToValueAtTime(freqEnd, c.currentTime + duration);
  }
  o.connect(gain);
  o.start(c.currentTime);
  o.stop(c.currentTime + duration);
}

function envelope(g: GainNode, attack: number, decay: number, peak: number) {
  const c = g.context as AudioContext;
  const now = c.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak * volume, now + attack);
  g.gain.linearRampToValueAtTime(0, now + attack + decay);
}

// ─── 효과음 ───

/** 주먹 — 짧은 노이즈 버스트 (50ms, 저주파 느낌) */
export function punch() {
  if (muted) return;
  const c = getCtx();
  const g = makeGain(c, 0);
  envelope(g, 0.005, 0.045, 0.6);
  noise(c, 0.05, g);
  // 저음 펀치감
  const g2 = makeGain(c, 0);
  envelope(g2, 0.003, 0.04, 0.4);
  osc(c, "sine", 120, 0.05, g2, 60);
}

/** 킥 — 노이즈 + 저음 붐 (80ms) */
export function kick() {
  if (muted) return;
  const c = getCtx();
  const g = makeGain(c, 0);
  envelope(g, 0.005, 0.075, 0.5);
  noise(c, 0.08, g);
  // 무거운 붐
  const g2 = makeGain(c, 0);
  envelope(g2, 0.005, 0.08, 0.7);
  osc(c, "sine", 80, 0.1, g2, 35);
}

/** 크리티컬 — 펀치 + 고음 링 (100ms) */
export function critical() {
  if (muted) return;
  punch();
  const c = getCtx();
  // 고음 링
  const g = makeGain(c, 0);
  envelope(g, 0.005, 0.1, 0.35);
  osc(c, "triangle", 1200, 0.12, g, 800);
  // 추가 임팩트
  const g2 = makeGain(c, 0);
  envelope(g2, 0.002, 0.06, 0.5);
  osc(c, "sawtooth", 200, 0.08, g2, 100);
}

/** 적 처치 — 하강 톤 (200ms) */
export function enemyKo() {
  if (muted) return;
  const c = getCtx();
  const g = makeGain(c, 0);
  envelope(g, 0.01, 0.2, 0.5);
  osc(c, "square", 400, 0.25, g, 80);
  // 노이즈 테일
  const g2 = makeGain(c, 0);
  envelope(g2, 0.01, 0.15, 0.25);
  noise(c, 0.2, g2);
}

/** 보스 등장 — 저음 럼블 (500ms) */
export function bossAppear() {
  if (muted) return;
  const c = getCtx();
  const g = makeGain(c, 0);
  envelope(g, 0.05, 0.5, 0.6);
  osc(c, "sawtooth", 50, 0.55, g, 30);
  // 서브 럼블
  const g2 = makeGain(c, 0);
  envelope(g2, 0.1, 0.45, 0.4);
  osc(c, "sine", 40, 0.55, g2, 25);
  // 노이즈 레이어
  const g3 = makeGain(c, 0);
  envelope(g3, 0.05, 0.4, 0.2);
  noise(c, 0.5, g3);
}

/** 골드 획득 — 상승 차임 (150ms) */
export function goldPickup() {
  if (muted) return;
  const c = getCtx();
  const now = c.currentTime;
  // 2음 상승
  const g1 = makeGain(c, 0);
  g1.gain.setValueAtTime(0, now);
  g1.gain.linearRampToValueAtTime(0.3 * volume, now + 0.005);
  g1.gain.linearRampToValueAtTime(0, now + 0.08);
  osc(c, "triangle", 800, 0.08, g1);

  const g2 = makeGain(c, 0);
  g2.gain.setValueAtTime(0, now + 0.06);
  g2.gain.linearRampToValueAtTime(0.3 * volume, now + 0.065);
  g2.gain.linearRampToValueAtTime(0, now + 0.15);
  osc(c, "triangle", 1200, 0.1, g2);
}

/** 레벨업 / 클리어 — 팡파레 (300ms) */
export function levelUp() {
  if (muted) return;
  const c = getCtx();
  const now = c.currentTime;
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const g = makeGain(c, 0);
    const t = now + i * 0.07;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3 * volume, t + 0.005);
    g.gain.linearRampToValueAtTime(0, t + 0.12);
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    o.connect(g);
    o.start(t);
    o.stop(t + 0.12);
  });
}

/** 도구 파괴 — 쨍 소리 (200ms) */
export function toolBreak() {
  if (muted) return;
  const c = getCtx();
  const g = makeGain(c, 0);
  envelope(g, 0.003, 0.2, 0.6);
  noise(c, 0.2, g);
  // 금속 느낌 고음
  const g2 = makeGain(c, 0);
  envelope(g2, 0.005, 0.15, 0.35);
  osc(c, "square", 2000, 0.2, g2, 500);
  // 중음 크랙
  const g3 = makeGain(c, 0);
  envelope(g3, 0.003, 0.1, 0.4);
  osc(c, "sawtooth", 600, 0.15, g3, 200);
}

/** 강화 — 업그레이드 차임 (200ms) */
export function upgrade() {
  if (muted) return;
  const c = getCtx();
  const now = c.currentTime;
  // 상승 2음
  const g1 = makeGain(c, 0);
  g1.gain.setValueAtTime(0, now);
  g1.gain.linearRampToValueAtTime(0.3 * volume, now + 0.005);
  g1.gain.linearRampToValueAtTime(0, now + 0.1);
  osc(c, "sine", 440, 0.1, g1);

  const g2 = makeGain(c, 0);
  g2.gain.setValueAtTime(0, now + 0.08);
  g2.gain.linearRampToValueAtTime(0.35 * volume, now + 0.085);
  g2.gain.linearRampToValueAtTime(0, now + 0.2);
  osc(c, "sine", 660, 0.15, g2);
  // 반짝임
  const g3 = makeGain(c, 0);
  g3.gain.setValueAtTime(0, now + 0.1);
  g3.gain.linearRampToValueAtTime(0.15 * volume, now + 0.105);
  g3.gain.linearRampToValueAtTime(0, now + 0.2);
  osc(c, "triangle", 1320, 0.12, g3);
}
