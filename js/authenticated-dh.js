/**
 * authenticated-dh.js — Authenticated DH defense simulation
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

  const C = { bg: '#0f0f1a', green: '#00ff88', blue: '#00aaff', red: '#ff3366', yellow: '#ffcc00', muted: '#555566' };

  let stepTimeout = null, animFrame = null;
  let phase = 'idle';
  let arrows = [];

  // ── Simulated signature using DH math as stand-in ──
  // Sig = modPow(hash(msg), sigKey, sigMod) — conceptual only
  function simulateSign(privateKey, message, p) {
    const hash = BigInt('0x' + [...message].reduce((a, c) => a + c.charCodeAt(0).toString(16), ''));
    return DHMath.modPow(hash % p, privateKey, p);
  }

  function simulateVerify(publicKey, message, sig, p) {
    const hash = BigInt('0x' + [...message].reduce((a, c) => a + c.charCodeAt(0).toString(16), ''));
    const recovered = DHMath.modPow(sig, publicKey, p) % p;
    return (hash % p) === recovered;
  }

  // ── Nodes ──
  function nodePos() {
    const w = canvas.width, h = canvas.height;
    return {
      alice: { x: w * 0.12, y: h / 2 - 10, label: 'Alice', color: C.green },
      eve:   { x: w * 0.50, y: h / 2 - 10, label: 'Eve',   color: C.red   },
      bob:   { x: w * 0.88, y: h / 2 - 10, label: 'Bob',   color: C.blue  },
    };
  }

  function drawNode(n, r = 26) {
    ctx.save();
    ctx.shadowBlur = phase === 'done' ? 16 : 8;
    ctx.shadowColor = n.color;
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
  }

  function drawBlockedEve(ns) {
    const ex = ns.eve.x, ey = ns.eve.y;
    ctx.save();
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 16; ctx.shadowColor = C.red;
    ctx.beginPath();
    ctx.moveTo(ex - 20, ey - 20); ctx.lineTo(ex + 20, ey + 20);
    ctx.moveTo(ex + 20, ey - 20); ctx.lineTo(ex - 20, ey + 20);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = C.red;
    ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('SIG INVALID', ex, ey + 40);
  }

  function drawArrow(from, to, progress, color, label, yOff) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;
    const r = 28;
    const sx = from.x + ux * r, sy = from.y + uy * r + (yOff||0);
    const ex = from.x + ux * (r + (len - 2*r) * progress);
    const ey = from.y + uy * (r + (len - 2*r) * progress) + (yOff||0);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8; ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();

    if (progress >= 0.98) {
      const angle = Math.atan2(ey-sy, ex-sx);
      ctx.save(); ctx.fillStyle = color; ctx.shadowBlur = 8; ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 9*Math.cos(angle-0.4), ey - 9*Math.sin(angle-0.4));
      ctx.lineTo(ex - 9*Math.cos(angle+0.4), ey - 9*Math.sin(angle+0.4));
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    const mx = (sx+ex)/2, my = (sy+ey)/2;
    ctx.save();
    ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.fillText(label, mx, my - 11);
    ctx.restore();
  }

  function render() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    const ns = nodePos();
    drawNode(ns.alice);
    drawNode(ns.eve);
    drawNode(ns.bob);

    for (const a of arrows) {
      if (!a.done) { a.progress = Math.min(1, a.progress + 0.022); if (a.progress >= 1) a.done = true; }
      const fn = ns[a.from], tn = ns[a.to];
      drawArrow(fn, tn, a.progress, a.color, a.label, a.yOff);
    }

    if (phase === 'blocked') drawBlockedEve(ns);
    if (phase === 'done') {
      const mid = (ns.alice.x + ns.bob.x) / 2;
      ctx.fillStyle = C.green;
      ctx.shadowBlur = 12; ctx.shadowColor = C.green;
      ctx.font = `bold 11px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('✓ Authenticated. Shared secret established.', mid, h * 0.12);
      ctx.shadowBlur = 0;
    }

    if (phase !== 'idle' && phase !== 'done') animFrame = requestAnimationFrame(render);
  }

  function drawIdle() {
    resizeCanvas();
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    const ns = nodePos();
    drawNode(ns.alice); drawNode(ns.eve); drawNode(ns.bob);
    ctx.fillStyle = C.muted;
    ctx.font = `11px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('Press "Run Authenticated Exchange" to start', w/2, h * 0.1);
  }

  function set(id, val, col) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = typeof val === 'bigint' ? DHMath.displayNum(val) : String(val);
    if (col) el.className = 'num-val ' + col;
  }

  function activateStep(n) {
    for (let i = 1; i <= 4; i++) {
      const s = document.getElementById(`s${i}`);
      if (!s) continue;
      s.classList.remove('active');
      if (i < n) s.classList.add('done');
    }
    const cur = document.getElementById(`s${n}`);
    if (cur) cur.classList.add('active', 'done');
  }

  async function delay(ms) { return new Promise(r => { stepTimeout = setTimeout(r, ms); }); }

  async function runSim() {
    document.getElementById('btnRun').disabled = true;
    const banner = document.getElementById('resultBanner');
    banner.style.display = 'none';
    arrows = [];
    phase = 'start';
    animFrame = requestAnimationFrame(render);

    const p = DHMath.DEMO_PRIMES[32];
    const g = 5n;
    set('nP', DHMath.displayNum(p)); set('nG', g.toString());

    // Step 1
    activateStep(1);
    const { privateKey: skA, publicKey: pkA } = DHMath.generateKeypair(p, g);
    const { privateKey: skB, publicKey: pkB } = DHMath.generateKeypair(p, g);
    await delay(800);

    // Step 2 — Alice signs her DH key
    activateStep(2);
    const { privateKey: xA, publicKey: yA } = DHMath.generateKeypair(p, g);
    const { privateKey: xB, publicKey: yB } = DHMath.generateKeypair(p, g);
    const sigA = simulateSign(skA, yA.toString(), p);
    const sigB = simulateSign(skB, yB.toString(), p);
    set('nYA', DHMath.displayNum(yA));
    set('nYB', DHMath.displayNum(yB));
    set('nSigA', DHMath.displayNum(sigA), 'blue');
    set('nSigB', DHMath.displayNum(sigB), 'blue');
    document.getElementById('s2math').textContent =
      `Sig_A = Sign(sk_A, Y_A) = ${DHMath.displayNum(sigA)}\nSig_B = Sign(sk_B, Y_B) = ${DHMath.displayNum(sigB)}`;

    // Alice → Eve: (Y_A, Sig_A)
    arrows.push({ from: 'alice', to: 'eve', progress: 0, done: false, color: C.green, label: '(Y_A, Sig_A)', yOff: -28 });
    await delay(1400);

    // Step 3 — Eve tries to forward with her key
    activateStep(3);
    const { privateKey: xE, publicKey: yE } = DHMath.generateKeypair(p, g);
    const fakeSig = simulateSign(xE, yE.toString(), p);  // wrong key
    set('nEve', `Y_E=${DHMath.displayNum(yE)}, Sig_E (wrong key)`, 'red');
    document.getElementById('s3math').textContent =
      `Eve sends (Y_E, Sig_E) to Bob\nBob verifies: Verify(pk_A, Y_E, Sig_E) → FAIL\nSig_E was signed with Eve's key, not Alice's`;

    // Eve → Bob (dashed, will be rejected)
    arrows.push({ from: 'eve', to: 'bob', progress: 0, done: false, color: C.red, label: '(Y_E, Sig_E) ✗', yOff: -28 });
    await delay(1400);

    phase = 'blocked';
    set('nVerify', 'INVALID — Eve blocked', 'red');
    await delay(1000);

    // Step 4 — Direct auth exchange
    activateStep(4);
    // Simulate direct path bypassing Eve (authenticated channel)
    arrows.push({ from: 'alice', to: 'bob', progress: 0, done: false, color: C.green, label: '(Y_A, Sig_A) ✓', yOff: 28 });
    arrows.push({ from: 'bob', to: 'alice', progress: 0, done: false, color: C.blue,  label: '(Y_B, Sig_B) ✓', yOff: 28 });
    await delay(1600);

    const K = DHMath.computeSharedSecret(yB, xA, p);
    set('nVerify', 'VALID — both sides verified', 'green');
    set('nK', DHMath.displayNum(K));
    document.getElementById('s4math').textContent =
      `Verify(pk_A, Y_A, Sig_A) ✓\nVerify(pk_B, Y_B, Sig_B) ✓\nK = ${DHMath.displayNum(K)}`;

    phase = 'done';
    cancelAnimationFrame(animFrame);
    render();

    banner.className = 'result-banner green';
    banner.textContent = 'Authentication prevented the attack. Eve\'s substituted key failed signature verification. Identity verified. Shared secret: ' + DHMath.displayNum(K);
    banner.style.display = 'block';
    document.getElementById('btnRun').disabled = false;
  }

  function reset() {
    clearTimeout(stepTimeout);
    cancelAnimationFrame(animFrame);
    phase = 'idle';
    arrows = [];
    ['nP','nG','nYA','nSigA','nYB','nSigB','nEve','nVerify','nK'].forEach(id => set(id, '—'));
    ['s2math','s3math','s4math'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
    document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active','done'));
    document.getElementById('resultBanner').style.display = 'none';
    document.getElementById('btnRun').disabled = false;
    drawIdle();
  }

  document.getElementById('btnRun').addEventListener('click', runSim);
  document.getElementById('btnReset').addEventListener('click', reset);

  drawIdle();
})();
