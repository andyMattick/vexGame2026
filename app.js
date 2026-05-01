/* ────────────────────────────────────────────────────────────────
   VEX Override Live Scorer — App Logic
   ──────────────────────────────────────────────────────────────── */

'use strict';

// ── Constants ──────────────────────────────────────────────────────
const MATCH_DURATION  = 120; // 2:00 total
const AUTON_DURATION  = 15;  // first 15 seconds = Autonomous Period

// ── State ──────────────────────────────────────────────────────────
const state = {
  timeRemaining: MATCH_DURATION,
  timerInterval: null,
  matchPhase: 'pre',       // 'pre' | 'auton' | 'driver' | 'ended'
  autonWinner: 'none',     // 'red' | 'blue' | 'tie' | 'none'

  // toggles[i]: 'yellow' (neutral) | 'red' | 'blue'
  toggles: ['yellow', 'yellow', 'yellow', 'yellow'],

  // quadrants[i]: { red, blue, yellow }  (i = 0..3)
  quadrants: [
    { red: 0, blue: 0, yellow: 0 },
    { red: 0, blue: 0, yellow: 0 },
    { red: 0, blue: 0, yellow: 0 },
    { red: 0, blue: 0, yellow: 0 },
  ],

  // midfield goal
  midfield: { red: 0, blue: 0, yellow: 0 },

  // robots positioned in midfield
  midfieldRobots: { red: 0, blue: 0 },
};

// ── Score Calculation ──────────────────────────────────────────────

/**
 * Returns a detailed breakdown object for the given alliance.
 * alliance: 'red' | 'blue'
 */
function calcBreakdown(alliance) {
  const opp = alliance === 'red' ? 'blue' : 'red';

  // Autonomous bonus
  let auton = 0;
  if (state.autonWinner === alliance)  auton = 12;
  else if (state.autonWinner === 'tie') auton = 6;

  // Alliance-colored pin halves across all quadrants and midfield (5 pts each)
  let allianceHalves = state.midfield[alliance];
  state.quadrants.forEach(q => { allianceHalves += q[alliance]; });
  const alliancePts = allianceHalves * 5;

  // Robots in midfield (8 pts each)
  const robotPts = state.midfieldRobots[alliance] * 8;

  // Yellow halves in owned quadrants (10 pts each)
  let quadrantYellowPts = 0;
  state.quadrants.forEach((q, i) => {
    if (state.toggles[i] === alliance) {
      quadrantYellowPts += q.yellow * 10;
    }
  });

  // Midfield yellow halves: score only if THIS alliance has more robots than the other
  let midfieldYellowPts = 0;
  const myRobots  = state.midfieldRobots[alliance];
  const oppRobots = state.midfieldRobots[opp];
  if (myRobots > oppRobots) {
    midfieldYellowPts = state.midfield.yellow * 10;
  }

  const total = auton + alliancePts + robotPts + quadrantYellowPts + midfieldYellowPts;

  return { auton, allianceHalves, alliancePts, robotPts, quadrantYellowPts, midfieldYellowPts, total };
}

/** Returns the total score for an alliance. */
function calcScore(alliance) {
  return calcBreakdown(alliance).total;
}

// ── Timer Logic ────────────────────────────────────────────────────

function startTimer() {
  if (state.matchPhase === 'ended') return;
  if (state.timerInterval) return; // already running

  if (state.matchPhase === 'pre') {
    state.matchPhase = 'auton';
  }

  state.timerInterval = setInterval(() => {
    state.timeRemaining = Math.max(0, state.timeRemaining - 1);

    // Transition from Auton → Driver at the 15-second mark
    const driverStart = MATCH_DURATION - AUTON_DURATION; // 105
    if (state.matchPhase === 'auton' && state.timeRemaining <= driverStart) {
      state.matchPhase = 'driver';
    }

    if (state.timeRemaining === 0) {
      state.matchPhase = 'ended';
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    render();
  }, 1000);

  updateTimerButtons();
  render();
}

function pauseTimer() {
  if (!state.timerInterval) return;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  updateTimerButtons();
}

function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timeRemaining = MATCH_DURATION;
  state.matchPhase = 'pre';
  render();
  updateTimerButtons();
}

function updateTimerButtons() {
  const running = !!state.timerInterval;
  document.getElementById('btn-start').disabled = running || state.matchPhase === 'ended';
  document.getElementById('btn-pause').disabled = !running;
}

// ── Toggle Logic ───────────────────────────────────────────────────
const TOGGLE_CYCLE = ['yellow', 'red', 'blue'];
const TOGGLE_LABELS = { yellow: 'NEUTRAL', red: 'RED OWNED', blue: 'BLUE OWNED' };

function cycleToggle(qIndex) {
  const cur = state.toggles[qIndex];
  const next = TOGGLE_CYCLE[(TOGGLE_CYCLE.indexOf(cur) + 1) % TOGGLE_CYCLE.length];
  state.toggles[qIndex] = next;
  renderToggle(qIndex);
  renderScores();
  renderBreakdown();
}

// ── Counter Logic ──────────────────────────────────────────────────

/**
 * Change half count.
 * type:  'q' (quadrant) | 'mf' (midfield)
 * index: quadrant index 0–3 (ignored for midfield)
 * color: 'red' | 'blue' | 'yellow'
 * delta: +1 | -1
 */
function changeHalf(type, index, color, delta) {
  if (type === 'q') {
    state.quadrants[index][color] = Math.max(0, state.quadrants[index][color] + delta);
    document.getElementById(`q${index}-${color}`).textContent = state.quadrants[index][color];
  } else {
    state.midfield[color] = Math.max(0, state.midfield[color] + delta);
    document.getElementById(`mf-${color}`).textContent = state.midfield[color];
  }
  renderScores();
  renderBreakdown();
}

/**
 * Set robot count for an alliance in midfield.
 * alliance: 'red' | 'blue'
 * count:    0 | 1 | 2
 */
function setRobots(alliance, count) {
  state.midfieldRobots[alliance] = count;
  renderRobotButtons(alliance);
  renderScores();
  renderBreakdown();
}

// ── Auton Winner Logic ─────────────────────────────────────────────

function setAutonWinner(winner) {
  state.autonWinner = winner;
  renderAutonButtons();
  renderScores();
  renderBreakdown();
}

// ── Render Functions ───────────────────────────────────────────────

function renderTimer() {
  const mins = Math.floor(state.timeRemaining / 60);
  const secs = state.timeRemaining % 60;
  const display = document.getElementById('timer-display');
  const phase   = document.getElementById('phase-label');

  display.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  display.className = 'timer-display';

  const phaseMap = {
    pre:    { label: 'PRE-MATCH',        cls: '' },
    auton:  { label: 'AUTONOMOUS',       cls: 'auton-phase' },
    driver: { label: 'DRIVER CONTROL',   cls: 'driver-phase' },
    ended:  { label: 'MATCH ENDED',      cls: 'ended-phase' },
  };

  const info = phaseMap[state.matchPhase];
  phase.textContent = info.label;
  if (info.cls) display.classList.add(info.cls);
}

function renderScores() {
  document.getElementById('red-score').textContent  = calcScore('red');
  document.getElementById('blue-score').textContent = calcScore('blue');
}

function renderToggle(qIndex) {
  const state_val = state.toggles[qIndex];
  const btn  = document.getElementById(`toggle-q${qIndex}`);
  const card = document.getElementById(`cell-q${qIndex}`);

  btn.textContent = TOGGLE_LABELS[state_val];
  btn.className   = `toggle-btn t-${state_val}`;
  card.className  = `quadrant-card state-${state_val}`;
}

function renderAllToggles() {
  state.toggles.forEach((_, i) => renderToggle(i));
}

function renderRobotButtons(alliance) {
  const count = state.midfieldRobots[alliance];
  const prefix = alliance === 'red' ? 'rr' : 'br';
  [0, 1, 2].forEach(n => {
    const btn = document.getElementById(`${prefix}-${n}`);
    btn.classList.toggle(`active-${alliance}`, n === count);
  });
}

function renderAutonButtons() {
  const winners = ['red', 'tie', 'blue', 'none'];
  winners.forEach(w => {
    const btn = document.getElementById(`aw-${w}`);
    if (btn) btn.classList.toggle('active-aw', state.autonWinner === w);
  });
}

function renderBreakdown() {
  ['red', 'blue'].forEach(alliance => {
    const bd = calcBreakdown(alliance);
    const el = document.getElementById(`${alliance}-breakdown`);

    const lines = [
      { label: 'Auton Bonus', value: bd.auton },
      { label: `${alliance === 'red' ? 'Red' : 'Blue'} Halves (×5)`, value: bd.alliancePts, sub: `${bd.allianceHalves} halves` },
      { label: 'Midfield Robots (×8)', value: bd.robotPts },
      { label: 'Owned Quadrant Yellow (×10)', value: bd.quadrantYellowPts },
      { label: 'Midfield Yellow (×10)', value: bd.midfieldYellowPts },
      { label: 'TOTAL', value: bd.total, total: true },
    ];

    el.innerHTML = lines.map(l =>
      `<div class="bd-line${l.total ? ' bd-total' : ''}">
         <span>${l.label}${l.sub ? ` <em style="opacity:.6;font-size:.72rem">(${l.sub})</em>` : ''}</span>
         <span>${l.value}</span>
       </div>`
    ).join('');
  });
}

/** Full re-render of the entire UI. */
function render() {
  renderTimer();
  renderScores();
  renderAllToggles();
  renderRobotButtons('red');
  renderRobotButtons('blue');
  renderAutonButtons();
  renderBreakdown();
}

// ── Boot ───────────────────────────────────────────────────────────
render();
updateTimerButtons();
