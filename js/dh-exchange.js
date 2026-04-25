/**
 * dh-exchange.js — Normal DH key exchange simulation
 */
(() => {
  const canvas = document.getElementById('canvas');
  const ctx    = canvas.getContext('2d');

  // Resize canvas to its CSS display size
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  || 600;
    canvas.height = rect.height || 320;
  }
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); drawIdle(); });

  // ── Colours ──
  const C = {
    bg:     '#0f0f1a',
    green:  '#00ff88',
    blue:   '#00aaff',
    text:   '#e0e0e0',
    muted:  '#555566',
    border: '#1e1e30',
  };

  // ── State ──
  let state = { phase: 'idle', arrows: [], p: 0n, g: 0n, XA: 0n, YA: 0n, XB: 0n, YB: 0n, K: 0n };
  let animFrame = null;
  let stepTimeout = null;

  // ── Node positions (fractions of canvas) ──
  function nodes() {
    const w = canvas.width, h = canvas.height;
    return {
      alice: { x: w * 0.18, y: h / 2, label: 'Alice', color: C.green },
      bob:   { x: w * 0.82, y: h / 2, label: 'Bob',   color: C.blue  },
    };
  }

  function drawNode(n, glow) {
    const r = 32;
    if (glow) {
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = n.color;
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#12121f';
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    if (glow) ctx.restore();

    ctx.fillStyle = n.color;
    ctx.font = `bold 12px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, n.x, n.y);

    ctx.fillStyle = C.muted;
    ctx.font = `10px 'JetBrains Mono', monospace`;
    ctx.fillText(n.label === 'Alice' ? 'Initiator' : 'Responder', n.x, n.y + r + 14);
  }

  function drawArrow(from, to, progress, color, label, above) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;
    const r = 36;
    const sx = from.x + ux * r, sy = from.y + uy * r;
    const ex = from.x + ux * (r + (len - 2*r) * progress);
    const ey = from.y + uy * (r + (len - 2*r) * progress);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    if (progress >= 0.98) {
      // arrowhead
      const angle = Math.atan2(ey - sy, ex - sx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 10 * Math.cos(angle - 0.4), ey - 10 * Math.sin(angle - 0.4));
      ctx.lineTo(ex - 10 * Math.cos(angle + 0.4), ey - 10 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // label
    const mx = sx + (ex - sx) / 2, my = sy + (ey - sy) / 2;
    ctx.save();
    ctx.font = `10px 'JetBrains Mono', monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my + (above ? -14 : 14));
    ctx.restore();
  }

  function drawSharedKey(ns) {
    const mid = (ns.alice.x + ns.bob.x) / 2;
    const y = canvas.height * 0.78;
    ctx.save();
    ctx.font = `bold 11px 'JetBrains Mono', monospace`;
    ctx.fillStyle = C.green;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12; ctx.shadowColor = C.green;
    ctx.fillText('✓ Shared Secret K established', mid, y);
    ctx.restore();
  }

  function render(ts) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    const ns = nodes();

    // public params label
    if (state.phase !== 'idle' && state.p) {
      ctx.fillStyle = C.muted;
      ctx.font = `9px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`Public: p=${DHMath.displayNum(state.p, 10)}, g=${state.g}`, w/2, 18);
    }

    drawNode(ns.alice, state.phase === 'done');
    drawNode(ns.bob,   state.phase === 'done');

    // draw in-flight arrows
    for (const arrow of state.arrows) {
      if (!arrow.done) {
        arrow.progress = Math.min(1, arrow.progress + 0.018);
        if (arrow.progress >= 1) arrow.done = true;
      }
      const from = arrow.dir === 'ab' ? ns.alice : ns.bob;
      const to   = arrow.dir === 'ab' ? ns.bob   : ns.alice;
      drawArrow(from, to, arrow.progress, arrow.color, arrow.label, arrow.above);
    }

    if (state.phase === 'done') drawSharedKey(ns);

    if (state.phase !== 'idle' && state.phase !== 'done') {
      animFrame = requestAnimationFrame(render);
    }
  }

  function drawIdle() {
    resizeCanvas();
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    const ns = nodes();
    drawNode(ns.alice, false);
    drawNode(ns.bob, false);
    ctx.fillStyle = C.muted;
    ctx.font = `11px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('Press "Run Simulation" to start', w/2, h/2);
  }

  function setNum(id, val, fallback) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined ? DHMath.displayNum(val) : fallback || '—';
  }

  function activateStep(n) {
    document.querySelectorAll('.step-item').forEach((el, i) => {
      el.classList.remove('active');
      if (i < n - 1) el.classList.add('done');
    });
    const s = document.getElementById(`s${n}`);
    if (s) s.classList.add('active', 'done');
  }

  async function delay(ms) {
    return new Promise(r => { stepTimeout = setTimeout(r, ms); });
  }

  async function runSim() {
    document.getElementById('btnRun').disabled = true;
    const banner = document.getElementById('resultBanner');
    banner.style.display = 'none';

    // Generate parameters (use small prime for speed in demo)
    const p = DHMath.DEMO_PRIMES[32];
    const g = 5n;
    state = { phase: 'params', arrows: [], p, g };
    animFrame = requestAnimationFrame(render);

    setNum('nP', p); setNum('nG', g);

    // Step 1
    activateStep(1);
    document.getElementById('s1math').textContent = `p = ${p.toString()}, g = ${g.toString()}`;
    await delay(1200);

    // Step 2 — Alice generates keys
    state.phase = 'alice';
    activateStep(2);
    const { privateKey: XA, publicKey: YA } = DHMath.generateKeypair(p, g);
    state.XA = XA; state.YA = YA;
    setNum('nXA', XA); setNum('nYA', YA);
    document.getElementById('s2math').textContent =
      `X_A = ${XA.toString()}\nY_A = ${g}^${XA} mod ${p} = ${YA}`;
    await delay(900);

    // Alice → Bob: send YA
    state.arrows.push({ dir: 'ab', progress: 0, done: false, color: C.green, label: `Y_A = ${DHMath.displayNum(YA, 8)}`, above: true });
    await delay(1400);

    // Step 3 — Bob generates keys
    state.phase = 'bob';
    activateStep(3);
    const { privateKey: XB, publicKey: YB } = DHMath.generateKeypair(p, g);
    state.XB = XB; state.YB = YB;
    setNum('nXB', XB); setNum('nYB', YB);
    document.getElementById('s3math').textContent =
      `X_B = ${XB.toString()}\nY_B = ${g}^${XB} mod ${p} = ${YB}`;
    await delay(900);

    // Bob → Alice: send YB
    state.arrows.push({ dir: 'ba', progress: 0, done: false, color: C.blue, label: `Y_B = ${DHMath.displayNum(YB, 8)}`, above: false });
    await delay(1400);

    // Step 4 — Compute shared secret
    state.phase = 'secret';
    activateStep(4);
    const KA = DHMath.computeSharedSecret(YB, XA, p);
    const KB = DHMath.computeSharedSecret(YA, XB, p);
    state.K = KA;
    setNum('nKA', KA);
    setNum('nKB', KB);
    setNum('nK',  KA);
    document.getElementById('s4math').textContent =
      `K (Alice) = ${YB}^${XA} mod ${p} = ${KA}\nK (Bob) = ${YA}^${XB} mod ${p} = ${KB}\nMatch: ${KA === KB}`;

    await delay(800);

    // Step 5
    activateStep(5);
    state.phase = 'done';
    cancelAnimationFrame(animFrame);
    render();

    banner.className = 'result-banner green';
    banner.textContent = `Secure channel established. Shared secret K = ${DHMath.displayNum(KA)}`;
    banner.style.display = 'block';
    document.getElementById('btnRun').disabled = false;
  }

  function reset() {
    cancelAnimationFrame(animFrame);
    clearTimeout(stepTimeout);
    state = { phase: 'idle', arrows: [] };
    ['nP','nG','nXA','nYA','nXB','nYB','nKA','nKB','nK'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = '—'; el.className = 'num-val muted'; }
    });
    ['s1math','s2math','s3math','s4math'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active','done'));
    const banner = document.getElementById('resultBanner');
    banner.style.display = 'none';
    document.getElementById('btnRun').disabled = false;
    drawIdle();
  }

  document.getElementById('btnRun').addEventListener('click', runSim);
  document.getElementById('btnReset').addEventListener('click', reset);

  drawIdle();
})();
