/* ==========================================================================
   Frickbear Editor — Frickbears 3 save editor
   Client-side only. Nothing is uploaded anywhere.
   ========================================================================== */
(() => {
  'use strict';

  const DATA = window.FB_DATA;
  if (!DATA) {
    document.getElementById('app').innerHTML =
      '<div style="padding:40px;font-family:monospace;color:#ff5c6c">Game data failed to load (assets/data.js).</div>';
    return;
  }

  const META = DATA.meta;
  const VERSION_TAG = META.version || '_v2-0-0';
  const STORAGE_KEY = 'frickbear-editor:v1';
  const APP_VERSION = '1.0.0';

  const ANIM = DATA.animatronics;
  const ANIM_BY_ID = new Map(ANIM.map(a => [a.id, a]));
  const UPGRADES = DATA.upgrades;
  const UPGRADE_BY_ID = new Map(UPGRADES.map(u => [u.id, u]));
  const MINIGAMES = DATA.minigames;
  const MINIGAME_BY_ID = new Map(MINIGAMES.map(m => [m.id, m]));
  const TROPHIES = DATA.trophies;
  const CHALLENGES = DATA.customChallenges;
  const ELEANOR = DATA.eleanorChallenges;
  const CONSUMABLES = DATA.consumables || [];
  const CONSUMABLE_BY_ID = new Map(CONSUMABLES.map(c => [c.id, c]));
  const PHONE_CALLS = META.phoneCalls || [];
  const PHONE_BY_ID = new Map(PHONE_CALLS.map(p => [p.id, p]));
  const ROOMS = DATA.rooms || [];

  const DEFAULT_KEYBINDS = [32, 27, 87, 65, 83, 68, 83, 87, 65, 68, 90, 88, 16, 49, 50, 51, 52, 53, 54, 55, 56, 81, 87, 69, 82, 32, 16];
  const ROLES = ['Enemy', 'Boss', 'Jumpscarer', 'Shopkeeper', 'Guard', 'Story', 'Other'];
  const ROLE_LABEL = { Enemy: 'Enemies', Boss: 'Bosses', Jumpscarer: 'Jumpscarers', Shopkeeper: 'Vendors', Guard: 'Guards', Story: 'Story', Other: 'Other' };

  /* ==========================================================================
     Small utilities
     ========================================================================== */

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
  const range = (n, start = 0) => Array.from({ length: n }, (_, i) => i + start);
  const sum = (arr) => (Array.isArray(arr) ? arr.reduce((a, b) => a + num(b), 0) : 0);
  const countTruthy = (arr) => (Array.isArray(arr) ? arr.reduce((a, b) => a + (b ? 1 : 0), 0) : 0);
  const len = (arr) => (Array.isArray(arr) ? arr.length : 0);

  const nf = new Intl.NumberFormat('en-US');
  const mf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function fmtInt(v) { return Number.isFinite(Number(v)) ? nf.format(Math.round(Number(v))) : '—'; }
  function fmtNum(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return nf.format(Math.round(n * 100) / 100);
  }
  function fmtMoney(v) { return '$' + (Number.isFinite(Number(v)) ? mf.format(Number(v)) : '0.00'); }
  function fmtDuration(v) {
    let n = Number(v);
    if (!Number.isFinite(n) || n < 0) return '—';
    if (n >= 999998) return 'unset';
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    const sec = Number.isInteger(s) ? String(s) : (Math.round(s * 10) / 10).toString();
    if (h > 0) return `${h}h ${m}m ${String(Math.floor(s)).padStart(2, '0')}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }
  function fmtDurationShort(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return '—';
    if (n >= 999998) return 'unset';
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const sec = Math.round(n % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }
  function fmtClock(v) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    return `${Math.floor(n / 3600).toString().padStart(2, '0')}:${Math.floor((n % 3600) / 60).toString().padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  }
  function byteLength(str) { return new TextEncoder().encode(str).length; }

  function pathGet(obj, path) {
    if (!path) return obj;
    return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function pathSet(obj, path, value) {
    const parts = String(path).split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const next = parts[i + 1];
      if (o[k] == null) o[k] = /^\d+$/.test(next) ? [] : {};
      o = o[k];
    }
    o[parts[parts.length - 1]] = value;
  }

  function nightName(v) {
    if (typeof v === 'string' && /^\d+$/.test(v)) v = Number(v);
    if (typeof v === 'number' && v >= 1 && v <= 6) return META.nightLabels[v - 1] || `Night ${v}`;
    if (v === 'Custom') return 'Custom Night';
    return v === undefined || v === null ? '—' : String(v);
  }
  function diffName(v) { return META.difficulties[num(v)] || (v === undefined ? '—' : String(v)); }
  function routeName(v) { const r = META.routes.find(r => r.id === num(v)); return r ? r.name : (v === undefined ? '—' : String(v)); }
  function guardName(v) { return META.guards[num(v)] || (v === undefined ? '—' : `Guard #${v}`); }
  function roomName(id) { const r = ROOMS.find(r => r.id === num(id)); return r ? r.name : `Room #${id}`; }
  function animName(id) { const a = ANIM_BY_ID.get(num(id)); return a ? a.name : `#${id}`; }
  function upgName(id) { const u = UPGRADE_BY_ID.get(num(id)); return u ? u.name : `Upgrade #${id}`; }
  function minigameName(id) { const m = MINIGAME_BY_ID.get(num(id)); return m ? m.name : `Slot #${id}`; }
  function phoneName(id) { const p = PHONE_BY_ID.get(num(id)); return p ? p.name : `Call #${id}`; }
  function consumableName(id) { const c = CONSUMABLE_BY_ID.get(num(id)); return c ? c.name : `Item #${id}`; }

  function todayString() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date();
    return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')}, ${d.getFullYear()}`;
  }

  function keyName(code) {
    const c = num(code, -1);
    const named = {
      8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl', 18: 'Alt', 19: 'Pause', 20: 'Caps Lock',
      27: 'Esc', 32: 'Space', 33: 'Page Up', 34: 'Page Down', 35: 'End', 36: 'Home', 37: 'Left', 38: 'Up',
      39: 'Right', 40: 'Down', 45: 'Insert', 46: 'Delete', 91: 'Win', 92: 'Win', 93: 'Menu',
      106: 'Num *', 107: 'Num +', 109: 'Num -', 110: 'Num .', 111: 'Num /', 144: 'Num Lock', 145: 'Scroll Lock'
    };
    if (named[c]) return named[c];
    if (c >= 48 && c <= 57) return String.fromCharCode(c);
    if (c >= 65 && c <= 90) return String.fromCharCode(c);
    if (c >= 96 && c <= 105) return 'Num ' + (c - 96);
    if (c >= 112 && c <= 123) return 'F' + (c - 111);
    return c === 0 ? 'Unbound' : `Key ${c}`;
  }

  function uid() { return 'f-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }

  /* ==========================================================================
     Defaults / templates
     ========================================================================== */

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function defaultShuffle(randomize = false) {
    return {
      PhoneCalls: (META.defaultPhoneCalls || []).slice(),
      Locations: [12, 13, 14, 15, 16],
      Minigames: randomize ? shuffled(range(16)) : range(16),
      Animatronics: randomize ? shuffled(range(87)) : range(87)
    };
  }

  function defaultSettings() {
    return [
      DEFAULT_KEYBINDS.slice(),
      [0, 0],
      [10, 10, 10, 10, 0, 0, 0],
      [0, 0, 4, 1, 0, 0, 0]
    ];
  }

  function buildTemplate(kind) {
    if (kind === 'run') {
      return {
        _Night: 1,
        _StartRoom: 17,
        _Difficulty: 1,
        _Guard: 0,
        _Salvages: [0, 1, 2, 3, 16],
        _Masks: [false, false, false, false],
        _Scraps: [false, false, false, false],
        _Minigames: [false, false, false, false, false],
        _Paycheck: 0,
        _PaycheckTotal: 0,
        _CanContinue: false,
        _Upgrades: [],
        _Deaths: [0, 0, 0, 0, 0, 0],
        _Route: 0,
        _RunTime: 0,
        _ShuffleMode: false,
        _ShuffleData: defaultShuffle(false)
      };
    }
    if (kind === 'endless') {
      const carts = range(20).map(i => [1, 2, 8].includes(i));
      return {
        _EndlessRound: 1,
        _StartRoom: 51,
        _Lives: [0, 0, 0],
        _Upgrades: [],
        _EndlessInventory: {
          Cartridges: carts,
          Consumables: [],
          BobbiedotRegimen: -1,
          WhackedChars: [],
          MarkiplierPoints: 0,
          RoundDebt: 0,
          BarrierBooze: 0,
          BossCall: false
        },
        _RepeatPrevention: { Animatronics: [], Shops: [-1, -1], Upgrades: [], Challenges: -1 },
        _Difficulty: 1,
        _Guard: 0,
        _Salvages: [16],
        _Paycheck: 0,
        _PaycheckTotal: 0,
        _RunTime: 0,
        _CanContinue: false,
        _DeathsThisRound: 0,
        _TimesHealed: 0,
        _NuzlockeMode: false,
        _EleanorChallenge: null,
        _AbilityIndex: range(20),
        _Seed: Math.floor(Math.random() * 1e9),
        _Deaths: 0,
        _Beaten: false
      };
    }
    // records
    const notifs = (n) => Array.from({ length: n }, () => true);
    const unlockedMinigames = Array.from({ length: 30 }, () => false);
    unlockedMinigames[0] = true;
    unlockedMinigames[1] = true;
    const unlockedGuards = Array.from({ length: 30 }, () => false);
    unlockedGuards[0] = true; unlockedGuards[1] = true; unlockedGuards[2] = true;
    const shuffleSettings = Array.from({ length: 11 }, () => true);
    shuffleSettings[0] = false; shuffleSettings[2] = false; shuffleSettings[10] = false;
    const hiScores = Array.from({ length: 30 }, () => 0);
    hiScores[0] = 360; hiScores[4] = 360; hiScores[7] = 360;
    return {
      _UnlockedAnimatronics: Array.from({ length: 202 }, () => false),
      _UnlockedTrophies: Array.from({ length: 63 }, () => false),
      _UnlockedMinigames: unlockedMinigames,
      _DeathRecord: Array.from({ length: 202 }, () => 0),
      _ClearedChallenges: Array.from({ length: 50 }, () => false),
      _Playtime: 0,
      _UnlockFlags: [],
      _ClearedEndings: Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => 0)),
      _SalvageRecord: Array.from({ length: 202 }, () => 0),
      _UpgradeRecord: Array.from({ length: 66 }, () => 0),
      _TokensPerMinigame: Array.from({ length: 30 }, () => 0),
      _RunSpeedBest: 999999,
      _RunEarningsBest: 0,
      _HiScoresOverall: hiScores,
      _GameFirstOpened: todayString(),
      _TipNum: 0,
      _BossHiScores: Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => 0)),
      _ExtrasNotifs: { AnimatronicsNotifs: notifs(256), ConceptArtNotifs: notifs(256), TrophyNotifs: notifs(128) },
      _Skins: Array.from({ length: 202 }, () => -1),
      _SkinOffice: -1,
      _RandomizeSkins: false,
      _RandomizeOffice: false,
      _ShuffleSettings: shuffleSettings,
      _EndlessStickers: Array.from({ length: 202 }, () => -1),
      _EndlessGuardStickers: Array.from({ length: 40 }, () => -1),
      _UnlockedGuards: unlockedGuards,
      _EndlessRoundsBeaten: 0,
      _ShuffleCallsHeard: [],
      _RunsAttempted: Array.from({ length: 21 }, () => Array.from({ length: 5 }, () => 0)),
      _RunsWon: Array.from({ length: 21 }, () => Array.from({ length: 5 }, () => 0)),
      _Settings: defaultSettings(),
      _FunValue: [Math.floor(Math.random() * 100), 421],
      _FreshSave: true
    };
  }

  function defaultFilename(kind) {
    if (kind === 'run') return `savedata${VERSION_TAG}.wario`;
    if (kind === 'records') return `records${VERSION_TAG}.wario`;
    return `endlessdata${VERSION_TAG}.txt`;
  }

  /* ==========================================================================
     State
     ========================================================================== */

  const state = {
    files: [],
    currentId: null,
    page: 'overview',
    subTab: { animatronics: 'pages' },
    filters: {},
    ui: { crt: true, bannerDismissed: false },
    modal: null,
    route: 'welcome'
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const app = $('#app');
  const modalRoot = $('#modal-root');
  const toastStack = $('#toast-stack');
  const fileInput = $('#file-input');
  const dropOverlay = $('#drop-overlay');

  function currentFile() { return state.files.find(f => f.id === state.currentId) || state.files[0] || null; }

  let persistTimer = null;
  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 350);
  }
  function persistNow() {
    clearTimeout(persistTimer);
    try {
      const payload = {
        v: 1,
        currentId: state.currentId,
        ui: { crt: state.ui.crt, bannerDismissed: state.ui.bannerDismissed },
        files: state.files.map(f => ({
          id: f.id,
          name: f.name,
          kind: f.kind,
          data: f.data,
          original: f.original,
          dirty: f.dirty,
          addedAt: f.addedAt
        }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Storage can be unavailable/full; the editor still works in-memory.
      console.warn('Could not save session to localStorage', e);
    }
  }

  /* ==========================================================================
     Saving / parsing / file management
     ========================================================================== */

  function parseSaveText(text) {
    let s = String(text).replace(/^\uFEFF/, '').replace(/\u0000+$/g, '').trim();
    if (!s) throw new Error('The file is empty.');
    const parsed = JSON.parse(s);
    if (!isObj(parsed)) throw new Error('The save is not a JSON object.');
    return parsed;
  }

  function detectKind(obj) {
    if (!isObj(obj)) return null;
    if ('_EndlessRound' in obj || '_EndlessInventory' in obj || '_Lives' in obj) return 'endless';
    if ('_UnlockedAnimatronics' in obj || '_UnlockedTrophies' in obj) return 'records';
    if ('_Night' in obj || '_ShuffleData' in obj || '_Paycheck' in obj) return 'run';
    return null;
  }

  function kindLabel(kind) { return kind === 'run' ? 'Run save' : kind === 'records' ? 'Records' : 'Endless'; }
  function kindShort(kind) { return kind === 'run' ? 'RUN' : kind === 'records' ? 'REC' : 'END'; }

  function createFile(name, kind, data) {
    const serialized = JSON.stringify(data);
    return {
      id: uid(),
      name: name || defaultFilename(kind),
      kind,
      data,
      original: serialized,
      dirty: false,
      undo: [],
      redo: [],
      addedAt: Date.now(),
      _lastPath: null,
      _lastAt: 0
    };
  }

  async function loadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const firstNewIndex = state.files.length;
    let added = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const data = parseSaveText(text);
        const kind = detectKind(data);
        if (!kind) throw new Error('Not a Frickbears 3 save file (no known save keys).');
        state.files.push(createFile(file.name, kind, data));
        added++;
      } catch (err) {
        notify(`${file.name}: ${err.message}`, 'error');
      }
    }
    if (added) {
      const f = state.files[firstNewIndex];
      state.currentId = f.id;
      state.page = 'overview';
      persistNow();
      goEditor(f, 'overview');
      notify(`Loaded ${added} file${added === 1 ? '' : 's'}. Back up your saves before editing!`, 'success');
    } else {
      renderApp();
    }
  }

  function downloadFile(f) {
    if (!f) return;
    const json = JSON.stringify(f.data);
    const blob = new Blob([json + '\u0000'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.name || defaultFilename(f.kind);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    notify(`Downloaded ${a.download}`, 'success');
  }

  function downloadAll() {
    if (!state.files.length) return;
    state.files.forEach((f, i) => setTimeout(() => downloadFile(f), i * 220));
  }

  /* ==========================================================================
     History / edit commits
     ========================================================================== */

  function snapshot(f) { return JSON.stringify(f.data); }

  function commit(f, mutate) {
    const before = snapshot(f);
    mutate();
    const after = snapshot(f);
    if (before === after) return false;
    f.undo.push(before);
    if (f.undo.length > 60) f.undo.shift();
    f.redo.length = 0;
    f.dirty = after !== f.original;
    persistSoon();
    refreshDirtyUI();
    return true;
  }

  function commitField(f, path, value) {
    const now = Date.now();
    if (f._lastPath === path && now - f._lastAt < 900) {
      pathSet(f.data, path, value);
      f.dirty = snapshot(f) !== f.original;
    } else {
      const changed = commit(f, () => pathSet(f.data, path, value));
      if (!changed) return;
      f._lastPath = path;
      f._lastAt = now;
    }
    persistSoon();
    refreshDirtyUI();
    refreshFormats(path);
    refreshCounters(f);
  }

  function undo(f) {
    if (!f || !f.undo.length) return;
    f.redo.push(snapshot(f));
    f.data = JSON.parse(f.undo.pop());
    f.dirty = snapshot(f) !== f.original;
    f._lastPath = null;
    persistSoon();
    renderApp({ preserveScroll: true });
    notify('Undid last change', 'info');
  }

  function redo(f) {
    if (!f || !f.redo.length) return;
    f.undo.push(snapshot(f));
    f.data = JSON.parse(f.redo.pop());
    f.dirty = snapshot(f) !== f.original;
    f._lastPath = null;
    persistSoon();
    renderApp({ preserveScroll: true });
    notify('Redid change', 'info');
  }

  /* ==========================================================================
     Stats
     ========================================================================== */

  function computeStats(f) {
    const d = f.data;
    const counters = {};
    const ratios = {};

    if (f.kind === 'run') {
      counters.night = nightName(d._Night);
      counters.difficulty = diffName(d._Difficulty);
      counters.route = routeName(d._Route);
      counters.guard = guardName(d._Guard);
      counters.paycheck = fmtMoney(d._Paycheck);
      counters.runtime = fmtDurationShort(d._RunTime);
      counters.deaths = fmtInt(sum(d._Deaths));
      counters.salvages = fmtInt(len(d._Salvages));
      ratios.masks = { v: countTruthy(d._Masks), t: 4 };
      ratios.scraps = { v: countTruthy(d._Scraps), t: 4 };
      ratios.runMinigames = { v: countTruthy(d._Minigames), t: Math.max(5, len(d._Minigames)) };
      ratios.upgrades = { v: len(d._Upgrades), t: UPGRADES.length };
      counters.masks = `${ratios.masks.v}/${ratios.masks.t}`;
      counters.scraps = `${ratios.scraps.v}/${ratios.scraps.t}`;
      counters.runMinigames = `${ratios.runMinigames.v}/${ratios.runMinigames.t}`;
      counters.upgrades = `${ratios.upgrades.v}/${ratios.upgrades.t}`;
      return { counters, ratios };
    }

    if (f.kind === 'records') {
      const anim = d._UnlockedAnimatronics || [];
      const known = ANIM.filter(a => a.known);
      const pages = known.filter(a => !!anim[a.id]).length;
      const enemies = range(87).filter(i => !!anim[i]).length;
      const minis = MINIGAMES.filter(m => !!(d._UnlockedMinigames || [])[m.id]).length;
      const trophies = countTruthy(d._UnlockedTrophies);
      const challenges = (d._ClearedChallenges || []).filter(v => num(v) > 0).length;
      const guards = range(21).filter(i => !!(d._UnlockedGuards || [])[i]).length;
      const stickers = range(87).filter(i => num((d._EndlessStickers || [])[i], -1) > -1).length;
      const guardStickers = range(21).filter(i => num((d._EndlessGuardStickers || [])[i], -1) > -1).length;
      const upgrades = countTruthy(d._UpgradeRecord);
      const endings = range(5).filter(r => (d._ClearedEndings || []).some(row => num(row?.[r]) > 0)).length;

      ratios.pages = { v: pages, t: known.length };
      ratios.enemies = { v: enemies, t: 87 };
      ratios.minigames = { v: minis, t: MINIGAMES.length };
      ratios.trophies = { v: trophies, t: TROPHIES.length };
      ratios.challenges = { v: challenges, t: CHALLENGES.length };
      ratios.guards = { v: guards, t: 21 };
      ratios.stickers = { v: stickers, t: 87 };
      ratios.guardStickers = { v: guardStickers, t: 21 };
      ratios.upgrades = { v: upgrades, t: UPGRADES.length };
      ratios.endings = { v: endings, t: 5 };

      counters.pages = `${pages}/${known.length}`;
      counters.enemies = `${enemies}/87`;
      counters.minigames = `${minis}/${MINIGAMES.length}`;
      counters.trophies = `${trophies}/${TROPHIES.length}`;
      counters.challenges = `${challenges}/${CHALLENGES.length}`;
      counters.guards = `${guards}/21`;
      counters.stickers = `${stickers}/87`;
      counters.guardStickers = `${guardStickers}/21`;
      counters.upgrades = `${upgrades}/${UPGRADES.length}`;
      counters.endings = `${endings}/5`;
      counters.playtime = fmtDurationShort(d._Playtime);
      counters.tokens = fmtInt(sum(d._TokensPerMinigame));
      counters.firstOpened = d._GameFirstOpened || '—';
      return { counters, ratios };
    }

    // endless
    const inv = d._EndlessInventory || {};
    counters.round = `Round ${fmtInt(d._EndlessRound)}`;
    counters.difficulty = diffName(d._Difficulty);
    counters.guard = guardName(d._Guard);
    counters.money = fmtMoney(d._Paycheck);
    counters.lives = fmtInt(sum(d._Lives));
    counters.deaths = fmtInt(d._DeathsThisRound);
    counters.seed = fmtInt(d._Seed);
    counters.upgrades = fmtInt(len(d._Upgrades));
    counters.salvages = fmtInt(len(d._Salvages));
    counters.cartridges = fmtInt(countTruthy(inv.Cartridges));
    ratios.upgrades = { v: len(d._Upgrades), t: UPGRADES.length };
    return { counters, ratios };
  }

  function refreshCounters(f) {
    const file = f || currentFile();
    if (!file) return;
    const stats = computeStats(file);
    $$('[data-counter]').forEach(el => {
      const key = el.dataset.counter;
      if (key in stats.counters) el.textContent = stats.counters[key];
    });
    $$('[data-ratio]').forEach(el => {
      const key = el.dataset.ratio;
      const r = stats.ratios[key];
      if (!r) return;
      el.textContent = `${r.v}/${r.t}`;
      const bar = $(`[data-bar="${key}"] > i`);
      if (bar) bar.style.width = `${r.t ? Math.min(100, (r.v / r.t) * 100) : 0}%`;
    });
  }

  /* ==========================================================================
     Icons
     ========================================================================== */

  const ICON_PATHS = {
    home: '<path d="M3 8l5-5 5 5v6a1 1 0 0 1-1 1h-2v-4H6v4H4a1 1 0 0 1-1-1z"/>',
    moon: '<path d="M10.6 2.2a6.2 6.2 0 1 0 3.2 10.9A6.6 6.6 0 0 1 10.6 2.2z"/>',
    mask: '<path d="M4 5.5C4 4.1 5.1 3 6.5 3h3C10.9 3 12 4.1 12 5.5V8a4 4 0 0 1-8 0z"/><path d="M6 6.2h.01M10 6.2h.01M6.5 9c.8.6 2.2.6 3 0"/>',
    upgrade: '<path d="M8 2.5l3.5 3.5H9.2v4H6.8v-4H4.5z"/><path d="M3 12h10v1.5H3z"/>',
    dice: '<rect x="3" y="3" width="10" height="10" rx="1"/><path d="M5.6 5.6h.01M10.4 5.6h.01M8 8h.01M5.6 10.4h.01M10.4 10.4h.01"/>',
    code: '<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9.2 2.5L6.8 13.5"/>',
    chart: '<path d="M2.5 13.5h11M4 13.5V9M7 13.5V5.5M10 13.5V7.5M13 13.5V3.5"/>',
    user: '<circle cx="8" cy="5.5" r="2.6"/><path d="M3.2 13.5c.5-2.6 2.4-4 4.8-4s4.3 1.4 4.8 4"/>',
    gamepad: '<rect x="2" y="5" width="12" height="7" rx="2"/><path d="M5 7.5v2M4 8.5h2M10.5 7.8h.01M12 9.3h.01"/>',
    trophy: '<path d="M5 3h6v3.5a3 3 0 0 1-6 0zM5 4H3v1.5a2 2 0 0 0 2 2M11 4h2v1.5a2 2 0 0 1-2 2M8 9.5V12M5.5 13.5h5"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01"/>',
    shield: '<path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z"/>',
    palette: '<path d="M8 2.2a5.8 5.8 0 1 0 0 11.6c1 0 1.5-.7 1.5-1.5 0-.5-.2-.8-.5-1.2-.3-.4-.5-.7-.5-1.2 0-.8.7-1.4 1.5-1.4h1.6A2.4 2.4 0 0 0 14 6.1C13.5 3.8 11 2.2 8 2.2z"/><path d="M5.2 5.5h.01M8 4.2h.01M10.8 5.5h.01"/>',
    settings: '<circle cx="8" cy="8" r="2.2"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1"/>',
    upload: '<path d="M8 10.5V2.5M5 5.5l3-3 3 3"/><path d="M2.5 9.5v3a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M8 2.5v8M5 7.5l3 3 3-3"/><path d="M2.5 11.5v1a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1"/>',
    trash: '<path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8M6.6 7v4M9.4 7v4"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    minus: '<path d="M3 8h10"/>',
    undo: '<path d="M5.5 4.5L2.5 7.5l3 3"/><path d="M2.5 7.5h6a4 4 0 0 1 0 8H7"/>',
    redo: '<path d="M10.5 4.5l3 3-3 3"/><path d="M13.5 7.5h-6a4 4 0 0 0 0 8H9"/>',
    search: '<circle cx="7" cy="7" r="4"/><path d="M10 10l4 4"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>',
    check: '<path d="M3 8.5l3.2 3.2L13 5"/>',
    alert: '<path d="M8 2.5L14 13H2z"/><path d="M8 6v3.2M8 11.4h.01"/>',
    file: '<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.5"/><path d="M13 2.5V5h-2.5"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    unlock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 4.8-.8"/>',
    star: '<path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 6.3l4-.6z"/>',
    clock: '<circle cx="8" cy="8" r="5.7"/><path d="M8 4.8V8l2.2 1.3"/>',
    coin: '<circle cx="8" cy="8" r="5.7"/><path d="M8 4.8v6.4M6.3 6.2c0-.8.8-1.4 1.7-1.4s1.7.6 1.7 1.4-.8 1.2-1.7 1.4-1.7.6-1.7 1.4.8 1.4 1.7 1.4 1.7-.6 1.7-1.4"/>',
    heart: '<path d="M8 13.2S2.8 10 2.8 6.3A2.8 2.8 0 0 1 8 4.7a2.8 2.8 0 0 1 5.2 1.6C13.2 10 8 13.2 8 13.2z"/>',
    box: '<path d="M2.5 5.5L8 2.5l5.5 3v5L8 13.5l-5.5-3z"/><path d="M2.5 5.5L8 8.5l5.5-3M8 8.5v5"/>',
    arrow: '<path d="M3 8h9M9 5l3 3-3 3"/>',
    save: '<path d="M3 2.5h8l2 2v9H3z"/><path d="M5 2.5v4h5v-4M5 10h6"/>'
  };

  function icon(name, cls = '') {
    return `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.file}</svg>`;
  }

  const BEAR_SVG = `<svg viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="2" y="6" width="6" height="6" fill="#c58a3e"/>
    <rect x="24" y="6" width="6" height="6" fill="#c58a3e"/>
    <rect x="2" y="10" width="28" height="16" fill="#c58a3e"/>
    <rect x="6" y="14" width="20" height="8" fill="#8d5a24"/>
    <rect x="8" y="12" width="4" height="4" fill="#f4ead9"/>
    <rect x="20" y="12" width="4" height="4" fill="#f4ead9"/>
    <rect x="9" y="13" width="2" height="2" fill="#15141d"/>
    <rect x="21" y="13" width="2" height="2" fill="#15141d"/>
    <rect x="14" y="18" width="4" height="2" fill="#15141d"/>
    <rect x="10" y="4" width="12" height="3" fill="#2b2937"/>
    <rect x="8" y="7" width="16" height="2" fill="#2b2937"/>
  </svg>`;

  const MONITOR_SVG = `<svg class="monitor" viewBox="0 0 480 340" shape-rendering="crispEdges" role="img" aria-label="A retro CRT monitor showing a pixel-art bear">
    <defs>
      <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="2" fill="#000" opacity=".22"/>
      </pattern>
      <radialGradient id="glow" cx="50%" cy="45%" r="55%">
        <stop offset="0" stop-color="#e53170" stop-opacity=".20"/>
        <stop offset="1" stop-color="#e53170" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="case" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#332f44"/>
        <stop offset="1" stop-color="#232030"/>
      </linearGradient>
    </defs>
    <ellipse cx="240" cy="180" rx="220" ry="150" fill="url(#glow)"/>
    <rect x="52" y="302" width="62" height="18" fill="#2a2737" stroke="#16141f" stroke-width="3"/>
    <rect x="366" y="302" width="62" height="18" fill="#2a2737" stroke="#16141f" stroke-width="3"/>
    <rect x="24" y="18" width="432" height="292" fill="url(#case)" stroke="#4f4967" stroke-width="4"/>
    <rect x="38" y="32" width="404" height="242" fill="#0c0b12" stroke="#5a5374" stroke-width="3"/>
    <rect x="50" y="44" width="380" height="216" fill="#171326"/>
    <rect x="50" y="44" width="380" height="216" fill="url(#scan)"/>
    <g transform="translate(178 62) scale(7.4)" shape-rendering="crispEdges">
      <rect x="2" y="4" width="3" height="3" fill="#b87b33"/>
      <rect x="15" y="4" width="3" height="3" fill="#b87b33"/>
      <rect x="6" y="0" width="8" height="2" fill="#201d2a"/>
      <rect x="4" y="2" width="12" height="2" fill="#201d2a"/>
      <rect x="3" y="5" width="14" height="10" fill="#c58a3e"/>
      <rect x="6" y="10" width="8" height="4" fill="#e0b877"/>
      <rect x="5" y="7" width="3" height="2" fill="#fff8e7"/>
      <rect x="12" y="7" width="3" height="2" fill="#fff8e7"/>
      <rect x="6" y="8" width="1" height="1" fill="#15141d"/>
      <rect x="13" y="8" width="1" height="1" fill="#15141d"/>
      <rect x="9" y="11" width="2" height="1" fill="#15141d"/>
      <rect x="7" y="13" width="6" height="1" fill="#8d5a24"/>
      <rect x="2" y="5" width="1" height="4" fill="#b87b33"/>
      <rect x="17" y="5" width="1" height="4" fill="#b87b33"/>
    </g>
    <text x="240" y="208" text-anchor="middle" fill="#ffc857" font-family="'Pixel Operator Mono', monospace" font-size="13" letter-spacing="3">FRICKBEARS 3</text>
    <text x="240" y="226" text-anchor="middle" fill="#a7a1bc" font-family="'Pixel Operator Mono', monospace" font-size="9" letter-spacing="2">SAVE DATA // READY</text>
    <rect x="50" y="44" width="380" height="216" fill="none" stroke="#e53170" stroke-opacity=".28" stroke-width="2"/>
    <circle cx="86" cy="290" r="7" fill="#1b1926" stroke="#5a5374" stroke-width="2"/>
    <circle cx="110" cy="290" r="7" fill="#1b1926" stroke="#5a5374" stroke-width="2"/>
    <rect x="160" y="284" width="150" height="9" fill="#14121c" stroke="#4f4967" stroke-width="2"/>
    <rect x="320" y="282" width="90" height="13" fill="#14121c" stroke="#4f4967" stroke-width="2"/>
    <rect x="334" y="286" width="6" height="5" fill="#b5e61d"/>
    <rect x="346" y="286" width="24" height="5" fill="#3b374d"/>
    <rect x="392" y="286" width="10" height="5" fill="#e53170"/>
  </svg>`;

  /* ==========================================================================
     HTML components
     ========================================================================== */

  function pageHead(crumb, title, sub, actions = '') {
    return `<header class="page-head">
      <div>
        <div class="crumbs">${crumb}</div>
        <h1>${title}</h1>
        ${sub ? `<p class="sub">${sub}</p>` : ''}
      </div>
      ${actions ? `<div class="head-actions">${actions}</div>` : ''}
    </header>`;
  }

  function panel(title, sub, body, actions = '', opts = {}) {
    return `<section class="panel ${opts.class || ''}">
      <div class="panel-head">
        <div class="titles">
          <div class="panel-title">${title}</div>
          ${sub ? `<div class="panel-sub">${sub}</div>` : ''}
        </div>
        ${actions ? `<div class="actions">${actions}</div>` : ''}
      </div>
      <div class="panel-body ${opts.tight ? 'tight' : ''} ${opts.flush ? 'flush' : ''}">${body}</div>
    </section>`;
  }

  function statGrid(items) {
    return `<div class="stat-grid">${items.map(item => `
      <div class="stat ${item.cls || ''}">
        <div class="l">${item.l}</div>
        <div class="v"${item.counter ? ` data-counter="${item.counter}"` : ''}>${item.v ?? ''}</div>
        ${item.s ? `<div class="s">${item.s}</div>` : ''}
      </div>`).join('')}</div>`;
  }

  function progressRows(rows) {
    return `<div class="progress-list">${rows.map(r => `
      <div class="progress-row">
        <div class="pl">${r.label}</div>
        <div class="bar ${r.cls || ''}" data-bar="${r.key}"><i style="width:${r.t ? Math.min(100, (r.v / r.t) * 100) : 0}%"></i></div>
        <div class="pv" data-ratio="${r.key}">${r.v}/${r.t}</div>
      </div>`).join('')}</div>`;
  }

  function optionList(options, current) {
    return options.map(o => {
      const value = isObj(o) ? o.value : o;
      const label = isObj(o) ? (o.label ?? o.value) : o;
      return `<option value="${esc(value)}" ${String(value) === String(current) ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
  }

  function field(label, path, value, opts = {}) {
    const {
      type = 'number', options = [], hint = '', suffix = '', min, max, step,
      placeholder = '', disabled = false, rerender = false, coerce = 'number', wide = false, attrs = ''
    } = opts;
    let control;
    if (type === 'select') {
      if (coerce === 'bool') value = value ? 'true' : 'false';
      control = `<select data-path="${esc(path)}" data-type="select" data-coerce="${esc(coerce)}" ${rerender ? 'data-rerender="1"' : ''} ${disabled ? 'disabled' : ''} ${attrs}>
        ${optionList(options, value)}
      </select>`;
    } else {
      control = `<input type="${type}" data-path="${esc(path)}" data-type="${type === 'number' ? 'number' : 'text'}"
        value="${esc(value ?? '')}" ${step !== undefined ? `step="${esc(step)}"` : ''} ${min !== undefined ? `min="${esc(min)}"` : ''} ${max !== undefined ? `max="${esc(max)}"` : ''}
        ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${disabled ? 'disabled' : ''} ${attrs} autocomplete="off" spellcheck="false">`;
    }
    return `<label class="field ${wide ? 'w-100' : ''}">
      <span class="field-label">${label}${suffix ? ` <span class="suffix">${suffix}</span>` : ''}</span>
      ${control}
      ${hint ? `<span class="hint">${hint}</span>` : ''}
    </label>`;
  }

  function switchRow(label, hint, path, on, opts = {}) {
    return `<button type="button" class="switch-row" data-action="toggle" data-path="${esc(path)}" aria-pressed="${on ? 'true' : 'false'}" ${opts.attrs || ''}>
      <span class="txt"><b>${label}</b>${hint ? `<span>${hint}</span>` : ''}</span>
      <span class="switch ${on ? 'on' : ''}" aria-hidden="true"></span>
    </button>`;
  }

  function entryToggle(a, on, path, opts = {}) {
    const search = `${a.name} ${a.role || ''} ${a.desc || ''} ${a.defense ? a.defense.join(' ') : ''} ${a.id}`.toLowerCase();
    return `<button type="button" class="entry ${on ? 'on' : ''} ${a.known === false ? 'unknown' : ''}"
      data-action="toggle" data-path="${esc(path)}" aria-pressed="${on ? 'true' : 'false'}"
      data-search="${esc(search)}" data-role="${esc(a.role || 'Other')}" data-known="${a.known ? 1 : 0}">
      <span class="box" aria-hidden="true">✓</span>
      <span class="info">
        <span class="name">${esc(a.name)}</span>
        <span class="meta">${esc(a.role || '')}${a.salvageValue ? ` · ${fmtMoney(a.salvageValue)}` : ''}</span>
      </span>
      <span class="id">#${a.id}</span>
    </button>`;
  }

  function entryNumber(a, value, path, opts = {}) {
    const search = `${a.name} ${a.role || ''} ${a.desc || ''} ${a.id}`.toLowerCase();
    return `<div class="entry ${a.known === false ? 'unknown' : ''}" data-search="${esc(search)}" data-role="${esc(a.role || 'Other')}" data-known="${a.known ? 1 : 0}">
      <span class="info">
        <span class="name">${esc(a.name)}</span>
        <span class="meta">${esc(a.role || '')}${opts.meta ? ` · ${opts.meta}` : ''}</span>
      </span>
      <input class="num" type="number" data-path="${esc(path)}" data-type="number" value="${esc(value ?? 0)}" ${opts.min !== undefined ? `min="${opts.min}"` : ''} autocomplete="off">
    </div>`;
  }

  function entrySelect(a, value, path, options, opts = {}) {
    const search = `${a.name} ${a.role || ''} ${a.desc || ''} ${a.id}`.toLowerCase();
    return `<div class="entry ${opts.on ? 'on' : ''} ${a.known === false ? 'unknown' : ''}" data-search="${esc(search)}" data-role="${esc(a.role || 'Other')}" data-known="${a.known ? 1 : 0}">
      <span class="info">
        <span class="name">${esc(a.name)}</span>
        <span class="meta">${esc(opts.meta || a.role || '')}</span>
      </span>
      <span class="pick"><select data-path="${esc(path)}" data-type="select" data-coerce="number">${optionList(options, value)}</select></span>
    </div>`;
  }

  function gridToolbar(gridId, placeholder, roles = false) {
    const f = state.filters[gridId] || { q: '', role: 'all' };
    return `<div class="toolbar">
      <div class="search">${icon('search')}<input type="search" data-filter-grid="${gridId}" placeholder="${esc(placeholder)}" value="${esc(f.q)}" autocomplete="off"></div>
      ${roles ? `<div class="filters">
        <button type="button" class="filter ${(!f.role || f.role === 'all') ? 'active' : ''}" data-filter-role="all" data-grid="${gridId}">All</button>
        ${ROLES.map(r => `<button type="button" class="filter ${f.role === r ? 'active' : ''}" data-filter-role="${esc(r)}" data-grid="${gridId}">${esc(ROLE_LABEL[r] || r)}</button>`).join('')}
        <button type="button" class="filter ${f.role === 'known' ? 'active' : ''}" data-filter-role="known" data-grid="${gridId}">Known</button>
      </div>` : ''}
      <span class="count" data-count-grid="${gridId}"></span>
    </div>`;
  }

  function emptyState(msg) { return `<div class="empty">${msg}</div>`; }

  function chip(text, opts = {}) {
    return `<span class="chip ${opts.plain ? 'plain' : ''}">${opts.raw ? text : esc(text)}${opts.remove ? `<button type="button" class="x" data-action="${opts.removeAction || 'remove-array-item'}" data-path="${esc(opts.path)}" data-index="${opts.index}" title="Remove">×</button>` : ''}</span>`;
  }

  function bulkButton(label, bulk, opts = {}) {
    return `<button type="button" class="btn btn-sm ${opts.cls || ''}" data-action="bulk" data-bulk="${esc(bulk)}">${label}</button>`;
  }

  function tabsHTML(group, current, tabs) {
    return `<div class="tabs">${tabs.map(([id, label]) => `<button type="button" class="tab ${current === id ? 'active' : ''}" data-action="set-tab" data-group="${group}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>`;
  }

  function matrixHTML({ path, rowLabels, colLabels, valueOf, min = 0 }) {
    let html = `<div class="matrix-wrap"><table class="matrix"><thead><tr><th class="rowhead"></th>${colLabels.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`;
    rowLabels.forEach((row, ri) => {
      html += `<tr><td class="rowhead">${esc(row)}</td>`;
      colLabels.forEach((_, ci) => {
        html += `<td><input type="number" min="${min}" data-path="${esc(path)}.${ri}.${ci}" data-type="number" value="${esc(valueOf(ri, ci) ?? 0)}" autocomplete="off"></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  /* ==========================================================================
     Filtering
     ========================================================================== */

  function applyFilter(gridId) {
    const grid = document.querySelector(`.entries[data-grid="${gridId}"]`);
    if (!grid) return;
    const f = state.filters[gridId] || { q: '', role: 'all' };
    const q = (f.q || '').trim().toLowerCase();
    let visible = 0;
    grid.querySelectorAll('.entry').forEach(el => {
      const hay = (el.dataset.search || '').toLowerCase();
      let show = !q || hay.includes(q);
      if (show && f.role === 'known') show = el.dataset.known === '1';
      else if (show && f.role && f.role !== 'all' && f.role !== 'known') show = el.dataset.role === f.role;
      el.classList.toggle('hidden', !show);
      if (show) visible++;
    });
    const count = document.querySelector(`[data-count-grid="${gridId}"]`);
    if (count) count.textContent = `${visible} shown`;
  }

  function applyAllFilters() {
    document.querySelectorAll('.entries[data-grid]').forEach(grid => applyFilter(grid.dataset.grid));
  }

  /* ==========================================================================
     Welcome page
     ========================================================================== */

  function topbarHTML(welcome = false) {
    const f = currentFile();
    const tabs = state.files.map(file => `
      <button type="button" class="file-tab ${file.id === state.currentId ? 'active' : ''} ${file.dirty ? 'dirty' : ''}" data-action="switch-file" data-id="${file.id}" title="${esc(file.name)}">
        <span class="dot"></span>
        <span class="kind">${kindShort(file.kind)}</span>
        <span class="name">${esc(file.name)}</span>
        <span class="close" data-action="remove-file" data-id="${file.id}" title="Remove from editor">×</span>
      </button>`).join('');

    const mobileSelect = state.files.length > 1 ? `<select id="mobile-file-select" class="mobile-file-select" aria-label="Switch file">
      ${state.files.map(file => `<option value="${file.id}" ${file.id === state.currentId ? 'selected' : ''}>${esc(file.name)}</option>`).join('')}
    </select>` : '';

    return `<header class="topbar">
      <a class="brand" href="#/welcome" aria-label="Frickbear Editor home">
        <span class="brand-mark">${BEAR_SVG}</span>
        <span class="brand-text"><b>FRICKBEAR<em>3</em></b><small>Save Editor</small></span>
      </a>
      <div class="topbar-sep"></div>
      ${mobileSelect}
      <div class="file-tabs">${tabs}</div>
      <div class="topbar-actions">
        ${!welcome && f ? `<span class="unsaved-pill ${f.dirty ? 'show' : ''}" id="unsaved-pill">● Unsaved</span>` : ''}
        ${!welcome && f ? `<button type="button" class="btn btn-icon btn-ghost" data-action="undo" id="undo-btn" title="Undo (Ctrl+Z)" ${f.undo.length ? '' : 'disabled'}>${icon('undo')}</button>
          <button type="button" class="btn btn-icon btn-ghost" data-action="redo" id="redo-btn" title="Redo (Ctrl+Shift+Z)" ${f.redo.length ? '' : 'disabled'}>${icon('redo')}</button>` : ''}
        <button type="button" class="btn btn-ghost" data-action="upload">${icon('upload')} Upload</button>
        ${welcome
          ? (f ? `<button type="button" class="btn btn-primary" data-action="open-editor">${icon('arrow')} Open editor</button>` : '')
          : `<button type="button" class="btn btn-primary" data-action="download" id="download-btn">${icon('download')} Download</button>
             ${state.files.length > 1 ? `<button type="button" class="btn btn-ghost btn-icon" data-action="download-all" title="Download all files">${icon('box')}</button>` : ''}`}
      </div>
    </header>`;
  }

  function welcomeHTML() {
    const hasFiles = state.files.length > 0;
    const knownCount = ANIM.filter(a => a.known).length;
    const loaded = hasFiles ? `
      <section class="welcome-section">
        <div class="welcome-section-head">
          <div><h2>Continue editing</h2><p>These saves are loaded in this browser session. Nothing has touched your files on disk.</p></div>
          <span class="num">${state.files.length} FILE${state.files.length === 1 ? '' : 'S'}</span>
        </div>
        <div class="loaded-list">
          ${state.files.map(f => {
            const s = computeStats(f);
            return `<div class="loaded-item">
              <div class="li-icon">${icon(f.kind === 'run' ? 'moon' : f.kind === 'records' ? 'trophy' : 'gamepad')}</div>
              <div class="li-body">
                <b>${esc(f.name)}</b>
                <span>${kindLabel(f.kind)} · ${s.counters.pages || s.counters.night || s.counters.round || ''} · ${f.dirty ? 'unsaved changes' : 'no changes'}</span>
              </div>
              <div class="li-actions">
                <button type="button" class="btn btn-sm btn-primary" data-action="open-file" data-id="${f.id}">Open ${icon('arrow')}</button>
                <button type="button" class="btn btn-sm btn-ghost" data-action="remove-file" data-id="${f.id}" title="Remove">${icon('trash')}</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </section>` : '';

    return `${topbarHTML(true)}
      <main class="welcome" id="main">
        <section class="hero">
          <div class="hero-copy">
            <span class="hero-kicker"><span class="led"></span> Local save tool · v${esc(VERSION_TAG.replace(/^_v?/, ''))}</span>
            <h1><span class="l1">FRICKBEARS 3</span><span class="l2">SAVE EDITOR</span></h1>
            <p class="hero-sub">A no-nonsense editor for your <b>run saves</b>, <b>records</b> and <b>endless data</b>. Unlock the roster, fix your paycheck, skip the grind — right in your browser.</p>
            <div class="hero-badges">
              <span class="tag gold">.wario / .txt</span>
              <span class="tag green">100% local</span>
              <span class="tag blue">No install</span>
              <span class="tag pink">Backups first</span>
            </div>
            <div class="btn-row">
              <button type="button" class="btn btn-primary" data-action="upload">${icon('upload')} Open a save file</button>
              <a class="btn btn-ghost" href="#templates">Start from scratch ${icon('arrow')}</a>
            </div>
          </div>
          <div class="hero-art">
            ${MONITOR_SVG}
            <div class="hero-float f1"><b>202</b> gallery pages</div>
            <div class="hero-float f2"><b>87</b> animatronics</div>
            <div class="hero-float f3"><b>63</b> trophies</div>
          </div>
        </section>

        <button type="button" class="upload-zone" data-action="upload">
          <div class="uz-icon">${icon('upload')}</div>
          <h2>Click here to upload your save</h2>
          <p>Or drag and drop your save files anywhere on this page. Multiple files are welcome.</p>
          <div class="file-kinds">
            <span>savedata${esc(VERSION_TAG)}.wario</span>
            <span>records${esc(VERSION_TAG)}.wario</span>
            <span>endlessdata${esc(VERSION_TAG)}.txt</span>
          </div>
        </button>

        <div class="ticker"><span>BACK UP YOUR SAVES BEFORE EDITING &nbsp;·&nbsp; <b>${knownCount}</b> KNOWN GALLERY PAGES &nbsp;·&nbsp; <b>87</b> BASE ANIMATRONICS &nbsp;·&nbsp; <b>66</b> UPGRADES &nbsp;·&nbsp; <b>16</b> MINIGAMES &nbsp;·&nbsp; <b>63</b> TROPHIES &nbsp;·&nbsp; <b>44</b> CUSTOM NIGHT CHALLENGES &nbsp;·&nbsp; LOCAL ONLY — NOTHING IS UPLOADED</span></div>

        ${loaded}

        <section class="welcome-section" id="templates">
          <div class="welcome-section-head">
            <div><h2>Start from scratch</h2><p>No save file at hand? Create a clean v2.0.0 save and edit it right away. Put the downloaded file in your Frickbears 3 AppData folder.</p></div>
            <span class="num">TEMPLATES</span>
          </div>
          <div class="template-grid">
            <button type="button" class="template-card" data-action="new-template" data-kind="run">
              <div class="tc-top"><span class="tc-icon">${icon('moon')}</span><span class="arrow">${icon('plus')}</span></div>
              <h3>Run save</h3>
              <p>A fresh night-one run: default difficulty, empty paycheck, no upgrades and the standard shuffle pools.</p>
              <span class="tc-file">savedata${esc(VERSION_TAG)}.wario</span>
            </button>
            <button type="button" class="template-card" data-action="new-template" data-kind="records">
              <div class="tc-top"><span class="tc-icon">${icon('trophy')}</span><span class="arrow">${icon('plus')}</span></div>
              <h3>Records</h3>
              <p>Permanent progress only: empty gallery, only the starting unlocks, default settings and today's first-opened date.</p>
              <span class="tc-file">records${esc(VERSION_TAG)}.wario</span>
            </button>
            <button type="button" class="template-card" data-action="new-template" data-kind="endless">
              <div class="tc-top"><span class="tc-icon">${icon('gamepad')}</span><span class="arrow">${icon('plus')}</span></div>
              <h3>Endless data</h3>
              <p>Round one of Four Layers Down: three starter cartridges, full lives and a fresh random seed.</p>
              <span class="tc-file">endlessdata${esc(VERSION_TAG)}.txt</span>
            </button>
          </div>
        </section>

        <section class="welcome-section">
          <div class="welcome-section-head">
            <div><h2>What you can edit</h2><p>Named everything. No guessing which array index means which bear.</p></div>
            <span class="num">FEATURES</span>
          </div>
          <div class="feature-grid">
            <div class="feature">${icon('save')}<b>Run save</b><span>Night, difficulty, route, guard, paycheck, run time, deaths, salvages, masks, scraps and current upgrades.</span></div>
            <div class="feature">${icon('list')}<b>Records</b><span>Gallery pages, death and salvage counters, minigame tokens and high scores, upgrades, trophies and challenges.</span></div>
            <div class="feature">${icon('palette')}<b>Skins & stickers</b><span>Every character skin slot, office skin, randomize toggles and endless-mode sticker levels.</span></div>
            <div class="feature">${icon('settings')}<b>Settings</b><span>Graphics, audio, gameplay, keybinds and shuffle options — with readable labels for every value.</span></div>
          </div>
        </section>

        <section class="welcome-section">
          <div class="banner">
            ${icon('alert')}
            <div class="grow"><b>Back up your saves first.</b> The editor only creates a download; it never writes to your AppData folder by itself. Keep a copy of your original files before replacing anything. Close Frickbears 3 before overwriting a save so the game doesn't write over your edit on exit.</div>
          </div>
        </section>

        <footer class="footer">
          <div class="fcol">
            <b>Frickbear Editor v${APP_VERSION}</b>
            <span>Unofficial fan-made save editor for Frickbears 3 v2.0.0. Not affiliated with 4LD, Scott Cawthon or the Frickbears team. Data tables were extracted from the game's own data.win.</span>
          </div>
          <div class="fcol">
            <b>Privacy</b>
            <span>Files are read with the browser File API and kept in this tab (and your browser's local storage for session restore). Nothing is uploaded. Downloads are generated locally.</span>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost btn-sm" data-action="about">About & credits</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="start-fresh">Clear session</button>
          </div>
        </footer>
      </main>`;
  }

  /* ==========================================================================
     Navigation
     ========================================================================== */

  const NAV = {
    run: [
      { section: 'Run save', items: [
        { page: 'overview', label: 'Overview', icon: 'home' },
        { page: 'run', label: 'Run state', icon: 'moon' },
        { page: 'salvages', label: 'Salvages', icon: 'mask' },
        { page: 'upgrades', label: 'Upgrades', icon: 'upgrade' },
        { page: 'shuffle', label: 'Shuffle data', icon: 'dice' }
      ]},
      { section: 'Advanced', items: [{ page: 'raw', label: 'Raw JSON', icon: 'code' }] }
    ],
    records: [
      { section: 'Records', items: [
        { page: 'overview', label: 'Overview', icon: 'home' },
        { page: 'progression', label: 'Progression', icon: 'chart' }
      ]},
      { section: 'Collection', items: [
        { page: 'animatronics', label: 'Animatronics', icon: 'user' },
        { page: 'upgrades', label: 'Upgrades', icon: 'upgrade' },
        { page: 'minigames', label: 'Minigames', icon: 'gamepad' },
        { page: 'trophies', label: 'Trophies', icon: 'trophy' },
        { page: 'challenges', label: 'Challenges', icon: 'list' }
      ]},
      { section: 'Extras', items: [
        { page: 'guards', label: 'Guards', icon: 'shield' },
        { page: 'skins', label: 'Skins & stickers', icon: 'palette' },
        { page: 'stats', label: 'Endings & stats', icon: 'star' },
        { page: 'settings', label: 'Settings', icon: 'settings' }
      ]},
      { section: 'Advanced', items: [{ page: 'raw', label: 'Raw JSON', icon: 'code' }] }
    ],
    endless: [
      { section: 'Endless save', items: [
        { page: 'overview', label: 'Overview', icon: 'home' },
        { page: 'run', label: 'Run state', icon: 'gamepad' },
        { page: 'inventory', label: 'Inventory', icon: 'box' }
      ]},
      { section: 'Advanced', items: [{ page: 'raw', label: 'Raw JSON', icon: 'code' }] }
    ]
  };

  const PAGE_TITLES = {
    overview: 'Overview', run: 'Run state', salvages: 'Salvages', upgrades: 'Upgrades', shuffle: 'Shuffle data',
    progression: 'Progression', animatronics: 'Animatronics', minigames: 'Minigames', trophies: 'Trophies',
    challenges: 'Challenges', guards: 'Guards', skins: 'Skins & stickers', stats: 'Endings & stats',
    settings: 'Settings', raw: 'Raw JSON', inventory: 'Inventory'
  };

  function navPill(f, page) {
    const s = computeStats(f).counters;
    if (page === 'animatronics') return s.pages;
    if (page === 'minigames') return s.minigames;
    if (page === 'trophies') return s.trophies;
    if (page === 'challenges') return s.challenges;
    if (page === 'guards') return s.guards;
    if (page === 'upgrades') return s.upgrades;
    if (page === 'salvages') return s.salvages;
    if (page === 'skins') return s.stickers;
    return '';
  }

  function sidebarHTML(f) {
    const groups = NAV[f.kind] || NAV.run;
    const stats = computeStats(f);
    return `<aside class="sidebar" aria-label="Editor navigation">
      <nav class="nav">
        ${groups.map(group => `
          <div class="nav-section">${group.section}</div>
          ${group.items.map(item => `<a class="nav-item ${state.page === item.page ? 'active' : ''}" href="#/editor/${f.id}/${item.page}">
            ${icon(item.icon)}
            <span class="label">${item.label}</span>
            ${navPill(f, item.page) ? `<span class="pill">${navPill(f, item.page)}</span>` : ''}
          </a>`).join('')}
        `).join('')}
      </nav>
      <div class="sidebar-foot">
        <div class="sidebar-note"><strong>Back up first.</strong> Downloads replace the file in your AppData folder manually. Close the game before overwriting.</div>
        <div class="sidebar-fileinfo">${esc(f.name)}<br>${kindLabel(f.kind)} · ${fmtInt(byteLength(JSON.stringify(f.data)))} bytes</div>
        <label class="sidebar-toggle" title="Toggle the CRT scanline effect">
          <span>CRT scanlines</span>
          <input type="checkbox" id="crt-toggle" ${state.ui.crt ? 'checked' : ''}>
          <span class="track"></span>
        </label>
        <div class="btn-row">
          <button type="button" class="btn btn-sm btn-ghost" data-action="home">${icon('home')} Home</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="reset-changes" ${f.dirty ? '' : 'disabled'}>${icon('refresh')} Reset</button>
        </div>
        <button type="button" class="btn btn-sm btn-danger" data-action="remove-file" data-id="${f.id}">${icon('trash')} Remove file</button>
      </div>
    </aside>`;
  }

  /* ==========================================================================
     Pages — Run save
     ========================================================================== */

  function pageRunOverview(f) {
    const d = f.data;
    const s = computeStats(f);
    return `${pageHead('Run save · ' + esc(f.name), 'Run overview',
      'Your current playthrough: night, difficulty, route and everything you have salvaged so far.',
      `<button type="button" class="btn btn-sm btn-ghost" data-action="download">${icon('download')} Download</button>`)}

      ${missingBanner(f)}

      <div class="section">${statGrid([
        { l: 'Night', v: esc(nightName(d._Night)), s: `Start: ${esc(roomName(d._StartRoom))}` },
        { l: 'Difficulty', v: esc(diffName(d._Difficulty)), s: `Route: ${esc(routeName(d._Route))}`, cls: 'accent' },
        { l: 'Guard', v: esc(guardName(d._Guard)), s: 'Playable guard' },
        { l: 'Paycheck', v: esc(fmtMoney(d._Paycheck)), s: `Total: ${fmtMoney(d._PaycheckTotal)}`, cls: 'green' },
        { l: 'Run time', v: esc(fmtDurationShort(d._RunTime)), s: `${fmtInt(d._RunTime)} seconds` },
        { l: 'Deaths', v: esc(fmtInt(sum(d._Deaths))), s: 'Across six nights', cls: 'blue' }
      ])}</div>

      <div class="split section">
        <div>${panel('Progress', 'Salvage flags and current loadout', progressRows([
          { key: 'masks', label: 'Masks', v: s.ratios.masks.v, t: 4 },
          { key: 'scraps', label: 'Scraps', v: s.ratios.scraps.v, t: 4 },
          { key: 'runMinigames', label: 'Minigames', v: s.ratios.runMinigames.v, t: s.ratios.runMinigames.t, cls: 'blue' },
          { key: 'upgrades', label: 'Upgrades', v: s.ratios.upgrades.v, t: s.ratios.upgrades.t, cls: 'green' }
        ]))}</div>
        <div>${panel('Quick actions', 'Bulk edits apply instantly and can be undone', `
          <div class="btn-row">
            ${bulkButton('Max paycheck', 'run-max-paycheck', { cls: 'btn-gold' })}
            ${bulkButton('Complete salvage flags', 'run-complete-salvage')}
            ${bulkButton('Add all upgrades', 'run-all-upgrades')}
            ${bulkButton('Clear upgrades', 'run-clear-upgrades')}
            ${bulkButton('Reset deaths', 'run-clear-deaths')}
            ${bulkButton('Jump to Night 6', 'run-night-six')}
            ${bulkButton('Allow continue', 'run-can-continue')}
            ${bulkButton('Add all enemies to salvages', 'run-all-salvages')}
            ${bulkButton('Clear salvages', 'run-clear-salvages', { cls: 'btn-danger' })}
          </div>
          <p class="inline-note mt-2">“Add all upgrades” writes every upgrade ID into this run; the game may apply overlapping upgrades at once. Use with care.</p>
        `)}</div>
      </div>

      <div class="section">${panel('Run details', 'Parsed from savedata' + esc(VERSION_TAG) + '.wario', `<div class="kv-list">
        <div class="kv"><span class="k">Start room</span><span class="v">${esc(roomName(d._StartRoom))} (#${esc(d._StartRoom)})</span></div>
        <div class="kv"><span class="k">Shuffle mode</span><span class="v">${d._ShuffleMode ? 'On' : 'Off'}</span></div>
        <div class="kv"><span class="k">Can continue</span><span class="v">${d._CanContinue ? 'Yes' : 'No'}</span></div>
        <div class="kv"><span class="k">Salvaged animatronics</span><span class="v">${fmtInt(len(d._Salvages))}</span></div>
        <div class="kv"><span class="k">Current upgrades</span><span class="v">${fmtInt(len(d._Upgrades))}</span></div>
        <div class="kv"><span class="k">Deaths by night</span><span class="v">${(d._Deaths || []).map((v, i) => `N${i + 1}: ${fmtInt(v)}`).join(' · ') || '—'}</span></div>
        <div class="kv"><span class="k">Shuffle phone calls</span><span class="v">${fmtInt(len(d._ShuffleData?.PhoneCalls))}</span></div>
      </div>`)}</div>
    `;
  }

  function pageRunState(f) {
    const d = f.data;
    const nightOptions = [1, 2, 3, 4, 5, 6].map(n => ({ value: n, label: META.nightLabels[n - 1] }));
    if (typeof d._Night === 'string' && !/^\d+$/.test(d._Night)) nightOptions.push({ value: d._Night, label: nightName(d._Night) });
    if (d._Night === 'Custom') nightOptions.push({ value: 'Custom', label: 'Custom Night' });

    const diffOptions = META.difficulties.map((name, i) => ({ value: i, label: `${i} — ${name}` }));
    const routeOptions = META.routes.map(r => ({ value: r.id, label: `${r.id} — ${r.name}` }));
    const guardOptions = META.guards.map((name, i) => ({ value: i, label: `${i} — ${name}` }));
    if (num(d._Guard) >= META.guards.length) guardOptions.push({ value: d._Guard, label: `Guard #${d._Guard}` });
    const roomOptions = ROOMS.map(r => ({ value: r.id, label: `${r.name} (#${r.id})` }));

    return `${pageHead('Run save · Run state', 'Run state', 'Core values stored in the current run save. Changes are written into the JSON exactly as shown.')}
      <div class="section">${panel('Night & route', 'What the game reads on “Continue”', `
        <div class="fields cols-3">
          ${field('Night', '_Night', d._Night, { type: 'select', options: nightOptions, coerce: 'night', hint: 'Night 6 is the boss night. Custom is used by boss rematches.' })}
          ${field('Difficulty', '_Difficulty', d._Difficulty, { type: 'select', options: diffOptions, hint: 'Nightmare is normally endless-mode only.' })}
          ${field('Route', '_Route', d._Route, { type: 'select', options: routeOptions, hint: 'Good / Evil / Money / Ultimate endings.' })}
          ${field('Guard', '_Guard', d._Guard, { type: 'select', options: guardOptions, hint: 'Guard roster index. Extra addon guards appear after #20.' })}
          ${field('Start room', '_StartRoom', d._StartRoom, { type: 'select', options: roomOptions, hint: 'Room the game returns to when continuing.' })}
          ${field('Can continue', '_CanContinue', d._CanContinue, { type: 'select', options: [{ value: false, label: 'No' }, { value: true, label: 'Yes' }], coerce: 'bool', hint: 'Shows “Continue” on the title screen.' })}
        </div>
        <div class="divider"></div>
        <div class="fields cols-3">
          ${switchRow('Shuffle mode', 'Randomize animatronics, minigames, locations and calls', '_ShuffleMode', !!d._ShuffleMode)}
          ${switchRow('Can continue', 'Duplicate toggle for convenience', '_CanContinue', !!d._CanContinue)}
        </div>
      `)}</div>

      <div class="section">${panel('Paycheck & time', 'Values are raw numbers; money uses two decimals', `
        <div class="fields cols-3">
          ${field('Paycheck', '_Paycheck', d._Paycheck, { step: '0.01', min: 0, hint: 'Current run earnings in tokens.' })}
          ${field('Paycheck total', '_PaycheckTotal', d._PaycheckTotal, { step: '0.01', min: 0, hint: 'Lifetime earnings for this run.' })}
          ${field('Run time', '_RunTime', d._RunTime, { step: '0.1', min: 0, hint: `Formatted: <b data-format="_RunTime" data-format-kind="time">${esc(fmtDuration(d._RunTime))}</b>` })}
        </div>
      `)}</div>

      <div class="section">${panel('Deaths', 'Death counters per night (six entries)', `
        <div class="fields cols-3">
          ${(d._Deaths || []).map((v, i) => field(META.deathLabels[i] || `Night ${i + 1}`, `_Deaths.${i}`, v, { min: 0, step: '1' })).join('')}
        </div>
        <p class="inline-note mt-2">Total deaths: <b>${fmtInt(sum(d._Deaths))}</b>. These are per-run counters, not the permanent death record.</p>
      `)}</div>
    `;
  }

  function pageSalvages(f) {
    const d = f.data;
    const salvages = d._Salvages || [];
    const masks = d._Masks || [];
    const scraps = d._Scraps || [];
    const minis = d._Minigames || [];
    const chips = salvages.map((id, i) => {
      const a = ANIM_BY_ID.get(num(id));
      return `<span class="chip">${a ? esc(a.name) : `#${esc(id)}`}<button type="button" class="x" data-action="remove-array-item" data-path="_Salvages" data-index="${i}" title="Remove">×</button></span>`;
    }).join('');

    return `${pageHead('Run save · Salvages', 'Salvages', 'Which animatronics have been salvaged in this run, plus the mask, scrap and minigame flags.')}
      <div class="section">${panel('Salvaged animatronics', `${salvages.length} entries · this is the run's all-time salvage roster`,
        `<div class="chips">${chips || '<span class="inline-note">No animatronics salvaged yet.</span>'}</div>
         <div class="btn-row mt-2">
           <button type="button" class="btn btn-sm" data-action="open-picker" data-picker="salvages">${icon('plus')} Edit salvage list</button>
           ${bulkButton('All enemies', 'run-all-salvages')}
           ${bulkButton('Clear', 'run-clear-salvages', { cls: 'btn-danger' })}
         </div>`, ``, { tight: false })}</div>

      <div class="split section">
        <div>${panel('Masks', 'Four mask salvage flags', `<div class="stack">${range(4).map(i => switchRow(META.salvageSlots[i] || `Mask ${i + 1}`, 'Salvaged mask in this slot', `_Masks.${i}`, !!masks[i])).join('')}</div>`, bulkButton('Complete all', 'run-complete-salvage'))}</div>
        <div>${panel('Scraps', 'Four scrap salvage flags', `<div class="stack">${range(4).map(i => switchRow(META.scrapSlots[i] || `Scrap ${i + 1}`, 'Salvaged scrap in this slot', `_Scraps.${i}`, !!scraps[i])).join('')}</div>`, bulkButton('Complete all', 'run-complete-salvage'))}</div>
      </div>

      <div class="section">${panel('Minigame salvage flags', 'Five location slots (index 0–4)', `<div class="stack">${range(Math.max(5, minis.length)).map(i => switchRow(META.runMinigameSlots[i] || `Location ${i + 1}`, 'Minigame already salvaged at this location', `_Minigames.${i}`, !!minis[i])).join('')}</div>`, bulkButton('Complete all', 'run-complete-salvage'))}</div>
    `;
  }

  function pageRunUpgrades(f) {
    const d = f.data;
    const ids = d._Upgrades || [];
    const rows = ids.map((id, i) => {
      const u = UPGRADE_BY_ID.get(num(id));
      return `<div class="row-item">
        <span class="idx">#${esc(id)}</span>
        <div class="body">
          <div class="title">${u ? esc(u.name) : `Upgrade #${esc(id)}`} ${u && u.price ? `<span class="tag gold">${fmtInt(u.price)} tokens</span>` : ''}</div>
          <div class="desc">${u ? esc(u.desc) : 'Unknown upgrade id.'}</div>
        </div>
        <div class="side"><button type="button" class="btn btn-sm btn-danger" data-action="remove-array-item" data-path="_Upgrades" data-index="${i}">${icon('trash')}</button></div>
      </div>`;
    }).join('');

    return `${pageHead('Run save · Upgrades', 'Current run upgrades', 'Upgrades owned during this run. These are consumed/applied by the game on continue.')}
      <div class="section">${panel(`Owned upgrades (${ids.length})`, 'Stored in _Upgrades', `
        ${ids.length ? `<div class="rows">${rows}</div>` : emptyState('No upgrades owned in this run.')}
        <div class="btn-row mt-2">
          <button type="button" class="btn" data-action="open-picker" data-picker="upgrades">${icon('plus')} Add upgrades</button>
          ${bulkButton('Add every upgrade', 'run-all-upgrades', { cls: 'btn-gold' })}
          ${bulkButton('Remove all', 'run-clear-upgrades', { cls: 'btn-danger' })}
        </div>
      `)}</div>
      <div class="section">${panel('About upgrades', 'How the game treats them', `<p class="inline-note">Upgrades are stored as numeric IDs (0–65). Tiered upgrades replace each other in normal play; this editor does not enforce the chain, so owning both “Overcharge” and “Overcharge+” is possible and may stack or behave oddly.</p>`)}</div>
    `;
  }

  function pageShuffle(f) {
    const d = f.data;
    const sd = d._ShuffleData || {};
    const calls = sd.PhoneCalls || [];
    const locations = sd.Locations || [];
    const callChips = calls.map((id, i) => `<span class="chip">${esc(phoneName(id))}<button type="button" class="x" data-action="remove-array-item" data-path="_ShuffleData.PhoneCalls" data-index="${i}">×</button></span>`).join('');
    const locOptions = [12, 13, 14, 15, 16].map(id => ({ value: id, label: `${roomName(id)} (#${id})` }));

    return `${pageHead('Run save · Shuffle data', 'Shuffle data', 'Used when Shuffle Mode is enabled: call order, location order and the shuffled animatronic/minigame pools.')}
      <div class="section">${panel('Phone calls', `${calls.length} calls in the shuffle pool`, `
        <div class="chips">${callChips || '<span class="inline-note">Empty call pool.</span>'}</div>
        <div class="btn-row mt-2">
          <button type="button" class="btn btn-sm" data-action="open-picker" data-picker="phonecalls">${icon('plus')} Add calls</button>
          ${bulkButton('Clear pool', 'run-clear-phonecalls', { cls: 'btn-danger' })}
          ${bulkButton('Restore default pool', 'run-reset-phonecalls')}
        </div>
        <p class="inline-note mt-2">These are voice-asset IDs. The game normally removes the tutorial call once heard and may insert it at the front of the pool.</p>
      `)}</div>

      <div class="section">${panel('Location order', 'Five minigame maze rooms', `<div class="fields cols-3">
        ${range(5).map(i => field(`Slot ${i + 1}`, `_ShuffleData.Locations.${i}`, locations[i] ?? 12 + i, { type: 'select', options: locOptions, hint: `Currently ${esc(roomName(locations[i]))}` })).join('')}
      </div>`)}</div>

      <div class="split section">
        <div>${panel('Minigame order', 'Permutation of minigame IDs 0–15', listEditor('_ShuffleData.Minigames', sd.Minigames, 16))}</div>
        <div>${panel('Animatronic order', 'Permutation of animatronic IDs 0–86', listEditor('_ShuffleData.Animatronics', sd.Animatronics, 87))}</div>
      </div>
    `;
  }

  function listEditor(path, arr, expected) {
    const text = (arr || []).join(', ');
    return `<div class="field">
      <span class="field-label">Comma-separated IDs <span class="suffix">${len(arr)} / ${expected}</span></span>
      <textarea id="list-${esc(path)}" data-list-path="${esc(path)}" rows="5" spellcheck="false">${esc(text)}</textarea>
      <span class="hint">Order matters. Duplicates are allowed by the game but can break the shuffle pool.</span>
    </div>
    <div class="btn-row mt-1">
      <button type="button" class="btn btn-sm" data-action="apply-list" data-path="${esc(path)}" data-len="${expected}">Apply list</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="randomize-list" data-path="${esc(path)}" data-max="${expected - 1}">Randomize</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="reset-list" data-path="${esc(path)}" data-max="${expected - 1}">Reset order</button>
    </div>`;
  }

  /* ==========================================================================
     Pages — Records
     ========================================================================== */

  function pageRecordsOverview(f) {
    const d = f.data;
    const s = computeStats(f);
    return `${pageHead('Records · ' + esc(f.name), 'Overview', 'Permanent progress for Frickbears 3: gallery pages, records, unlocks and statistics.',
      `<button type="button" class="btn btn-sm btn-ghost" data-action="download">${icon('download')} Download</button>`)}

      ${missingBanner(f)}

      <div class="section">${statGrid([
        { l: 'Playtime', v: esc(fmtDurationShort(d._Playtime)), s: `${fmtInt(d._Playtime)} seconds` },
        { l: 'Gallery pages', v: esc(s.counters.pages), s: 'Known characters', cls: 'accent' },
        { l: 'Minigames', v: esc(s.counters.minigames), s: 'Cartridge collection', cls: 'blue' },
        { l: 'Trophies', v: esc(s.counters.trophies), s: 'Achievements', cls: 'green' },
        { l: 'Challenges', v: esc(s.counters.challenges), s: 'Custom night', cls: 'accent' },
        { l: 'Guards', v: esc(s.counters.guards), s: 'Four Layers Down' }
      ])}</div>

      <div class="split section">
        <div>${panel('Completion', 'Everything the completionist in you needs', progressRows([
          { key: 'pages', label: 'Gallery pages', v: s.ratios.pages.v, t: s.ratios.pages.t },
          { key: 'enemies', label: 'Base animatronics', v: s.ratios.enemies.v, t: 87 },
          { key: 'minigames', label: 'Minigames', v: s.ratios.minigames.v, t: s.ratios.minigames.t, cls: 'blue' },
          { key: 'trophies', label: 'Trophies', v: s.ratios.trophies.v, t: s.ratios.trophies.t, cls: 'green' },
          { key: 'challenges', label: 'Challenges', v: s.ratios.challenges.v, t: s.ratios.challenges.t },
          { key: 'guards', label: 'Guards', v: s.ratios.guards.v, t: 21, cls: 'blue' },
          { key: 'stickers', label: 'Stickers', v: s.ratios.stickers.v, t: 87, cls: 'green' },
          { key: 'endings', label: 'Endings', v: s.ratios.endings.v, t: 5 }
        ]))}</div>
        <div>${panel('Quick actions', 'Bulk edits are undoable', `
          <div class="btn-row">
            ${bulkButton('Unlock all animatronics', 'rec-unlock-anim', { cls: 'btn-gold' })}
            ${bulkButton('Unlock all minigames', 'rec-unlock-minigames')}
            ${bulkButton('Unlock all trophies', 'rec-unlock-trophies')}
            ${bulkButton('Complete all challenges', 'rec-complete-challenges')}
            ${bulkButton('Unlock all guards', 'rec-unlock-guards')}
            ${bulkButton('Unlock all upgrades', 'rec-unlock-upgrades')}
            ${bulkButton('Max all stickers', 'rec-max-stickers')}
            ${bulkButton('Unlock all endings', 'rec-unlock-endings')}
            ${bulkButton('Max tokens & scores', 'rec-max-scores')}
            ${bulkButton('Clear death record', 'rec-clear-deaths', { cls: 'btn-danger' })}
          </div>
          <div class="divider"></div>
          <div class="btn-row">
            ${bulkButton('Everything (max)', 'rec-unlock-all', { cls: 'btn-primary' })}
            ${bulkButton('Reset records to template', 'rec-clear-all', { cls: 'btn-danger' })}
          </div>
          <p class="inline-note mt-2">Unlocking gallery pages does not retroactively award their trophies. The game recalculates completion trophies when you visit Extras.</p>
        `)}</div>
      </div>

      <div class="section">${panel('File facts', 'From the records save', `<div class="kv-list">
        <div class="kv"><span class="k">First opened</span><span class="v">${esc(d._GameFirstOpened || '—')}</span></div>
        <div class="kv"><span class="k">Tip number</span><span class="v">${fmtInt(d._TipNum)}</span></div>
        <div class="kv"><span class="k">Unlock flags</span><span class="v">${fmtInt(len(d._UnlockFlags))}</span></div>
        <div class="kv"><span class="k">Tokens earned</span><span class="v">${fmtInt(sum(d._TokensPerMinigame))}</span></div>
        <div class="kv"><span class="k">Best speed</span><span class="v">${esc(fmtDuration(d._RunSpeedBest))}</span></div>
        <div class="kv"><span class="k">Best earnings</span><span class="v">${fmtMoney(d._RunEarningsBest)}</span></div>
        <div class="kv"><span class="k">Fresh save</span><span class="v">${d._FreshSave ? 'Yes' : 'No'}</span></div>
      </div>`)}</div>
    `;
  }

  function pageProgression(f) {
    const d = f.data;
    const flags = d._UnlockFlags || [];
    return `${pageHead('Records · Progression', 'Progression', 'General progress values, story flags, fun value and completion records.')}
      <div class="section">${panel('General', 'Stored at the top level of records', `<div class="fields cols-3">
        ${field('Playtime', '_Playtime', d._Playtime, { step: '0.1', min: 0, hint: `Formatted: <b data-format="_Playtime" data-format-kind="time">${esc(fmtDuration(d._Playtime))}</b>` })}
        ${field('Best run speed', '_RunSpeedBest', d._RunSpeedBest, { step: '0.1', min: 0, hint: 'Lower is better. 999999 means unset.' })}
        ${field('Best run earnings', '_RunEarningsBest', d._RunEarningsBest, { step: '0.01', min: 0, hint: 'Highest single-run paycheck.' })}
        ${field('Tip number', '_TipNum', d._TipNum, { min: 0, step: '1' })}
        ${field('First opened', '_GameFirstOpened', d._GameFirstOpened, { type: 'text', hint: 'Free-form date string written by the game.' })}
        ${switchRow('Fresh save', 'Cleared when the player starts progressing', '_FreshSave', !!d._FreshSave)}
      </div>`)}</div>

      <div class="split section">
        <div>${panel('Fun value', 'Two random values used for easter eggs', `<div class="fields cols-2">
          ${field('Fun value 0', '_FunValue.0', d._FunValue?.[0], { min: 0, max: 99, hint: '0–99' })}
          ${field('Fun value 1', '_FunValue.1', d._FunValue?.[1], { type: 'select', options: [179, 283, 421, 547, 673, 811], hint: 'One of the game’s primes.' })}
        </div>`)}</div>
        <div>${panel('Debug shortcuts', 'Bulk adjustments', `
          <div class="btn-row">
            ${bulkButton('Set playtime 100h', 'rec-playtime-100h')}
            ${bulkButton('Set speed record 0', 'rec-speed-zero')}
            ${bulkButton('Set earnings record 99999', 'rec-earnings-max')}
            ${bulkButton('Mark all notifications seen', 'rec-notifs-seen')}
            ${bulkButton('Mark all notifications unseen', 'rec-notifs-unseen')}
          </div>
        `)}</div>
      </div>

      <div class="section">${panel(`Unlock flags (${flags.length})`, 'Story / ending flags stored as strings', `
        <div class="chips">${flags.map((v, i) => `<span class="chip">${esc(v)}<button type="button" class="x" data-action="remove-array-item" data-path="_UnlockFlags" data-index="${i}">×</button></span>`).join('') || '<span class="inline-note">No flags.</span>'}</div>
        <div class="flex mt-2">
          <input type="text" id="flag-input" placeholder="Add a flag, e.g. FredbearMode" style="flex:1;min-width:200px" autocomplete="off">
          <button type="button" class="btn btn-sm" data-action="add-flag">${icon('plus')} Add flag</button>
        </div>
        <div class="chips mt-2">
          ${META.unlockFlags.map(flag => `<button type="button" class="chip plain" data-action="add-known-flag" data-flag="${esc(flag)}" style="cursor:pointer">${esc(flag)}</button>`).join('')}
        </div>
        <p class="inline-note mt-2">Flags are checked with <code>array_contains</code>; duplicates are harmless but pointless. Adding a flag does not set the matching completion value elsewhere.</p>
      `)}</div>
    `;
  }

  function pageAnimatronics(f) {
    const d = f.data;
    const tab = state.subTab.animatronics || 'pages';
    const current = d._UnlockedAnimatronics || [];
    const deaths = d._DeathRecord || [];
    const salvages = d._SalvageRecord || [];
    const gridId = 'anim-' + tab;

    let items;
    if (tab === 'pages') items = ANIM.map(a => entryToggle(a, !!current[a.id], `_UnlockedAnimatronics.${a.id}`));
    else if (tab === 'deaths') items = ANIM.map(a => entryNumber(a, deaths[a.id] ?? 0, `_DeathRecord.${a.id}`, { min: 0, meta: 'deaths' }));
    else items = ANIM.map(a => entryNumber(a, salvages[a.id] ?? 0, `_SalvageRecord.${a.id}`, { min: 0, meta: 'salvages' }));

    const titles = { pages: 'Gallery pages', deaths: 'Death record', salvages: 'Salvage record' };
    const subs = {
      pages: 'Unlocked character pages in Extras. 202 slots exist; some are placeholders or hidden story entries.',
      deaths: 'Permanent number of times each character has killed you. Shown in Extras → Statistics.',
      salvages: 'Permanent number of times each character has been successfully salvaged.'
    };
    const actions = tab === 'pages'
      ? `${bulkButton('Unlock all', 'rec-unlock-anim', { cls: 'btn-gold' })}${bulkButton('Lock all', 'rec-lock-anim', { cls: 'btn-danger' })}`
      : tab === 'deaths'
        ? `${bulkButton('Clear all deaths', 'rec-clear-deaths', { cls: 'btn-danger' })}`
        : `${bulkButton('Clear all salvages', 'rec-clear-salvage-record', { cls: 'btn-danger' })}${bulkButton('Set all to 1', 'rec-salvage-one')}`;

    return `${pageHead('Records · Collection', 'Animatronics', 'Every gallery page, death counter and salvage counter in the permanent records.')}
      ${tabsHTML('animatronics', tab, [['pages', 'Gallery pages'], ['deaths', 'Death record'], ['salvages', 'Salvage record']])}
      <div class="section">${panel(titles[tab], subs[tab], gridToolbar(gridId, `Search ${tab === 'pages' ? 'animatronics' : tab}…`, true) + `<div class="entries" data-grid="${gridId}">${items.join('')}</div>`, actions)}</div>
      <div class="section">${panel('Notes', 'How these arrays are used', `<div class="kv-list">
        <div class="kv"><span class="k">Gallery slots</span><span class="v">202 (index 0–201)</span></div>
        <div class="kv"><span class="k">Known/described slots</span><span class="v">${ANIM.filter(a => a.known).length}</span></div>
        <div class="kv"><span class="k">Base game enemies</span><span class="v">87 (index 0–86)</span></div>
        <div class="kv"><span class="k">Unlocked pages</span><span class="v">${computeStats(f).counters.pages}</span></div>
      </div>`)}</div>
    `;
  }

  function pageUpgradesRecords(f) {
    const d = f.data;
    const arr = d._UpgradeRecord || [];
    const items = UPGRADES.map(u => entryToggle({ id: u.id, name: u.name, desc: u.desc, role: 'Other', known: true, salvageValue: null }, !!arr[u.id], `_UpgradeRecord.${u.id}`));
    return `${pageHead('Records · Collection', 'Upgrades', 'Permanent “owned at least once” flags for every upgrade in the game.')}
      <div class="section">${panel('Upgrade record', `${countTruthy(arr)} of ${UPGRADES.length} unlocked`, gridToolbar('upg-rec', 'Search upgrades…', false) + `<div class="entries wide" data-grid="upg-rec">${items.join('')}</div>`,
        `${bulkButton('Unlock all', 'rec-unlock-upgrades', { cls: 'btn-gold' })}${bulkButton('Lock all', 'rec-lock-upgrades', { cls: 'btn-danger' })}`)}</div>
    `;
  }

  function pageMinigames(f) {
    const d = f.data;
    const unlocked = d._UnlockedMinigames || [];
    const tokens = d._TokensPerMinigame || [];
    const scores = d._HiScoresOverall || [];
    const slots = range(30);
    const items = slots.map(i => {
      const known = MINIGAME_BY_ID.get(i);
      const a = { id: i, name: known ? known.name : `Reserved slot #${i}`, desc: known ? known.desc : '', role: known ? 'Other' : 'Other', known: !!known };
      return entryToggle(a, !!unlocked[i], `_UnlockedMinigames.${i}`);
    });
    const tokenFields = slots.map(i => field(MINIGAME_BY_ID.get(i)?.name || `Slot #${i}`, `_TokensPerMinigame.${i}`, tokens[i] ?? 0, { min: 0, step: '1' })).join('');
    const scoreFields = slots.map(i => field(MINIGAME_BY_ID.get(i)?.name || `Slot #${i}`, `_HiScoresOverall.${i}`, scores[i] ?? 0, { min: 0, step: '0.1', hint: MINIGAME_BY_ID.get(i)?.timer ? 'Timer-based score' : '' })).join('');

    return `${pageHead('Records · Collection', 'Minigames', 'Cartridge unlocks, token totals and personal bests for each minigame slot.')}
      <div class="section">${panel('Unlocked minigames', `${computeStats(f).counters.minigames} unlocked`, gridToolbar('minigames', 'Search minigames…', false) + `<div class="entries" data-grid="minigames">${items.join('')}</div>`,
        `${bulkButton('Unlock all', 'rec-unlock-minigames', { cls: 'btn-gold' })}${bulkButton('Lock all', 'rec-lock-minigames', { cls: 'btn-danger' })}`)}</div>
      <div class="split section">
        <div>${panel('Tokens earned', 'Per minigame (best/total as stored)', `<div class="fields cols-2">${tokenFields}</div>`, `${bulkButton('Max tokens', 'rec-max-tokens')}${bulkButton('Reset', 'rec-clear-tokens', { cls: 'btn-danger' })}`)}</div>
        <div>${panel('High scores', 'Raw score values', `<div class="fields cols-2">${scoreFields}</div>`, `${bulkButton('Max scores', 'rec-max-scores')}${bulkButton('Reset', 'rec-clear-scores', { cls: 'btn-danger' })}`)}</div>
      </div>
      <div class="section">${panel('Slots 16–29', 'Reserved / future minigame slots', `<p class="inline-note">Only slots 0–15 correspond to real minigames in v2.0.0. The records file still allocates 30 entries; slots 16–29 are unused by the game.</p>`)}</div>
    `;
  }

  function pageTrophies(f) {
    const d = f.data;
    const arr = d._UnlockedTrophies || [];
    const items = TROPHIES.map(t => entryToggle({ id: t.id, name: t.name, desc: '', role: 'Other', known: true }, !!arr[t.id], `_UnlockedTrophies.${t.id}`));
    return `${pageHead('Records · Collection', 'Trophies', 'All 63 trophy flags, with their real in-game names.')}
      <div class="section">${panel('Trophies', `${countTruthy(arr)} of ${TROPHIES.length} unlocked`, gridToolbar('trophies', 'Search trophies…', false) + `<div class="entries wide" data-grid="trophies">${items.join('')}</div>`,
        `${bulkButton('Unlock all', 'rec-unlock-trophies', { cls: 'btn-gold' })}${bulkButton('Lock all', 'rec-lock-trophies', { cls: 'btn-danger' })}`)}</div>
      <div class="section">${panel('Notes', '', `<p class="inline-note">Trophy IDs 42–46 and 61–62 are special completion trophies and are excluded from the “regular trophies” completion counter by the game. Unlocking them directly is still allowed.</p>`)}</div>
    `;
  }

  function pageChallenges(f) {
    const d = f.data;
    const arr = d._ClearedChallenges || [];
    const cats = [...new Set(CHALLENGES.map(c => c.category))];
    const tierOptions = META.customChallengeTiers.map((name, i) => ({ value: i, label: `${i} — ${name}` }));
    const rowsFor = (list) => list.map(c => `<div class="row-item">
      <span class="idx">#${c.id}</span>
      <div class="body"><div class="title">${esc(c.name)}</div><div class="desc">${esc(c.desc)}</div></div>
      <div class="side"><span class="pick"><select data-path="_ClearedChallenges.${c.id}" data-type="select" data-coerce="number">${optionList(tierOptions, arr[c.id] ?? 0)}</select></span></div>
    </div>`).join('');

    const reserved = range(6).map(i => 44 + i).filter(id => !CHALLENGES.some(c => c.id === id));
    const reservedRows = reserved.map(id => `<div class="row-item">
      <span class="idx">#${id}</span>
      <div class="body"><div class="title">Reserved challenge slot #${id}</div><div class="desc">Unused by v2.0.0.</div></div>
      <div class="side"><span class="pick"><select data-path="_ClearedChallenges.${id}" data-type="select" data-coerce="number">${optionList(tierOptions, arr[id] ?? 0)}</select></span></div>
    </div>`).join('');

    return `${pageHead('Records · Collection', 'Challenges', 'Custom Night preset completion. Tier 1 is a clear, 2 adds No Death Coin, 3 adds No Power-Ups.')}
      ${cats.map(cat => `<div class="section">${panel(cat, `${CHALLENGES.filter(c => c.category === cat).length} presets`, `<div class="rows">${rowsFor(CHALLENGES.filter(c => c.category === cat))}</div>`)}</div>`).join('')}
      <div class="section">${panel('Reserved slots', 'IDs 44–49', `<div class="rows">${reservedRows}</div>`)}</div>
      <div class="section">${panel('Bulk actions', '', `<div class="btn-row">
        ${bulkButton('Complete all (max tier)', 'rec-complete-challenges', { cls: 'btn-gold' })}
        ${bulkButton('Clear all', 'rec-clear-challenges', { cls: 'btn-danger' })}
      </div>`)}</div>
    `;
  }

  function pageGuards(f) {
    const d = f.data;
    const arr = d._UnlockedGuards || [];
    const stateOptions = META.guardStates.map((name, i) => ({ value: i, label: name }));
    const items = range(30).map(i => {
      const name = META.guards[i] || `Addon guard slot #${i}`;
      const a = { id: i, name, desc: '', role: 'Guard', known: i < 21 };
      return `<div class="entry ${num(arr[i]) > 0 ? 'on' : ''}" data-search="${esc((name + ' ' + i).toLowerCase())}" data-role="Guard" data-known="${i < 21 ? 1 : 0}">
        <span class="info"><span class="name">${esc(name)}</span><span class="meta">Guard #${i}${i < 21 ? '' : ' · addon slot'}</span></span>
        <span class="pick"><select data-path="_UnlockedGuards.${i}" data-type="select" data-coerce="number">${optionList(stateOptions, arr[i] ?? 0)}</select></span>
      </div>`;
    });
    return `${pageHead('Records · Extras', 'Guards', 'Four Layers Down guard unlocks. State 2 is the “Funny” costume, 3 means both normal and funny are available.')}
      <div class="section">${panel('Guard roster', `${computeStats(f).counters.guards} of 21 unlocked`, gridToolbar('guards', 'Search guards…', false) + `<div class="entries wide" data-grid="guards">${items.join('')}</div>`,
        `${bulkButton('Unlock all', 'rec-unlock-guards', { cls: 'btn-gold' })}${bulkButton('Lock all', 'rec-lock-guards', { cls: 'btn-danger' })}`)}</div>
      <div class="section">${panel('Runs attempted & won', '21 guards × 5 difficulties', `
        <details class="disclosure"><summary>Runs attempted</summary><div class="inner">${matrixHTML({
          path: '_RunsAttempted',
          rowLabels: range(21).map(i => META.guards[i] || `Guard #${i}`),
          colLabels: ['Easy', 'Normal', 'Hard', 'Lunatic', 'Endless'],
          valueOf: (r, c) => d._RunsAttempted?.[r]?.[c] ?? 0
        })}</div></details>
        <details class="disclosure"><summary>Runs won</summary><div class="inner">${matrixHTML({
          path: '_RunsWon',
          rowLabels: range(21).map(i => META.guards[i] || `Guard #${i}`),
          colLabels: ['Easy', 'Normal', 'Hard', 'Lunatic', 'Endless'],
          valueOf: (r, c) => d._RunsWon?.[r]?.[c] ?? 0
        })}</div></details>
      `)}</div>
    `;
  }

  function pageSkins(f) {
    const d = f.data;
    const skins = d._Skins || [];
    const stickers = d._EndlessStickers || [];
    const guardStickers = d._EndlessGuardStickers || [];
    const items = ANIM.map(a => `<div class="entry ${a.known === false ? 'unknown' : ''}" data-search="${esc((a.name + ' ' + a.role + ' ' + a.id).toLowerCase())}" data-role="${esc(a.role || 'Other')}" data-known="${a.known ? 1 : 0}">
      <span class="info"><span class="name">${esc(a.name)}</span><span class="meta">${esc(a.role || '')} · default = -1</span></span>
      <input class="num" type="number" min="-1" data-path="_Skins.${a.id}" data-type="number" value="${esc(skins[a.id] ?? -1)}" autocomplete="off">
    </div>`);

    const stickerOptions = [{ value: -1, label: 'None' }, ...range(5).map(i => ({ value: i, label: `Difficulty ${i}` }))];
    const stickerItems = ANIM.filter(a => a.id <= 86 || a.known).map(a => `<div class="entry ${num(stickers[a.id], -1) > -1 ? 'on' : ''}" data-search="${esc((a.name + ' ' + a.role).toLowerCase())}" data-role="${esc(a.role || 'Other')}" data-known="${a.known ? 1 : 0}">
      <span class="info"><span class="name">${esc(a.name)}</span><span class="meta">Endless sticker level</span></span>
      <span class="pick"><select data-path="_EndlessStickers.${a.id}" data-type="select" data-coerce="number">${optionList(stickerOptions, stickers[a.id] ?? -1)}</select></span>
    </div>`);
    const guardStickerItems = range(40).map(i => `<div class="entry ${num(guardStickers[i], -1) > -1 ? 'on' : ''}" data-search="${esc((META.guards[i] || 'addon guard ' + i).toLowerCase())}" data-role="Guard" data-known="${i < 21 ? 1 : 0}">
      <span class="info"><span class="name">${esc(META.guards[i] || `Addon guard slot #${i}`)}</span><span class="meta">Guard sticker level</span></span>
      <span class="pick"><select data-path="_EndlessGuardStickers.${i}" data-type="select" data-coerce="number">${optionList(stickerOptions, guardStickers[i] ?? -1)}</select></span>
    </div>`);

    return `${pageHead('Records · Extras', 'Skins & stickers', 'Custom skin indices and endless-mode sticker difficulties.')}
      <div class="section">${panel('Skin settings', 'Custom skins live in the game’s skins folder', `<div class="fields cols-3">
        ${field('Office skin', '_SkinOffice', d._SkinOffice, { min: -1, hint: '-1 = default office' })}
        ${switchRow('Randomize character skins', 'Picks a random owned skin each night', '_RandomizeSkins', !!d._RandomizeSkins)}
        ${switchRow('Randomize office skin', 'Picks a random office skin each night', '_RandomizeOffice', !!d._RandomizeOffice)}
      </div>
      <div class="btn-row mt-2">${bulkButton('Reset all skins to default', 'rec-reset-skins', { cls: 'btn-danger' })}</div>
      <p class="inline-note mt-2">Skin IDs are numeric folder indices from <code>%LOCALAPPDATA%/Frickbears3/skins</code>, starting at 0. -1 means the default skin. Office skins use the <code>offices</code> folder.</p>`)}</div>

      <div class="section">${panel('Character skins', `${len(skins)} slots`, gridToolbar('skins', 'Search characters…', true) + `<div class="entries" data-grid="skins">${items.join('')}</div>`)}</div>

      <div class="section">${panel('Endless stickers', 'Character sticker levels 0–4', `
        <div class="btn-row">${bulkButton('Max all stickers', 'rec-max-stickers', { cls: 'btn-gold' })}${bulkButton('Clear all stickers', 'rec-clear-stickers', { cls: 'btn-danger' })}</div>
        <details class="disclosure mt-2" open><summary>Character stickers (${countTruthy((stickers || []).map(v => num(v, -1) > -1))})</summary><div class="inner">${gridToolbar('stickers', 'Search characters…', true)}<div class="entries" data-grid="stickers">${stickerItems.join('')}</div></div></details>
        <details class="disclosure"><summary>Guard stickers (${countTruthy((guardStickers || []).map(v => num(v, -1) > -1))})</summary><div class="inner"><div class="entries" data-grid="guard-stickers">${guardStickerItems.join('')}</div></div></details>
      `)}</div>
    `;
  }

  function pageStats(f) {
    const d = f.data;
    return `${pageHead('Records · Extras', 'Endings & stats', 'Ending counters, boss records and endless-mode run statistics.')}
      <div class="section">${panel('Cleared endings', 'Rows = difficulty, columns = route', matrixHTML({
        path: '_ClearedEndings',
        rowLabels: ['Easy', 'Normal', 'Hard', 'Lunatic'],
        colLabels: META.endings,
        valueOf: (r, c) => d._ClearedEndings?.[r]?.[c] ?? 0
      }) + `<div class="btn-row mt-2">${bulkButton('Mark every ending cleared (1)', 'rec-unlock-endings', { cls: 'btn-gold' })}${bulkButton('Clear endings', 'rec-clear-endings', { cls: 'btn-danger' })}</div>`)}</div>

      <div class="section">${panel('Boss records', 'Best time (or score for Fredbear microgames) per difficulty', matrixHTML({
        path: '_BossHiScores',
        rowLabels: META.bosses.map(b => b.name),
        colLabels: ['Easy', 'Normal', 'Hard', 'Lunatic', 'Special'],
        valueOf: (r, c) => d._BossHiScores?.[r]?.[c] ?? 0
      }) + `<p class="inline-note mt-2">For boss rows, lower times are better and 0 means unset. Fredbear microgames store a high score instead.</p>`)}</div>

      <div class="split section">
        <div>${panel('Endless mode', 'Rounds and call history', `<div class="fields cols-2">
          ${field('Rounds beaten', '_EndlessRoundsBeaten', d._EndlessRoundsBeaten, { min: 0 })}
          ${field('Shuffle calls heard', '—', len(d._ShuffleCallsHeard), { disabled: true, hint: 'Managed as a list below' })}
        </div>
        <div class="chips mt-2">${(d._ShuffleCallsHeard || []).map((id, i) => `<span class="chip">${esc(phoneName(id))}<button type="button" class="x" data-action="remove-array-item" data-path="_ShuffleCallsHeard" data-index="${i}">×</button></span>`).join('') || '<span class="inline-note">No calls heard.</span>'}</div>
        <div class="btn-row mt-2"><button type="button" class="btn btn-sm" data-action="open-picker" data-picker="heardcalls">${icon('plus')} Add heard call</button>${bulkButton('Clear', 'rec-clear-heardcalls', { cls: 'btn-danger' })}</div>`)}</div>
        <div>${panel('Ending flags', 'Derived from ClearedEndings', `<div class="kv-list">
          ${META.endings.map((name, i) => `<div class="kv"><span class="k">${esc(name)}</span><span class="v">${range(4).map(dr => fmtInt(d._ClearedEndings?.[dr]?.[i] ?? 0)).join(' / ')}</span></div>`).join('')}
        </div><p class="inline-note mt-2">Order shown: Easy / Normal / Hard / Lunatic clear counts.</p>`)}</div>
      </div>
    `;
  }

  function pageSettings(f) {
    const d = f.data;
    const S = d._Settings || [];
    const graphics = META.settings.graphics;
    const audio = META.settings.audio;
    const gameplay = META.settings.gameplay;
    const keybinds = META.settings.keybinds;
    const keys = S[0] || [];

    return `${pageHead('Records · Extras', 'Settings', 'The options menu as stored in records. Values are array indices into the game’s option lists.')}
      <div class="grid grid-3 section">
        ${panel('Graphics', 'Window', `<div class="stack">
          ${graphics.map((g, i) => field(g.name, `_Settings.1.${i}`, S[1]?.[i] ?? 0, { type: 'select', options: g.options.map((o, oi) => ({ value: oi, label: o })) })).join('')}
        </div>`)}
        ${panel('Audio', 'Volume & voices', `<div class="stack">
          ${audio.map((g, i) => field(g.name, `_Settings.2.${i}`, S[2]?.[i] ?? 0, { type: 'select', options: g.options.map((o, oi) => ({ value: oi, label: typeof o === 'number' ? `${o}%` : o })) })).join('')}
        </div>`)}
        ${panel('Gameplay', 'Controls & display', `<div class="stack">
          ${gameplay.map((g, i) => field(g.name, `_Settings.3.${i}`, S[3]?.[i] ?? 0, { type: 'select', options: g.options.map((o, oi) => ({ value: oi, label: o })) })).join('')}
        </div>`)}
      </div>

      <div class="section">${panel('Keybinds', 'Windows virtual-key codes; click Set and press a key', `<div class="fields cols-3">
        ${keybinds.map((name, i) => `<div class="field">
          <span class="field-label">${esc(name)}</span>
          <div class="row">
            <input type="number" data-path="_Settings.0.${i}" data-type="number" value="${esc(keys[i] ?? 0)}" autocomplete="off">
            <button type="button" class="btn btn-sm btn-ghost" data-action="keybind-capture" data-path="_Settings.0.${i}" title="Capture the next key">Set</button>
          </div>
          <span class="hint">${esc(keyName(keys[i]))}</span>
        </div>`).join('')}
      </div>`)}</div>

      <div class="section">${panel('Shuffle options', 'Used by Shuffle Mode', `<div class="fields cols-2">
        ${(d._ShuffleSettings || []).map((v, i) => switchRow(META.shuffleSettings[i] || `Shuffle setting #${i}`, '', `_ShuffleSettings.${i}`, !!v)).join('')}
      </div>`)}</div>

      <div class="section">${panel('Notifications', 'Seen/unseen flags for Extras', `<div class="kv-list">
        <div class="kv"><span class="k">Animatronic notifications</span><span class="v">${countTruthy(d._ExtrasNotifs?.AnimatronicsNotifs)} / ${len(d._ExtrasNotifs?.AnimatronicsNotifs)}</span></div>
        <div class="kv"><span class="k">Concept art notifications</span><span class="v">${countTruthy(d._ExtrasNotifs?.ConceptArtNotifs)} / ${len(d._ExtrasNotifs?.ConceptArtNotifs)}</span></div>
        <div class="kv"><span class="k">Trophy notifications</span><span class="v">${countTruthy(d._ExtrasNotifs?.TrophyNotifs)} / ${len(d._ExtrasNotifs?.TrophyNotifs)}</span></div>
      </div><div class="btn-row mt-2">${bulkButton('Mark all seen', 'rec-notifs-seen')}${bulkButton('Mark all unseen', 'rec-notifs-unseen')}</div>`)}</div>
    `;
  }

  /* ==========================================================================
     Pages — Endless save
     ========================================================================== */

  function pageEndlessOverview(f) {
    const d = f.data;
    const inv = d._EndlessInventory || {};
    return `${pageHead('Endless save · ' + esc(f.name), 'Endless overview', 'Four Layers Down run data: round, lives, guard, inventory and challenge state.',
      `<button type="button" class="btn btn-sm btn-ghost" data-action="download">${icon('download')} Download</button>`)}
      ${missingBanner(f)}
      <div class="section">${statGrid([
        { l: 'Round', v: esc(fmtInt(d._EndlessRound)), s: roomName(d._StartRoom) },
        { l: 'Difficulty', v: esc(diffName(d._Difficulty)), s: 'Endless difficulty', cls: 'accent' },
        { l: 'Guard', v: esc(guardName(d._Guard)), s: 'Current guard' },
        { l: 'Lives', v: esc(fmtInt(sum(d._Lives))), s: (d._Lives || []).join(' / '), cls: 'green' },
        { l: 'Paycheck', v: esc(fmtMoney(d._Paycheck)), s: `Total: ${fmtMoney(d._PaycheckTotal)}` },
        { l: 'Deaths this round', v: esc(fmtInt(d._DeathsThisRound)), s: `Total deaths: ${fmtInt(d._Deaths)}`, cls: 'blue' }
      ])}</div>

      <div class="split section">
        <div>${panel('Run status', 'Quick summary', `<div class="kv-list">
          <div class="kv"><span class="k">Start room</span><span class="v">${esc(roomName(d._StartRoom))} (#${esc(d._StartRoom)})</span></div>
          <div class="kv"><span class="k">Can continue</span><span class="v">${d._CanContinue ? 'Yes' : 'No'}</span></div>
          <div class="kv"><span class="k">Nuzlocke mode</span><span class="v">${d._NuzlockeMode ? 'On' : 'Off'}</span></div>
          <div class="kv"><span class="k">Times healed</span><span class="v">${fmtInt(d._TimesHealed)}</span></div>
          <div class="kv"><span class="k">Beaten</span><span class="v">${d._Beaten ? 'Yes' : 'No'}</span></div>
          <div class="kv"><span class="k">Cartridges</span><span class="v">${fmtInt(countTruthy(inv.Cartridges))}</span></div>
          <div class="kv"><span class="k">Run seed</span><span class="v">${fmtInt(d._Seed)}</span></div>
          <div class="kv"><span class="k">Round debt</span><span class="v">${fmtInt(inv.RoundDebt)}</span></div>
          <div class="kv"><span class="k">Markiplier points</span><span class="v">${fmtInt(inv.MarkiplierPoints)}</span></div>
          <div class="kv"><span class="k">Barrier booze</span><span class="v">${fmtInt(inv.BarrierBooze)}</span></div>
        </div>`)}</div>
        <div>${panel('Quick actions', '', `<div class="btn-row">
          ${bulkButton('Max paycheck', 'end-max-money', { cls: 'btn-gold' })}
          ${bulkButton('Refill lives (3 each)', 'end-heal')}
          ${bulkButton('Clear debt', 'end-clear-debt')}
          ${bulkButton('Clear deaths', 'end-clear-deaths')}
          ${bulkButton('Unlock all cartridges', 'end-max-cartridges')}
          ${bulkButton('Clear inventory', 'end-clear-inventory', { cls: 'btn-danger' })}
        </div>`)}</div>
      </div>
    `;
  }

  function pageEndlessRun(f) {
    const d = f.data;
    const roomOptions = ROOMS.map(r => ({ value: r.id, label: `${r.name} (#${r.id})` }));
    return `${pageHead('Endless save · Run state', 'Run state', 'Core endless-mode values. Lives is a three-entry array.')}
      <div class="section">${panel('Round', '', `<div class="fields cols-3">
        ${field('Round', '_EndlessRound', d._EndlessRound, { min: 1 })}
        ${field('Start room', '_StartRoom', d._StartRoom, { type: 'select', options: roomOptions })}
        ${field('Difficulty', '_Difficulty', d._Difficulty, { type: 'select', options: META.difficulties.map((n, i) => ({ value: i, label: `${i} — ${n}` })) })}
        ${field('Guard', '_Guard', d._Guard, { type: 'select', options: META.guards.map((n, i) => ({ value: i, label: `${i} — ${n}` })) })}
        ${field('Paycheck', '_Paycheck', d._Paycheck, { step: '0.01', min: 0 })}
        ${field('Paycheck total', '_PaycheckTotal', d._PaycheckTotal, { step: '0.01', min: 0 })}
        ${field('Run time', '_RunTime', d._RunTime, { step: '0.1', min: 0, hint: `Formatted: <b data-format="_RunTime" data-format-kind="time">${esc(fmtDuration(d._RunTime))}</b>` })}
        ${field('Seed', '_Seed', d._Seed, { hint: 'Large integer used to seed the run.' })}
        ${field('Times healed', '_TimesHealed', d._TimesHealed, { min: 0 })}
      </div>`)}</div>

      <div class="section">${panel('Lives', 'Three life slots', `<div class="fields cols-3">
        ${range(Math.max(3, len(d._Lives))).map(i => field(`Life slot ${i + 1}`, `_Lives.${i}`, d._Lives?.[i] ?? 0, { min: 0 })).join('')}
      </div>`)}</div>

      <div class="section">${panel('Flags', '', `<div class="fields cols-3">
        ${switchRow('Can continue', 'Offer continue on the endless menu', '_CanContinue', !!d._CanContinue)}
        ${switchRow('Nuzlocke mode', 'Run uses Nuzlocke rules', '_NuzlockeMode', !!d._NuzlockeMode)}
        ${switchRow('Beaten', 'Run completed', '_Beaten', !!d._Beaten)}
      </div>`)}</div>

      <div class="section">${panel('Deaths', '', `<div class="fields cols-2">
        ${field('Deaths this round', '_DeathsThisRound', d._DeathsThisRound, { min: 0 })}
        ${field('Total deaths', '_Deaths', d._Deaths, { min: 0 })}
      </div>`)}</div>
    `;
  }

  function pageEndlessInventory(f) {
    const d = f.data;
    const inv = d._EndlessInventory || {};
    const rp = d._RepeatPrevention || {};
    const carts = inv.Cartridges || [];
    const cartItems = range(Math.max(20, carts.length)).map(i => {
      const m = MINIGAME_BY_ID.get(i);
      const a = { id: i, name: m ? m.name : `Cartridge slot #${i}`, desc: '', role: 'Other', known: !!m };
      return entryToggle(a, !!carts[i], `_EndlessInventory.Cartridges.${i}`);
    });
    const upgrades = d._Upgrades || [];
    const upgradeChips = upgrades.map((id, i) => `<span class="chip">${esc(upgName(id))}<button type="button" class="x" data-action="remove-array-item" data-path="_Upgrades" data-index="${i}">×</button></span>`).join('');
    const consumables = inv.Consumables || [];
    const consumableChips = consumables.map((id, i) => `<span class="chip">${esc(consumableName(id))}<button type="button" class="x" data-action="remove-array-item" data-path="_EndlessInventory.Consumables" data-index="${i}">×</button></span>`).join('');
    const whacked = inv.WhackedChars || [];
    const whackedChips = whacked.map((id, i) => `<span class="chip">${esc(animName(id))}<button type="button" class="x" data-action="remove-array-item" data-path="_EndlessInventory.WhackedChars" data-index="${i}">×</button></span>`).join('');

    return `${pageHead('Endless save · Inventory', 'Inventory', 'Cartridges, consumables, upgrades and challenge modifiers for Four Layers Down.')}
      <div class="section">${panel('Economy', '', `<div class="fields cols-3">
        ${field('Markiplier points', '_EndlessInventory.MarkiplierPoints', inv.MarkiplierPoints, { min: 0 })}
        ${field('Round debt', '_EndlessInventory.RoundDebt', inv.RoundDebt, { min: 0 })}
        ${field('Barrier booze', '_EndlessInventory.BarrierBooze', inv.BarrierBooze, { min: 0 })}
        ${field('Bobbiedot regimen', '_EndlessInventory.BobbiedotRegimen', inv.BobbiedotRegimen, { hint: '-1 = none' })}
        ${switchRow('Boss call', 'Whether the boss call is active', '_EndlessInventory.BossCall', !!inv.BossCall)}
      </div>`)}</div>

      <div class="section">${panel('Upgrades', `${upgrades.length} owned`, `<div class="chips">${upgradeChips || '<span class="inline-note">No upgrades.</span>'}</div><div class="btn-row mt-2"><button type="button" class="btn btn-sm" data-action="open-picker" data-picker="upgrades">${icon('plus')} Add upgrades</button><button type="button" class="btn btn-sm btn-ghost" data-action="open-picker" data-picker="eleanor">Eleanor challenges</button></div>`)}</div>

      <div class="section">${panel('Cartridges', `${countTruthy(carts)} unlocked`, `<div class="entries" data-grid="endless-carts">${cartItems.join('')}</div>`, `${bulkButton('Unlock all', 'end-max-cartridges', { cls: 'btn-gold' })}${bulkButton('Clear', 'end-clear-cartridges', { cls: 'btn-danger' })}`)}</div>

      <div class="split section">
        <div>${panel('Consumables', `${consumables.length} held`, `<div class="chips">${consumableChips || '<span class="inline-note">No consumables.</span>'}</div><div class="btn-row mt-2"><button type="button" class="btn btn-sm" data-action="open-picker" data-picker="consumables">${icon('plus')} Add consumable</button></div>`)}</div>
        <div>${panel('Whacked animatronics', `${whacked.length} removed this run`, `<div class="chips">${whackedChips || '<span class="inline-note">None removed.</span>'}</div><div class="btn-row mt-2"><button type="button" class="btn btn-sm" data-action="open-picker" data-picker="whacked">${icon('plus')} Add animatronic</button></div>`)}</div>
      </div>

      <div class="section">${panel('Salvage pool', `${len(d._Salvages)} entries`, `<div class="chips">${(d._Salvages || []).map((id, i) => `<span class="chip">${esc(animName(id))}<button type="button" class="x" data-action="remove-array-item" data-path="_Salvages" data-index="${i}">×</button></span>`).join('') || '<span class="inline-note">Empty.</span>'}</div><div class="btn-row mt-2"><button type="button" class="btn btn-sm" data-action="open-picker" data-picker="salvages">${icon('plus')} Edit pool</button></div>`)}</div>

      <div class="section">${panel('Repeat prevention', 'Stops repeated shops/animatronics in a run', `<div class="fields cols-2">
        ${field('Challenges exclusion', '_RepeatPrevention.Challenges', rp.Challenges, { hint: '-1 = none' })}
        ${field('Shop slot A', '_RepeatPrevention.Shops.0', rp.Shops?.[0], { hint: '-1 = none' })}
        ${field('Shop slot B', '_RepeatPrevention.Shops.1', rp.Shops?.[1], { hint: '-1 = none' })}
      </div><div class="divider"></div><div class="fields cols-2">
        <div class="field"><span class="field-label">Animatronics (comma IDs)</span><textarea id="list-_RepeatPrevention.Animatronics" data-list-path="_RepeatPrevention.Animatronics" rows="3">${esc((rp.Animatronics || []).join(', '))}</textarea><button type="button" class="btn btn-sm mt-1" data-action="apply-list" data-path="_RepeatPrevention.Animatronics" data-len="0">Apply list</button></div>
        <div class="field"><span class="field-label">Upgrades (comma IDs)</span><textarea id="list-_RepeatPrevention.Upgrades" data-list-path="_RepeatPrevention.Upgrades" rows="3">${esc((rp.Upgrades || []).join(', '))}</textarea><button type="button" class="btn btn-sm mt-1" data-action="apply-list" data-path="_RepeatPrevention.Upgrades" data-len="0">Apply list</button></div>
      </div>`)}</div>

      <div class="section">${panel('Ability index', '20-entry list used by the Bobbiedots', `<div class="field"><span class="field-label">Comma-separated IDs</span><textarea id="list-_AbilityIndex" data-list-path="_AbilityIndex" rows="3">${esc((d._AbilityIndex || []).join(', '))}</textarea></div><div class="btn-row mt-1"><button type="button" class="btn btn-sm" data-action="apply-list" data-path="_AbilityIndex" data-len="20">Apply list</button></div>`)}</div>

      <div class="section">${panel('Eleanor challenge', 'Current endless modifier (JSON object or null)', `<div class="field"><textarea id="json-_EleanorChallenge" rows="4" spellcheck="false">${esc(JSON.stringify(d._EleanorChallenge ?? null, null, 2))}</textarea></div><div class="btn-row mt-1"><button type="button" class="btn btn-sm" data-action="apply-json-field" data-path="_EleanorChallenge">Apply JSON</button></div>`)}</div>
    `;
  }

  /* ==========================================================================
     Pages — shared
     ========================================================================== */

  function pageRaw(f) {
    const json = JSON.stringify(f.data, null, 2);
    return `${pageHead('Advanced · ' + esc(f.name), 'Raw JSON', 'Edit the save as JSON. Applying replaces the entire in-memory save; nothing is written to disk until you download.',
      `<button type="button" class="btn btn-sm btn-primary" data-action="raw-apply">${icon('save')} Apply JSON</button>`) }
      <div class="section">${panel('Raw save data', `${kindLabel(f.kind)} · ${fmtInt(byteLength(JSON.stringify(f.data)))} bytes · ${Object.keys(f.data).length} top-level keys`, `
        <div class="json-wrap"><textarea id="raw-json" spellcheck="false">${esc(json)}</textarea></div>
        <div class="json-meta"><span id="raw-meta">${fmtInt(json.length)} characters</span><span>Trailing NUL is appended automatically on download.</span></div>
        <div class="btn-row mt-2">
          <button type="button" class="btn btn-sm" data-action="raw-format">${icon('refresh')} Format</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="raw-copy">${icon('file')} Copy to clipboard</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="download">${icon('download')} Download</button>
        </div>
      `)}</div>
      <div class="section">${panel('Safety notes', '', `<p class="inline-note">• The game uses <code>json_parse</code>, so the file must stay a valid JSON object.<br>• Keep numeric fields numeric. Booleans are accepted where the game compares truthiness.<br>• The original writer appends a NUL byte; this editor does the same on download.<br>• If the game refuses the save, restore your backup and check the last fields you edited.</p>`)}</div>
    `;
  }

  function missingBanner(f) {
    const n = missingFieldCount(f);
    if (!n) return '';
    return `<div class="banner info" style="margin-bottom:16px">${icon('alert')}<div class="grow"><b>Older save detected.</b> This file is missing ${n} field${n === 1 ? '' : 's'} that v2.0.0 expects. You can add safe defaults without touching your existing values.</div><button type="button" class="btn btn-sm" data-action="add-missing-fields">Add missing fields</button></div>`;
  }

  function pageFor(f) {
    if (state.page === 'raw') return pageRaw(f);
    if (f.kind === 'run') {
      if (state.page === 'overview') return pageRunOverview(f);
      if (state.page === 'run') return pageRunState(f);
      if (state.page === 'salvages') return pageSalvages(f);
      if (state.page === 'upgrades') return pageRunUpgrades(f);
      if (state.page === 'shuffle') return pageShuffle(f);
      state.page = 'overview';
      return pageRunOverview(f);
    }
    if (f.kind === 'records') {
      if (state.page === 'overview') return pageRecordsOverview(f);
      if (state.page === 'progression') return pageProgression(f);
      if (state.page === 'animatronics') return pageAnimatronics(f);
      if (state.page === 'upgrades') return pageUpgradesRecords(f);
      if (state.page === 'minigames') return pageMinigames(f);
      if (state.page === 'trophies') return pageTrophies(f);
      if (state.page === 'challenges') return pageChallenges(f);
      if (state.page === 'guards') return pageGuards(f);
      if (state.page === 'skins') return pageSkins(f);
      if (state.page === 'stats') return pageStats(f);
      if (state.page === 'settings') return pageSettings(f);
      state.page = 'overview';
      return pageRecordsOverview(f);
    }
    if (state.page === 'overview') return pageEndlessOverview(f);
    if (state.page === 'run') return pageEndlessRun(f);
    if (state.page === 'inventory') return pageEndlessInventory(f);
    state.page = 'overview';
    return pageEndlessOverview(f);
  }

  /* ==========================================================================
     Missing fields
     ========================================================================== */

  function missingFieldCount(f) {
    const tpl = buildTemplate(f.kind);
    let n = 0;
    for (const k of Object.keys(tpl)) {
      if (!(k in f.data)) { n++; continue; }
      if (isObj(tpl[k]) && isObj(f.data[k])) {
        for (const k2 of Object.keys(tpl[k])) {
          if (!(k2 in f.data[k])) n++;
        }
      }
      if (Array.isArray(tpl[k]) && Array.isArray(f.data[k])) {
        if (f.kind === 'records' && k === '_Settings') {
          tpl[k].forEach((arr, i) => {
            if (!Array.isArray(f.data[k][i]) || f.data[k][i].length < arr.length) n++;
          });
        }
      }
    }
    if (f.kind === 'records' && Array.isArray(f.data._RunsAttempted)) {
      f.data._RunsAttempted.forEach(row => { if (!Array.isArray(row) || row.length < 5) n++; });
    }
    return n;
  }

  function addMissingFields(f) {
    const tpl = buildTemplate(f.kind);
    const changed = commit(f, () => {
      for (const [k, v] of Object.entries(tpl)) {
        if (!(k in f.data)) f.data[k] = clone(v);
        else if (isObj(v) && isObj(f.data[k])) {
          for (const [k2, v2] of Object.entries(v)) {
            if (!(k2 in f.data[k])) f.data[k][k2] = clone(v2);
          }
        }
      }
      if (f.kind === 'records' && Array.isArray(f.data._Settings)) {
        tpl._Settings.forEach((arr, i) => {
          if (!Array.isArray(f.data._Settings[i])) f.data._Settings[i] = clone(arr);
          else while (f.data._Settings[i].length < arr.length) f.data._Settings[i].push(0);
        });
      }
      if (f.kind === 'records' && Array.isArray(f.data._RunsAttempted)) {
        f.data._RunsAttempted.forEach((row, i) => {
          if (!Array.isArray(row)) f.data._RunsAttempted[i] = [0, 0, 0, 0, 0];
          else while (row.length < 5) row.push(0);
        });
      }
      if (f.kind === 'records' && Array.isArray(f.data._RunsWon)) {
        f.data._RunsWon.forEach((row, i) => {
          if (!Array.isArray(row)) f.data._RunsWon[i] = [0, 0, 0, 0, 0];
          else while (row.length < 5) row.push(0);
        });
      }
    });
    if (changed) {
      renderApp({ preserveScroll: true });
      notify('Missing fields added with safe defaults', 'success');
    } else {
      notify('Nothing to add', 'info');
    }
  }

  /* ==========================================================================
     Bulk actions
     ========================================================================== */

  const CONFIRM_BULK = {
    'rec-unlock-all': { title: 'Unlock everything?', text: 'This unlocks all gallery pages, minigames, trophies, upgrades, guards, stickers, endings and maxes tokens/scores. Your existing values are kept where possible.', confirm: 'Unlock everything' },
    'rec-clear-all': { title: 'Reset records to template?', text: 'This replaces every value in this records file with a fresh v2.0.0 template. This cannot be undone except with the editor undo button.', confirm: 'Reset records', danger: true },
    'rec-lock-anim': { title: 'Lock all gallery pages?', text: 'This sets every gallery page to locked, including story entries.', confirm: 'Lock all', danger: true },
    'rec-lock-minigames': { title: 'Lock all minigames?', text: 'Sets all 30 minigame unlock slots to false.', confirm: 'Lock all', danger: true },
    'rec-lock-trophies': { title: 'Lock all trophies?', text: 'Sets all 63 trophy flags to false.', confirm: 'Lock all', danger: true },
    'rec-clear-challenges': { title: 'Clear all challenges?', text: 'Resets all custom-night challenge completion tiers to 0.', confirm: 'Clear challenges', danger: true },
    'rec-lock-guards': { title: 'Lock all guards?', text: 'Sets all guard unlock states to 0.', confirm: 'Lock guards', danger: true },
    'rec-lock-upgrades': { title: 'Lock all upgrades?', text: 'Sets every upgrade record flag to false.', confirm: 'Lock upgrades', danger: true },
    'rec-clear-stickers': { title: 'Clear all stickers?', text: 'Sets every character and guard sticker level to -1.', confirm: 'Clear stickers', danger: true },
    'rec-clear-endings': { title: 'Clear ending counters?', text: 'Sets every ending completion counter to 0.', confirm: 'Clear endings', danger: true },
    'rec-clear-deaths': { title: 'Clear death record?', text: 'Sets all 202 permanent death counters to 0.', confirm: 'Clear deaths', danger: true },
    'rec-clear-salvage-record': { title: 'Clear salvage record?', text: 'Sets all 202 permanent salvage counters to 0.', confirm: 'Clear salvages', danger: true },
    'rec-clear-heardcalls': { title: 'Clear heard calls?', text: 'Removes every entry from the shuffle-call history.', confirm: 'Clear calls', danger: true },
    'run-clear-upgrades': { title: 'Remove all run upgrades?', text: 'Empties this run’s upgrade list.', confirm: 'Remove upgrades', danger: true },
    'run-clear-salvages': { title: 'Clear salvage roster?', text: 'Empties the run’s salvaged animatronic list. The game may use this to decide what is available.', confirm: 'Clear roster', danger: true },
    'end-clear-inventory': { title: 'Clear endless inventory?', text: 'Removes consumables, whacked characters, points, debt and barrier booze. Cartridges and upgrades are left alone.', confirm: 'Clear inventory', danger: true },
    'end-clear-cartridges': { title: 'Clear all cartridges?', text: 'Sets all cartridge slots to false.', confirm: 'Clear cartridges', danger: true }
  };

  function applyBulk(f, action) {
    const d = f.data;
    const changed = commit(f, () => {
      switch (action) {
        /* run */
        case 'run-max-paycheck':
          d._Paycheck = 99999;
          d._PaycheckTotal = Math.max(num(d._PaycheckTotal), 99999);
          break;
        case 'run-complete-salvage':
          d._Masks = [true, true, true, true];
          d._Scraps = [true, true, true, true];
          d._Minigames = (Array.isArray(d._Minigames) ? d._Minigames : [false, false, false, false, false]).map(() => true);
          break;
        case 'run-all-upgrades': d._Upgrades = UPGRADES.map(u => u.id); break;
        case 'run-clear-upgrades': d._Upgrades = []; break;
        case 'run-clear-deaths': d._Deaths = [0, 0, 0, 0, 0, 0]; break;
        case 'run-night-six': d._Night = 6; break;
        case 'run-can-continue': d._CanContinue = true; break;
        case 'run-all-salvages': d._Salvages = ANIM.filter(a => ['Enemy', 'Boss', 'Jumpscarer'].includes(a.role)).map(a => a.id); break;
        case 'run-clear-salvages': d._Salvages = []; break;
        case 'run-clear-phonecalls': if (d._ShuffleData) d._ShuffleData.PhoneCalls = []; break;
        case 'run-reset-phonecalls': if (d._ShuffleData) d._ShuffleData.PhoneCalls = (META.defaultPhoneCalls || []).slice(); break;

        /* records */
        case 'rec-unlock-anim': d._UnlockedAnimatronics = range(202).map(() => true); break;
        case 'rec-lock-anim': d._UnlockedAnimatronics = range(202).map(() => false); break;
        case 'rec-unlock-minigames': d._UnlockedMinigames = range(Math.max(30, len(d._UnlockedMinigames))).map(() => true); break;
        case 'rec-lock-minigames': d._UnlockedMinigames = range(Math.max(30, len(d._UnlockedMinigames))).map(() => false); break;
        case 'rec-unlock-trophies': d._UnlockedTrophies = range(63).map(() => true); break;
        case 'rec-lock-trophies': d._UnlockedTrophies = range(63).map(() => false); break;
        case 'rec-complete-challenges': d._ClearedChallenges = range(Math.max(50, len(d._ClearedChallenges))).map(i => (i < 44 ? 3 : 0)); break;
        case 'rec-clear-challenges': d._ClearedChallenges = range(Math.max(50, len(d._ClearedChallenges))).map(() => 0); break;
        case 'rec-unlock-guards':
          d._UnlockedGuards = range(Math.max(30, len(d._UnlockedGuards))).map(i => (i < 21 ? 3 : 1));
          break;
        case 'rec-lock-guards': d._UnlockedGuards = range(Math.max(30, len(d._UnlockedGuards))).map(() => 0); break;
        case 'rec-unlock-upgrades': d._UpgradeRecord = range(66).map(() => 1); break;
        case 'rec-lock-upgrades': d._UpgradeRecord = range(66).map(() => 0); break;
        case 'rec-max-stickers':
          d._EndlessStickers = range(202).map(i => (i <= 86 ? 4 : -1));
          d._EndlessGuardStickers = range(40).map(i => (i < 21 ? 4 : -1));
          break;
        case 'rec-clear-stickers':
          d._EndlessStickers = range(202).map(() => -1);
          d._EndlessGuardStickers = range(40).map(() => -1);
          break;
        case 'rec-unlock-endings':
          d._ClearedEndings = range(4).map(r => range(5).map(c => Math.max(1, num(d._ClearedEndings?.[r]?.[c]))));
          break;
        case 'rec-clear-endings': d._ClearedEndings = range(4).map(() => range(5).map(() => 0)); break;
        case 'rec-max-scores':
          d._TokensPerMinigame = range(Math.max(30, len(d._TokensPerMinigame))).map(() => 9999);
          d._HiScoresOverall = range(Math.max(30, len(d._HiScoresOverall))).map(() => 999999);
          break;
        case 'rec-max-tokens': d._TokensPerMinigame = range(Math.max(30, len(d._TokensPerMinigame))).map(() => 9999); break;
        case 'rec-clear-tokens': d._TokensPerMinigame = range(Math.max(30, len(d._TokensPerMinigame))).map(() => 0); break;
        case 'rec-clear-scores': d._HiScoresOverall = range(Math.max(30, len(d._HiScoresOverall))).map(() => 0); break;
        case 'rec-clear-deaths': d._DeathRecord = range(202).map(() => 0); break;
        case 'rec-clear-salvage-record': d._SalvageRecord = range(202).map(() => 0); break;
        case 'rec-salvage-one': d._SalvageRecord = range(202).map(() => 1); break;
        case 'rec-reset-skins':
          d._Skins = range(202).map(() => -1);
          d._SkinOffice = -1;
          d._RandomizeSkins = false;
          d._RandomizeOffice = false;
          break;
        case 'rec-playtime-100h': d._Playtime = 360000; break;
        case 'rec-speed-zero': d._RunSpeedBest = 0; break;
        case 'rec-earnings-max': d._RunEarningsBest = 99999; break;
        case 'rec-notifs-seen':
          if (d._ExtrasNotifs) for (const k of Object.keys(d._ExtrasNotifs)) d._ExtrasNotifs[k] = (d._ExtrasNotifs[k] || []).map(() => true);
          break;
        case 'rec-notifs-unseen':
          if (d._ExtrasNotifs) for (const k of Object.keys(d._ExtrasNotifs)) d._ExtrasNotifs[k] = (d._ExtrasNotifs[k] || []).map(() => false);
          break;
        case 'rec-clear-heardcalls': d._ShuffleCallsHeard = []; break;
        case 'rec-unlock-all': {
          d._UnlockedAnimatronics = range(202).map(() => true);
          d._UnlockedMinigames = range(Math.max(30, len(d._UnlockedMinigames))).map(() => true);
          d._UnlockedTrophies = range(63).map(() => true);
          d._ClearedChallenges = range(Math.max(50, len(d._ClearedChallenges))).map(i => (i < 44 ? 3 : 0));
          d._UnlockedGuards = range(Math.max(30, len(d._UnlockedGuards))).map(i => (i < 21 ? 3 : 1));
          d._UpgradeRecord = range(66).map(() => 1);
          d._EndlessStickers = range(202).map(i => (i <= 86 ? 4 : -1));
          d._EndlessGuardStickers = range(40).map(i => (i < 21 ? 4 : -1));
          d._ClearedEndings = range(4).map(r => range(5).map(c => Math.max(1, num(d._ClearedEndings?.[r]?.[c]))));
          d._TokensPerMinigame = range(Math.max(30, len(d._TokensPerMinigame))).map(() => 9999);
          d._HiScoresOverall = range(Math.max(30, len(d._HiScoresOverall))).map(() => 999999);
          break;
        }
        case 'rec-clear-all': {
          const tpl = buildTemplate('records');
          Object.keys(d).forEach(k => delete d[k]);
          Object.assign(d, tpl);
          break;
        }

        /* endless */
        case 'end-max-money': d._Paycheck = 99999; d._PaycheckTotal = Math.max(num(d._PaycheckTotal), 99999); break;
        case 'end-heal': d._Lives = [3, 3, 3]; break;
        case 'end-clear-debt':
          d._EndlessInventory = d._EndlessInventory || {};
          d._EndlessInventory.RoundDebt = 0;
          break;
        case 'end-clear-deaths': d._DeathsThisRound = 0; d._Deaths = 0; break;
        case 'end-max-cartridges':
          d._EndlessInventory = d._EndlessInventory || {};
          d._EndlessInventory.Cartridges = range(Math.max(20, len(d._EndlessInventory.Cartridges))).map(() => true);
          break;
        case 'end-clear-cartridges':
          d._EndlessInventory = d._EndlessInventory || {};
          d._EndlessInventory.Cartridges = range(Math.max(20, len(d._EndlessInventory.Cartridges))).map(() => false);
          break;
        case 'end-clear-inventory': {
          d._EndlessInventory = d._EndlessInventory || {};
          const inv = d._EndlessInventory;
          inv.Consumables = [];
          inv.WhackedChars = [];
          inv.MarkiplierPoints = 0;
          inv.RoundDebt = 0;
          inv.BarrierBooze = 0;
          inv.BossCall = false;
          break;
        }
        default: return;
      }
    });

    if (changed) {
      renderApp({ preserveScroll: true });
      notify('Bulk edit applied', 'success');
    }
  }

  /* ==========================================================================
     Modals
     ========================================================================== */

  function renderModal() {
    if (!state.modal) { modalRoot.innerHTML = ''; return; }
    const m = state.modal;
    let html = '';

    if (m.type === 'confirm') {
      html = `<div class="modal-backdrop" data-action="modal-backdrop">
        <div class="modal small" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-head"><div><h3 id="modal-title">${esc(m.title)}</h3></div><button type="button" class="modal-close" data-action="modal-close" aria-label="Close">×</button></div>
          <div class="modal-body"><p class="inline-note">${esc(m.text)}</p></div>
          <div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button type="button" class="btn ${m.danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-yes">${esc(m.confirm || 'Confirm')}</button></div>
        </div>
      </div>`;
    } else if (m.type === 'info') {
      html = `<div class="modal-backdrop" data-action="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head"><div><h3>${esc(m.title)}</h3><div class="sub">${esc(m.sub || '')}</div></div><button type="button" class="modal-close" data-action="modal-close">×</button></div>
          <div class="modal-body">${m.body}</div>
          <div class="modal-foot"><button type="button" class="btn btn-primary" data-action="modal-close">Close</button></div>
        </div>
      </div>`;
    } else if (m.type === 'keybind') {
      html = `<div class="modal-backdrop">
        <div class="modal small" role="dialog" aria-modal="true">
          <div class="modal-head"><div><h3>Press a key</h3><div class="sub">Esc cancels</div></div><button type="button" class="modal-close" data-action="modal-close">×</button></div>
          <div class="modal-body center"><p class="inline-note">Listening for the next key press…</p><div style="font-family:var(--mono);font-size:36px;color:var(--gold);padding:18px">?</div></div>
        </div>
      </div>`;
    } else if (m.type === 'picker') {
      html = `<div class="modal-backdrop" data-action="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div><h3>${esc(m.title)}</h3><div class="sub">${esc(m.sub || '')}</div></div>
            <button type="button" class="modal-close" data-action="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div class="toolbar"><div class="search">${icon('search')}<input type="search" data-picker-search placeholder="Search…" autocomplete="off"></div><span class="count" id="picker-count">${m.selected.size} selected</span></div>
            <div class="picker-list" id="picker-list">
              ${m.items.map(item => `<div class="picker-item ${m.selected.has(item.id) ? 'on' : ''}" data-action="picker-toggle" data-id="${item.id}" data-search="${esc((item.name + ' ' + (item.desc || '') + ' ' + item.id + ' ' + (item.meta || '')).toLowerCase())}">
                <span class="pbox">✓</span>
                <span class="pinfo"><span class="pname">${esc(item.name)}</span><span class="pdesc">${esc(item.desc || item.meta || '')}</span></span>
                <span class="pid">#${item.id}</span>
              </div>`).join('')}
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" data-action="picker-clear">Clear</button>
            <button type="button" class="btn btn-primary" data-action="picker-apply">Apply</button>
          </div>
        </div>
      </div>`;
    }
    modalRoot.innerHTML = html;
    if (m.type === 'picker') {
      const input = $('[data-picker-search]');
      if (input) input.focus();
    }
  }

  function closeModal() { state.modal = null; renderModal(); }

  function openConfirm({ title, text, confirm = 'Confirm', danger = false, onConfirm }) {
    state.modal = { type: 'confirm', title, text, confirm, danger, onConfirm };
    renderModal();
  }

  function openPicker({ title, sub, items, selected, onApply }) {
    state.modal = { type: 'picker', title, sub, items, selected: new Set((selected || []).map(Number)), onApply };
    renderModal();
  }

  function openInfo(title, sub, body) { state.modal = { type: 'info', title, sub, body }; renderModal(); }

  function updatePickerCount() {
    const m = state.modal;
    if (!m || m.type !== 'picker') return;
    const el = $('#picker-count');
    if (el) el.textContent = `${m.selected.size} selected`;
  }

  function pickerItems(kind) {
    if (kind === 'upgrades') return UPGRADES.map(u => ({ id: u.id, name: u.name, desc: u.desc, meta: u.price ? `${u.price} tokens` : '' }));
    if (kind === 'salvages') return ANIM.map(a => ({ id: a.id, name: a.name, desc: a.desc || a.role, meta: a.role }));
    if (kind === 'phonecalls') return PHONE_CALLS.map(p => ({ id: p.id, name: p.name, desc: 'Phone call voice asset', meta: '' }));
    if (kind === 'heardcalls') return PHONE_CALLS.map(p => ({ id: p.id, name: p.name, desc: 'Shuffle call', meta: '' }));
    if (kind === 'whacked') return ANIM.filter(a => ['Enemy', 'Boss', 'Jumpscarer'].includes(a.role)).map(a => ({ id: a.id, name: a.name, desc: a.desc || a.role, meta: a.role }));
    if (kind === 'consumables') return CONSUMABLES.map(c => ({ id: c.id, name: c.name, desc: c.desc, meta: c.price ? `${c.price} tokens` : '' }));
    return [];
  }

  function openPickerFor(f, kind) {
    const d = f.data;
    const map = {
      upgrades: { title: 'Add upgrades', sub: 'Select every upgrade this save should own.', path: '_Upgrades', items: pickerItems('upgrades'), current: d._Upgrades || [] },
      salvages: { title: 'Edit salvage list', sub: 'Animotronics available/salvaged in this run or endless pool.', path: '_Salvages', items: pickerItems('salvages'), current: d._Salvages || [] },
      phonecalls: { title: 'Add phone calls', sub: 'Voice assets in the shuffle call pool.', path: '_ShuffleData.PhoneCalls', items: pickerItems('phonecalls'), current: d._ShuffleData?.PhoneCalls || [] },
      heardcalls: { title: 'Add heard calls', sub: 'Calls already heard by the player.', path: '_ShuffleCallsHeard', items: pickerItems('heardcalls'), current: d._ShuffleCallsHeard || [] },
      whacked: { title: 'Add whacked animatronic', sub: 'Characters removed during the endless run.', path: '_EndlessInventory.WhackedChars', items: pickerItems('whacked'), current: d._EndlessInventory?.WhackedChars || [] },
      consumables: { title: 'Add consumable', sub: 'Items currently held in the endless inventory.', path: '_EndlessInventory.Consumables', items: pickerItems('consumables'), current: d._EndlessInventory?.Consumables || [] }
    };
    if (kind === 'eleanor') {
      openInfo('Eleanor challenges', 'Modifiers offered by Eleanor in Four Layers Down', `<div class="rows">${ELEANOR.map(e => `<div class="row-item"><span class="idx">#${e.id}</span><div class="body"><div class="title">${esc(e.name)}</div><div class="desc">${esc(e.desc.replace('{TheNextRound}', 'the next round'))}</div></div><div class="side"><span class="tag gold">${esc(e.value)}</span></div></div>`).join('')}</div>`);
      return;
    }
    const cfg = map[kind];
    if (!cfg) return;
    openPicker({
      title: cfg.title,
      sub: cfg.sub,
      items: cfg.items,
      selected: cfg.current,
      onApply: (ids) => {
        commit(f, () => pathSet(f.data, cfg.path, ids));
        closeModal();
        renderApp({ preserveScroll: true });
        notify('List updated', 'success');
      }
    });
  }

  /* ==========================================================================
     Rendering app
     ========================================================================== */

  function renderApp(opts = {}) {
    const y = opts.preserveScroll ? window.scrollY : null;
    document.body.classList.toggle('no-crt', !state.ui.crt);
    const f = currentFile();

    if (!f || state.route === 'welcome') {
      app.innerHTML = welcomeHTML();
      document.title = 'Frickbear Editor — Frickbears 3 Save Editor';
      refreshDirtyUI();
      if (y !== null) { try { window.scrollTo(0, y); } catch (e) { /* ignore */ } }
      return;
    }

    if (!state.currentId) state.currentId = f.id;
    state.page = state.page || 'overview';
    const html = `${topbarHTML(false)}
      <div class="shell">
        ${sidebarHTML(f)}
        <main class="content" id="main">
          ${pageFor(f)}
        </main>
      </div>`;
    app.innerHTML = html;
    document.title = `${PAGE_TITLES[state.page] || 'Editor'} · ${f.name} · Frickbear Editor`;
    applyAllFilters();
    refreshDirtyUI();
    refreshCounters(f);
    if (y !== null) { try { window.scrollTo(0, y); } catch (e) { /* ignore */ } }
  }

  function refreshDirtyUI() {
    state.files.forEach(f => {
      const tab = document.querySelector(`.file-tab[data-id="${f.id}"]`);
      if (tab) tab.classList.toggle('dirty', !!f.dirty);
    });
    const f = currentFile();
    const pill = $('#unsaved-pill');
    if (pill) pill.classList.toggle('show', !!f?.dirty);
    const undoBtn = $('#undo-btn');
    if (undoBtn) undoBtn.disabled = !f || !f.undo.length;
    const redoBtn = $('#redo-btn');
    if (redoBtn) redoBtn.disabled = !f || !f.redo.length;
    const dl = $('#download-btn');
    if (dl) dl.innerHTML = `${icon('download')} Download${f?.dirty ? ' *' : ''}`;
  }

  function refreshFormats(path) {
    const f = currentFile();
    if (!f) return;
    $$('[data-format]').forEach(el => {
      const p = el.dataset.format;
      if (path && p !== path) return;
      const v = pathGet(f.data, p);
      const kind = el.dataset.formatKind || 'number';
      el.textContent = kind === 'time' ? fmtDuration(v) : kind === 'money' ? fmtMoney(v) : fmtNum(v);
    });
  }

  /* ==========================================================================
     Route handling
     ========================================================================== */

  function applyRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (raw.startsWith('editor/')) {
      const [, id, page] = raw.split('/');
      const f = state.files.find(file => file.id === id);
      if (f) {
        state.route = 'editor';
        state.currentId = f.id;
        state.page = page || 'overview';
      } else {
        state.route = 'welcome';
      }
    } else if (raw === 'editor') {
      const f = currentFile();
      if (f) { state.route = 'editor'; state.page = 'overview'; }
      else state.route = 'welcome';
    } else {
      state.route = 'welcome';
    }
    if (!state.files.length) state.route = 'welcome';
    renderApp();
  }

  function goEditor(f, page = 'overview') {
    if (!f) return;
    state.currentId = f.id;
    state.page = page;
    state.route = 'editor';
    const hash = `#/editor/${f.id}/${page}`;
    if (location.hash !== hash) location.hash = hash;
    renderApp();
  }

  function switchFile(id) {
    const f = state.files.find(file => file.id === id);
    if (!f) return;
    state.currentId = id;
    const allowed = (NAV[f.kind] || []).flatMap(g => g.items.map(i => i.page));
    if (!allowed.includes(state.page)) state.page = 'overview';
    goEditor(f, state.page);
  }

  /* ==========================================================================
     Toasts
     ========================================================================== */

  function notify(message, type = 'success') {
    const icons = { success: '✓', error: '!', warn: '!', info: 'i' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="ticon">${icons[type] || '·'}</span><span class="tmsg">${esc(message)}</span>`;
    toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
    }, type === 'error' ? 6500 : 4200);
  }

  /* ==========================================================================
     Session
     ========================================================================== */

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.files)) return;
      state.ui.crt = s.ui?.crt !== false;
      state.ui.bannerDismissed = !!s.ui?.bannerDismissed;
      for (const item of s.files) {
        if (!item || !item.id || !item.name || !isObj(item.data)) continue;
        const kind = detectKind(item.data);
        if (!kind) continue;
        state.files.push({
          id: item.id,
          name: item.name,
          kind,
          data: item.data,
          original: item.original || JSON.stringify(item.data),
          dirty: !!item.dirty,
          undo: [],
          redo: [],
          addedAt: item.addedAt || Date.now(),
          _lastPath: null,
          _lastAt: 0
        });
      }
      if (state.files.length) {
        const exists = state.files.some(f => f.id === s.currentId);
        state.currentId = exists ? s.currentId : state.files[0].id;
      }
    } catch (e) {
      console.warn('Could not restore session', e);
    }
  }

  function startFresh() {
    openConfirm({
      title: 'Clear this editor session?',
      text: 'This removes every loaded file from the editor and clears the browser session. Your files on disk are not touched. Download anything you want to keep first.',
      confirm: 'Clear session',
      danger: true,
      onConfirm: () => {
        state.files = [];
        state.currentId = null;
        state.page = 'overview';
        state.route = 'welcome';
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        closeModal();
        location.hash = '#/welcome';
        renderApp();
        notify('Session cleared', 'info');
      }
    });
  }

  /* ==========================================================================
     Clipboard
     ========================================================================== */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied to clipboard', 'success');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); notify('Copied to clipboard', 'success'); }
      catch (err) { notify('Could not copy', 'error'); }
      ta.remove();
    }
  }

  /* ==========================================================================
     Event handling
     ========================================================================== */

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const f = currentFile();

    switch (action) {
      case 'upload':
        event.preventDefault();
        fileInput.click();
        return;
      case 'download':
        if (f) downloadFile(f);
        return;
      case 'download-all':
        downloadAll();
        return;
      case 'home':
        state.route = 'welcome';
        location.hash = '#/welcome';
        renderApp();
        return;
      case 'open-editor':
        if (f) goEditor(f, state.page || 'overview');
        return;
      case 'open-file': {
        const target = state.files.find(file => file.id === el.dataset.id);
        if (target) { state.currentId = target.id; goEditor(target, 'overview'); }
        return;
      }
      case 'switch-file':
        switchFile(el.dataset.id);
        return;
      case 'remove-file': {
        const target = state.files.find(file => file.id === el.dataset.id) || f;
        if (!target) return;
        openConfirm({
          title: 'Remove from editor?',
          text: `“${target.name}” will be removed from this browser session. The file on disk is untouched. Any unsaved changes in the editor will be lost.`,
          confirm: 'Remove file',
          danger: true,
          onConfirm: () => {
            const idx = state.files.findIndex(file => file.id === target.id);
            if (idx >= 0) state.files.splice(idx, 1);
            if (state.currentId === target.id) {
              state.currentId = state.files[0]?.id || null;
              state.page = 'overview';
            }
            closeModal();
            persistNow();
            if (!state.files.length) {
              location.hash = '#/welcome';
              state.route = 'welcome';
              renderApp();
            } else {
              goEditor(currentFile(), state.page);
            }
            notify('File removed from editor', 'info');
          }
        });
        return;
      }
      case 'new-template': {
        const kind = el.dataset.kind;
        const fnew = createFile(defaultFilename(kind), kind, buildTemplate(kind));
        state.files.push(fnew);
        state.currentId = fnew.id;
        state.page = 'overview';
        persistNow();
        goEditor(fnew, 'overview');
        notify(`Created a fresh ${kindLabel(kind)} template`, 'success');
        return;
      }
      case 'toggle': {
        if (!f) return;
        const path = el.dataset.path;
        const value = !pathGet(f.data, path);
        commitField(f, path, value);
        el.classList.toggle('on', value);
        el.setAttribute('aria-pressed', value ? 'true' : 'false');
        const sw = el.querySelector('.switch');
        if (sw) sw.classList.toggle('on', value);
        const box = el.querySelector('.box');
        if (box) box.style.color = value ? '#fff' : 'transparent';
        refreshCounters(f);
        return;
      }
      case 'bulk': {
        if (!f) return;
        const bulk = el.dataset.bulk;
        if (CONFIRM_BULK[bulk]) {
          const c = CONFIRM_BULK[bulk];
          openConfirm({
            title: c.title,
            text: c.text,
            confirm: c.confirm,
            danger: !!c.danger,
            onConfirm: () => { closeModal(); applyBulk(f, bulk); }
          });
        } else {
          applyBulk(f, bulk);
        }
        return;
      }
      case 'reset-changes': {
        if (!f) return;
        openConfirm({
          title: 'Reset changes?',
          text: `Discard all unsaved edits to “${f.name}” and restore the file as it was loaded.`,
          confirm: 'Reset changes',
          danger: true,
          onConfirm: () => {
            f.data = JSON.parse(f.original);
            f.dirty = false;
            f.undo = [];
            f.redo = [];
            f._lastPath = null;
            closeModal();
            persistNow();
            renderApp({ preserveScroll: true });
            notify('Changes reset', 'info');
          }
        });
        return;
      }
      case 'undo': if (f) undo(f); return;
      case 'redo': if (f) redo(f); return;
      case 'open-picker': if (f) openPickerFor(f, el.dataset.picker); return;
      case 'picker-toggle': {
        const m = state.modal;
        if (!m || m.type !== 'picker') return;
        const id = Number(el.dataset.id);
        if (m.selected.has(id)) m.selected.delete(id);
        else m.selected.add(id);
        el.classList.toggle('on', m.selected.has(id));
        updatePickerCount();
        return;
      }
      case 'picker-clear': {
        const m = state.modal;
        if (!m) return;
        m.selected.clear();
        $$('#picker-list .picker-item').forEach(item => item.classList.remove('on'));
        updatePickerCount();
        return;
      }
      case 'picker-apply': {
        const m = state.modal;
        if (!m || m.type !== 'picker') return;
        const ids = [...m.selected].sort((a, b) => a - b);
        m.onApply(ids);
        return;
      }
      case 'modal-close':
        event.preventDefault();
        closeModal();
        return;
      case 'modal-backdrop':
        if (event.target === el) closeModal();
        return;
      case 'confirm-yes': {
        const m = state.modal;
        if (!m || m.type !== 'confirm') return;
        const fn = m.onConfirm;
        closeModal();
        if (fn) fn();
        return;
      }
      case 'set-tab': {
        const group = el.dataset.group;
        state.subTab[group] = el.dataset.tab;
        renderApp({ preserveScroll: true });
        return;
      }
      case 'apply-list': {
        if (!f) return;
        const path = el.dataset.path;
        const ta = document.querySelector(`[data-list-path="${CSS.escape(path)}"]`);
        if (!ta) return;
        const ids = ta.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
        const expected = Number(el.dataset.len || 0);
        if (expected && ids.length !== expected) {
          notify(`Expected ${expected} entries, found ${ids.length}. List was still applied.`, 'warn');
        }
        commit(f, () => pathSet(f.data, path, ids));
        renderApp({ preserveScroll: true });
        notify('List applied', 'success');
        return;
      }
      case 'randomize-list': {
        if (!f) return;
        const path = el.dataset.path;
        const max = Number(el.dataset.max || 0);
        commit(f, () => pathSet(f.data, path, shuffled(range(max + 1))));
        renderApp({ preserveScroll: true });
        notify('List randomized', 'success');
        return;
      }
      case 'reset-list': {
        if (!f) return;
        const path = el.dataset.path;
        const max = Number(el.dataset.max || 0);
        commit(f, () => pathSet(f.data, path, range(max + 1)));
        renderApp({ preserveScroll: true });
        notify('List reset', 'info');
        return;
      }
      case 'remove-array-item': {
        if (!f) return;
        const path = el.dataset.path;
        const index = Number(el.dataset.index);
        const arr = pathGet(f.data, path);
        if (!Array.isArray(arr)) return;
        commit(f, () => arr.splice(index, 1));
        renderApp({ preserveScroll: true });
        return;
      }
      case 'add-flag': {
        if (!f) return;
        const input = $('#flag-input');
        const value = (input?.value || '').trim();
        if (!value) { notify('Type a flag first', 'warn'); return; }
        const arr = f.data._UnlockFlags = Array.isArray(f.data._UnlockFlags) ? f.data._UnlockFlags : [];
        if (arr.includes(value)) { notify('That flag already exists', 'warn'); return; }
        commit(f, () => arr.push(value));
        renderApp({ preserveScroll: true });
        return;
      }
      case 'add-known-flag': {
        if (!f) return;
        const value = el.dataset.flag;
        const arr = f.data._UnlockFlags = Array.isArray(f.data._UnlockFlags) ? f.data._UnlockFlags : [];
        if (arr.includes(value)) { notify('That flag already exists', 'warn'); return; }
        commit(f, () => arr.push(value));
        renderApp({ preserveScroll: true });
        return;
      }
      case 'keybind-capture': {
        state.modal = { type: 'keybind', path: el.dataset.path };
        renderModal();
        return;
      }
      case 'apply-json-field': {
        if (!f) return;
        const path = el.dataset.path;
        const ta = document.querySelector(`[data-json-path="${CSS.escape(path)}"]`) || document.getElementById('json-' + path.replace(/\./g, '-')) || document.getElementById('json-' + path);
        const textarea = ta || document.querySelector(`#json-${CSS.escape(path)}`);
        const raw = textarea ? textarea.value : null;
        if (raw === null) return;
        try {
          const parsed = raw.trim() === '' ? null : JSON.parse(raw);
          commit(f, () => pathSet(f.data, path, parsed));
          renderApp({ preserveScroll: true });
          notify('JSON field applied', 'success');
        } catch (err) {
          notify(`Invalid JSON: ${err.message}`, 'error');
        }
        return;
      }
      case 'raw-apply': {
        if (!f) return;
        const ta = $('#raw-json');
        if (!ta) return;
        try {
          const parsed = parseSaveText(ta.value);
          const kind = detectKind(parsed);
          if (kind !== f.kind) throw new Error(`This JSON looks like a ${kind || 'unknown'} save, but the open file is ${kindLabel(f.kind)}.`);
          commit(f, () => { f.data = parsed; });
          renderApp({ preserveScroll: true });
          notify('JSON applied', 'success');
        } catch (err) {
          notify(`Could not apply JSON: ${err.message}`, 'error');
        }
        return;
      }
      case 'raw-format': {
        const ta = $('#raw-json');
        if (!ta) return;
        try {
          const parsed = JSON.parse(ta.value.replace(/\u0000+$/g, ''));
          ta.value = JSON.stringify(parsed, null, 2);
          const meta = $('#raw-meta');
          if (meta) meta.textContent = `${fmtInt(ta.value.length)} characters`;
          notify('JSON formatted', 'success');
        } catch (err) {
          notify(`Invalid JSON: ${err.message}`, 'error');
        }
        return;
      }
      case 'raw-copy': {
        const ta = $('#raw-json');
        if (ta) copyText(ta.value);
        return;
      }
      case 'add-missing-fields':
        if (f) addMissingFields(f);
        return;
      case 'start-fresh':
        startFresh();
        return;
      case 'about':
        openInfo('About Frickbear Editor', `v${APP_VERSION} · unofficial fan tool`, `<div class="stack">
          <p class="inline-note">A local-only save editor for <b>Frickbears 3 v2.0.0</b>. All game labels, upgrade names, trophy titles and challenge presets were extracted from the game's own <code>data.win</code> (GameMaker bytecode, decompiled with UndertaleModTool).</p>
          <p class="inline-note">Your save is parsed and edited in this browser tab. It is never uploaded. Downloads are generated with the browser's Blob API and include the trailing NUL byte the game expects.</p>
          <p class="inline-note"><b>Credits:</b> Frickbears 3 by 4LD. Pixel Operator font by Jayvee Enaguas (CC0). UndertaleModTool / Underanalyzer for decompilation. This tool is not affiliated with or endorsed by the Frickbears team.</p>
          <p class="inline-note"><b>Reminder:</b> always keep a copy of your original save files.</p>
        </div>`);
        return;
      case 'toggle-crt':
        return;
      default:
        return;
    }
  });

  // Input / change handling
  document.addEventListener('input', (event) => {
    const el = event.target;

    if (el.matches('[data-filter-grid]')) {
      const gridId = el.dataset.filterGrid;
      state.filters[gridId] = { ...(state.filters[gridId] || { role: 'all' }), q: el.value };
      applyFilter(gridId);
      return;
    }

    if (el.matches('[data-picker-search]')) {
      const q = el.value.trim().toLowerCase();
      $$('#picker-list .picker-item').forEach(item => {
        item.classList.toggle('hidden', !!q && !(item.dataset.search || '').includes(q));
      });
      return;
    }

    if (el.id === 'raw-json') {
      const meta = $('#raw-meta');
      if (meta) meta.textContent = `${fmtInt(el.value.length)} characters`;
      return;
    }

    if (el.id === 'crt-toggle') {
      state.ui.crt = el.checked;
      document.body.classList.toggle('no-crt', !state.ui.crt);
      persistSoon();
      return;
    }

    if (el.matches('[data-list-path]')) return;

    if (!el.dataset.path || !el.dataset.type) return;
    const f = currentFile();
    if (!f) return;

    let value;
    if (el.dataset.type === 'number') {
      if (el.value.trim() === '' || el.value === '-') return;
      value = Number(el.value);
      if (!Number.isFinite(value)) return;
    } else if (el.dataset.type === 'select') {
      const raw = el.value;
      if (el.dataset.coerce === 'number') value = Number(raw);
      else if (el.dataset.coerce === 'bool') value = raw === 'true';
      else if (el.dataset.coerce === 'night') value = /^\d+$/.test(raw) ? Number(raw) : raw;
      else value = raw;
    } else {
      value = el.value;
    }

    commitField(f, el.dataset.path, value);

    if (el.dataset.rerender) {
      renderApp({ preserveScroll: true });
    }
  });

  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el.id === 'mobile-file-select') { switchFile(el.value); return; }
    if (!el.matches('input[type="number"][data-path]')) return;
    const min = el.min !== '' ? Number(el.min) : null;
    const max = el.max !== '' ? Number(el.max) : null;
    let v = Number(el.value);
    if (!Number.isFinite(v)) return;
    if (min !== null && v < min) v = min;
    if (max !== null && v > max) v = max;
    if (v !== Number(el.value)) {
      el.value = String(v);
      const f = currentFile();
      if (f) commitField(f, el.dataset.path, v);
    }
  });

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-filter-role]');
    if (!el) return;
    const gridId = el.dataset.grid;
    state.filters[gridId] = { ...(state.filters[gridId] || { q: '' }), role: el.dataset.filterRole };
    $$(`[data-grid="${gridId}"]`).length; // no-op
    const toolbar = el.closest('.toolbar');
    if (toolbar) {
      toolbar.querySelectorAll('[data-filter-role]').forEach(b => b.classList.toggle('active', b === el));
    }
    applyFilter(gridId);
  });

  // Keyboard
  document.addEventListener('keydown', (event) => {
    if (state.modal?.type === 'keybind') {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
      event.preventDefault();
      const code = event.keyCode || event.which;
      if (!code) return;
      const f = currentFile();
      if (f) {
        commit(f, () => pathSet(f.data, state.modal.path, code));
        closeModal();
        renderApp({ preserveScroll: true });
        notify(`Bound to ${keyName(code)}`, 'success');
      }
      return;
    }
    if (state.modal && (event.key === 'Escape')) {
      event.preventDefault();
      closeModal();
      return;
    }
    const tag = (event.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      const f = currentFile();
      if (f) downloadFile(f);
      return;
    }
    if (mod && event.key.toLowerCase() === 'z') {
      if (typing) return;
      event.preventDefault();
      const f = currentFile();
      if (!f) return;
      if (event.shiftKey) redo(f); else undo(f);
      return;
    }
    if (mod && event.key.toLowerCase() === 'y') {
      if (typing) return;
      event.preventDefault();
      const f = currentFile();
      if (f) redo(f);
      return;
    }
  });

  // File picker
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) loadFiles(fileInput.files);
    fileInput.value = '';
  });

  // Drag & drop
  let dragDepth = 0;
  window.addEventListener('dragenter', (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    dragDepth++;
    dropOverlay.classList.add('show');
  });
  window.addEventListener('dragover', (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropOverlay.classList.remove('show');
  });
  window.addEventListener('drop', (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.remove('show');
    loadFiles(event.dataTransfer.files);
  });

  // Route changes
  window.addEventListener('hashchange', applyRoute);

  // Save session on exit
  window.addEventListener('pagehide', persistNow);
  window.addEventListener('beforeunload', (event) => {
    if (state.files.some(f => f.dirty)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  /* ==========================================================================
     Boot
     ========================================================================== */

  loadSession();
  document.body.classList.toggle('no-crt', !state.ui.crt);
  applyRoute();
})();
