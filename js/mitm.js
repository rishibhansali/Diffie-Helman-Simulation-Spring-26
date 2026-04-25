/**
 * mitm.js — Man-in-the-Middle attack simulation
 */
(() => {
  const canvas = document.getElementById('canvas');
  const ctx    = canvas.getContext('2d');

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  || 600;
    canvas.height = rect.height || 320;
  }
  resizeCanvas();

  const C = {
    bg:     '#0f0f1a',
    green:  '#00ff88',
    blue:   '#00aaff',
    red:    '#ff3366',
    yellow: '#ffcc00',
    text:   '#e0e0e0',
    muted:  '#555566',
  };

  let state = { phase: 'idle', arrows: [] };
  let animFrame = null, stepTimeout = null;

  function nodePositions() {
    const w = canvas.width, h = canvas.height;
    return {
      alice: { x: w * 0.12, y: h / 2, label: 'Alice', color: C.green },
      eve:   { x: w * 0.5,  y: h / 2, label: 'Eve',   color: C.red   },
      bob:   { x: w * 0.88, y: h / 2, label: 'Bob',   color: C.blue  },
    };
  }

  function drawNode(n, r = 28) {
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = n.color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#12121f';
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = n.color;
    ctx.font = `bold 11px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, n.x, n.y);

    ctx.fillStyle = C.muted;
    ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.fillText(n.color === C.red ? '👁 Attacker' : (n.label === 'Alice' ? 'Sender' : 'Receiver'), n.x, n.y + r + 13);
  }

  function drawArrow(from, to, progress, color, label, yOffset) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;
    const r = 30;
    const sx = from.x + ux * r, sy = from.y + uy * r + yOffset;
    const cx = (from.x + to.x) / 2, cy = (from.y + to.y) / 2 + yOffset;
    const ex = from.x + ux * (r + (len - 2*r) * progress);
    const ey = from.y + uy * (r + (len - 2*r) * progress) + yOffset;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8; ctx.shadowColor = color;
    ctx.setLineDash(color === C.red ? [6, 3] : []);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();

    if (progress >= 0.98) {
      const angle = Math.atan2(ey - sy, ex - sx);
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowBlur = 8; ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 9 * Math.cos(angle - 0.4), ey - 9 * Math.sin(angle - 0.4));
      ctx.lineTo(ex - 9 * Math.cos(angle + 0.4), ey - 9 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    ctx.save();
    ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my - 10);
    ctx.restore();
  }

  function render() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    const ns = nodePositions();
    drawNode(ns.alice);
    drawNode(ns.eve);
    drawNode(ns.bob);

    for (const a of state.arrows) {
      if (!a.done) {
        a.progress = Math.min(1, a.progress + 0.02);
        if (a.progress >= 1) a.done = true;
      }
      const from = ns[a.from], to = ns[a.to];
      drawArrow(from, to, a.progress, a.color, a.label, a.yOff || 0);
    }

    if (state.phase !== 'idle' && state.phase !== 'done') {
      animFrame = requestAnimationFrame(render);
    }
  }

  function drawIdle() {
    resizeCanvas();
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    const ns = nodePositions();
    drawNode(ns.alice); drawNode(ns.eve); drawNode(ns.bob);
    ctx.fillStyle = C.muted;
    ctx.font = `11px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('Press "Launch MITM Attack" to start', w/2, h * 0.12);
  }

  function set(id, val, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = typeof val === 'bigint' ? DHMath.displayNum(val) : val;
    if (cls) el.className = cls;
  }

  function activateStep(n) {
    for (let i = 1; i <= 5; i++) {
      const s = document.getElementById(`s${i}`);
      if (!s) continue;
      s.classList.remove('active');
      if (i <= n - 1) s.classList.add('done');
    }
    const cur = document.getElementById(`s${n}`);
    if (cur) cur.classList.add('active', 'done');
  }

  function addArrow(from, to, color, label, yOff) {
    state.arrows.push({ from, to, progress: 0, done: false, color, label, yOff: yOff || 0 });
  }

  function addMsg(who, msg, cls) {
    const lines = document.getElementById('msgLines');
    if (!lines) return;
    const div = document.createElement('div');
    div.className = 'mf-row';
    div.innerHTML = `<span class="mf-who">${who}:</span><span class="mf-msg ${cls}">${msg}</span>`;
    lines.appendChild(div);
  }

  async function delay(ms) {
    return new Promise(r => { stepTimeout = setTimeout(r, ms); });
  }

  async function runSim() {
    document.getElementById('btnRun').disabled = true;
    const banner = document.getElementById('resultBanner');
    banner.style.display = 'none';
    state = { phase: 'start', arrows: [] };
    animFrame = requestAnimationFrame(render);

    const p = DHMath.DEMO_PRIMES[32];
    const g = 5n;
    set('nP', DHMath.displayNum(p)); set('nG', g.toString());

    // Step 1
    activateStep(1);
    await delay(1000);

    // Step 2 — Alice generates & sends Y_A (Eve intercepts)
    activateStep(2);
    const { privateKey: xA, publicKey: yA } = DHMath.generateKeypair(p, g);
    set('nYA', DHMath.displayNum(yA));
    document.getElementById('s2math').textContent =
      `Y_A = ${g}^${xA} mod ${p} = ${DHMath.displayNum(yA)}`;
    addArrow('alice', 'eve', C.red, 'Y_A (intercepted!)', -30);
    await delay(1600);

    // Step 3 — Eve → Bob with her own key
    activateStep(3);
    const { privateKey: xE1, publicKey: yE1 } = DHMath.generateKeypair(p, g);
    const { privateKey: xE2, publicKey: yE2 } = DHMath.generateKeypair(p, g);
    set('nYE1', DHMath.displayNum(yE1));
    set('nYE2', DHMath.displayNum(yE2));
    document.getElementById('s3math').textContent =
      `Eve generates Y_E1 = ${DHMath.displayNum(yE1)} and sends to Bob`;
    addArrow('eve', 'bob', C.red, 'Y_E (from Eve)', -30);
    await delay(1600);

    // Bob sees Y_E, computes K2 = Y_E^xB mod p
    const { privateKey: xB, publicKey: yB } = DHMath.generateKeypair(p, g);
    set('nYB', DHMath.displayNum(yB));

    // Step 4 — Bob sends Y_B, Eve intercepts
    activateStep(4);
    document.getElementById('s4math').textContent =
      `Y_B = ${g}^${xB} mod ${p} = ${DHMath.displayNum(yB)}`;
    addArrow('bob', 'eve', C.red, 'Y_B (intercepted!)', 30);
    await delay(1600);

    // Eve → Alice with her other key
    addArrow('eve', 'alice', C.red, 'Y_E (from Eve)', 30);
    await delay(1600);

    // Step 5 — Compute split secrets
    activateStep(5);
    const K1 = DHMath.computeSharedSecret(yA, xE1, p);   // Alice & Eve
    const K2 = DHMath.computeSharedSecret(yB, xE2, p);   // Bob & Eve
    set('nK1', DHMath.displayNum(K1));
    set('nK2', DHMath.displayNum(K2));
    document.getElementById('s5math').textContent =
      `K1 (Alice↔Eve) = ${DHMath.displayNum(K1)}\nK2 (Bob↔Eve)   = ${DHMath.displayNum(K2)}\nK1 ≠ K2 — Eve controls both channels`;

    await delay(600);

    // Show message interception
    const msgFlow = document.getElementById('msgFlow');
    msgFlow.style.display = 'block';
    const msgLines = document.getElementById('msgLines');
    msgLines.innerHTML = '';

    const plaintext = 'Hello Bob, transfer $5000';
    addMsg('Alice', `Plaintext: "${plaintext}"`, 'green');
    await delay(500);
    addMsg('Alice', `Encrypted with K1: [cipher-K1]`, 'yellow');
    await delay(500);
    addMsg('Eve', `Intercepts! Decrypts with K1 → reads: "${plaintext}"`, 'red');
    await delay(500);
    addMsg('Eve', `Re-encrypts with K2, forwards to Bob: [cipher-K2]`, 'red');
    await delay(500);
    addMsg('Bob', `Decrypts with K2 → sees: "${plaintext}" — suspects nothing`, 'blue');

    state.phase = 'done';
    cancelAnimationFrame(animFrame);
    render();

    banner.className = 'result-banner red';
    banner.textContent = `MITM Attack Successful. Eve can read all messages. K1 ≠ K2 — two separate channels.`;
    banner.style.display = 'block';
    document.getElementById('btnRun').disabled = false;
  }

  function reset() {
    cancelAnimationFrame(animFrame);
    clearTimeout(stepTimeout);
    state = { phase: 'idle', arrows: [] };
    ['nP','nG','nYA','nYB','nYE1','nYE2','nK1','nK2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    for (let i = 2; i <= 5; i++) {
      const m = document.getElementById(`s${i}math`);
      if (m) m.textContent = '';
    }
    document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active','done'));
    const msgFlow = document.getElementById('msgFlow');
    if (msgFlow) { msgFlow.style.display = 'none'; document.getElementById('msgLines').innerHTML = ''; }
    document.getElementById('resultBanner').style.display = 'none';
    document.getElementById('btnRun').disabled = false;
    drawIdle();
  }

  document.getElementById('btnRun').addEventListener('click', runSim);
  document.getElementById('btnReset').addEventListener('click', reset);

  drawIdle();
})();
