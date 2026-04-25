/**
 * forward-secrecy.js — PFS simulation
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

  let mode = 'static';   // 'static' | 'ephemeral'
  let stepTimeout = null, animFrame = null;
  let vaultStates = ['locked', 'locked', 'locked'];

  // ── Canvas ──
  function drawScene(phase, isEphemeral) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    const aX = w * 0.15, bX = w * 0.80, nY = h * 0.35;

    // Nodes
    [['Alice', aX, C.green], ['Bob', bX, C.blue]].forEach(([l, x, c]) => {
      ctx.save();
      ctx.shadowBlur = 10; ctx.shadowColor = c;
      ctx.beginPath();
      ctx.arc(x, nY, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#12121f';
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = c;
      ctx.font = `bold 11px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l, x, nY);
    });

    // Key label under Alice
    ctx.fillStyle = isEphemeral ? C.green : C.yellow;
    ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(isEphemeral ? 'Ephemeral keys' : 'Static long-term key', aX, nY + 40);

    // Vault row at bottom
    const vaultY = h * 0.67, vW = 70, vH = 50, gap = 20;
    const totalW = 3 * vW + 2 * gap;
    const vStart = (w - totalW) / 2;

    ['Session 1', 'Session 2', 'Session 3'].forEach((label, i) => {
      const vx = vStart + i * (vW + gap);
      const open = vaultStates[i] === 'open';
      const col  = open ? C.red : C.green;

      ctx.save();
      ctx.shadowBlur = 8; ctx.shadowColor = col;
      ctx.fillStyle = '#12121f';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.fillRect(vx, vaultY, vW, vH);
      ctx.strokeRect(vx, vaultY, vW, vH);
      ctx.restore();

      ctx.fillStyle = col;
      ctx.font = `14px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(open ? '🔓' : '🔒', vx + vW/2, vaultY + vH/2 - 6);

      ctx.fillStyle = col;
      ctx.font = `8px 'JetBrains Mono', monospace`;
      ctx.fillText(label, vx + vW/2, vaultY + vH - 8);
    });

    // Attacker icon if relevant
    if (phase === 'leaked') {
      const eX = w * 0.5, eY = nY;
      ctx.save();
      ctx.shadowBlur = 16; ctx.shadowColor = C.red;
      ctx.beginPath();
      ctx.arc(eX, eY, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#12121f';
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.red;
      ctx.font = `14px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👾', eX, eY);
      ctx.font = `8px 'JetBrains Mono', monospace`;
      ctx.fillText('Attacker', eX, eY + 30);
      ctx.fillStyle = C.red;
      ctx.fillText('KEY LEAKED', eX, eY - 30);
    }

    ctx.fillStyle = C.muted;
    ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('Recorded sessions (vault)', w/2, vaultY - 10);
  }

  function log(msg, cls = 'msg-blue') {
    const container = document.getElementById('sessionLog');
    const div = document.createElement('div');
    div.className = 'log-entry';
    const ts = new Date().toLocaleTimeString();
    div.innerHTML = `<span class="ts">[${ts}]</span> <span class="${cls}">${msg}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function set(id, val, col) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = typeof val === 'bigint' ? DHMath.displayNum(val) : String(val);
    if (col) { el.className = 'num-val ' + col; }
  }

  function activateStep(n) {
    for (let i = 1; i <= 3; i++) {
      const s = document.getElementById(`s${i}`);
      if (!s) continue;
      s.classList.remove('active');
      if (i < n) s.classList.add('done');
    }
    const cur = document.getElementById(`s${n}`);
    if (cur) cur.classList.add('active', 'done');
  }

  async function delay(ms) { return new Promise(r => { stepTimeout = setTimeout(r, ms); }); }

  function setVault(i, state) {
    vaultStates[i] = state;
    const box = document.getElementById(`vault${i + 1}`);
    const status = document.getElementById(`vault${i + 1}status`);
    if (!box || !status) return;
    if (state === 'open') {
      box.style.borderColor = 'var(--red)';
      status.style.color = 'var(--red)';
      status.textContent = 'DECRYPTED';
    } else if (state === 'secure') {
      box.style.borderColor = 'var(--green)';
      status.style.color = 'var(--green)';
      status.textContent = 'Secure (PFS)';
    } else {
      box.style.borderColor = '';
      status.style.color = 'var(--text-muted)';
      status.textContent = 'Recorded';
    }
  }

  async function runSim() {
    document.getElementById('btnRun').disabled = true;
    const banner = document.getElementById('resultBanner');
    banner.style.display = 'none';
    document.getElementById('sessionLog').innerHTML = '';
    vaultStates = ['locked', 'locked', 'locked'];
    document.getElementById('vaultRow').style.display = 'flex';

    const isEphemeral = mode === 'ephemeral';
    set('nMode', isEphemeral ? 'Ephemeral Keys (PFS)' : 'Static Keys (No PFS)', isEphemeral ? 'green' : 'yellow');

    const p = DHMath.DEMO_PRIMES[32];
    const g = 5n;

    // Generate long-term key for Alice
    const { privateKey: xLT, publicKey: yLT } = DHMath.generateKeypair(p, g);
    set('nKeyLT', DHMath.displayNum(xLT), 'yellow');

    drawScene('sessions', isEphemeral);

    // Step 1 — 3 sessions
    activateStep(1);
    const sessions = [];
    for (let i = 0; i < 3; i++) {
      let xA, yA;
      if (isEphemeral) {
        const eph = DHMath.generateKeypair(p, g);
        xA = eph.privateKey; yA = eph.publicKey;
      } else {
        xA = xLT; yA = yLT;
      }
      const { privateKey: xB, publicKey: yB } = DHMath.generateKeypair(p, g);
      const K = DHMath.computeSharedSecret(yB, xA, p);
      sessions.push({ xA, yA, yB, K });
      set(`nK${i+1}`, DHMath.displayNum(K), 'blue');
      log(`Session ${i+1}: K = ${DHMath.displayNum(K)} (${isEphemeral ? 'ephemeral' : 'static'} key)`, 'msg-blue');
      await delay(600);
    }

    log('--- Adversary records all ciphertext ---', 'msg-yellow');
    await delay(500);

    // Step 2 — Key leaked
    activateStep(2);
    set('nLeaked', DHMath.displayNum(xLT), 'red');
    log('⚠ KEY LEAK EVENT: Alice long-term private key exposed!', 'msg-red');
    drawScene('leaked', isEphemeral);
    await delay(1200);

    // Step 3 — Consequence
    activateStep(3);
    if (!isEphemeral) {
      // Static: attacker can recompute all session keys
      for (let i = 0; i < 3; i++) {
        const recovered = DHMath.computeSharedSecret(sessions[i].yB, xLT, p);
        log(`Session ${i+1}: K recovered = ${DHMath.displayNum(recovered)} ✓ DECRYPTED`, 'msg-red');
        setVault(i, 'open');
        drawScene('leaked', isEphemeral);
        await delay(500);
      }
      set('nDecrypt', 'YES — all 3 sessions exposed', 'red');
      document.getElementById('s3math').textContent =
        'Static: leaked X_A → reconstruct K_i = Y_Bi^X_A mod p for all i → ALL sessions broken';
      banner.className = 'result-banner red';
      banner.textContent = 'Past session compromised. Static keys have no forward secrecy — one leaked key exposes every past session.';
    } else {
      // Ephemeral: ephemeral xA already discarded — cannot recompute
      for (let i = 0; i < 3; i++) {
        log(`Session ${i+1}: ephemeral key discarded after session — K cannot be recovered`, 'msg-green');
        setVault(i, 'secure');
        drawScene('leaked', isEphemeral);
        await delay(500);
      }
      set('nDecrypt', 'NO — sessions remain secure', 'green');
      document.getElementById('s3math').textContent =
        'Ephemeral: X_Ai were deleted after each session. Leaked long-term key ≠ session key → sessions unrecoverable';
      banner.className = 'result-banner green';
      banner.textContent = 'Past sessions remain secure. Ephemeral keys ensure forward secrecy — the leaked key is useless for past traffic.';
    }

    banner.style.display = 'block';
    document.getElementById('btnRun').disabled = false;
  }

  function reset() {
    clearTimeout(stepTimeout);
    cancelAnimationFrame(animFrame);
    vaultStates = ['locked', 'locked', 'locked'];
    document.getElementById('sessionLog').innerHTML = '';
    document.getElementById('vaultRow').style.display = 'none';
    ['nMode','nKeyLT','nK1','nK2','nK3','nLeaked','nDecrypt'].forEach(id => set(id, '—'));
    document.getElementById('s3math').textContent = '';
    document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active','done'));
    document.getElementById('resultBanner').style.display = 'none';
    document.getElementById('btnRun').disabled = false;
    drawScene('idle', mode === 'ephemeral');
  }

  document.getElementById('btnRun').addEventListener('click', runSim);
  document.getElementById('btnReset').addEventListener('click', reset);

  document.getElementById('toggleStatic').addEventListener('click', () => {
    mode = 'static';
    document.getElementById('toggleStatic').classList.add('active');
    document.getElementById('toggleEphemeral').classList.remove('active');
    document.getElementById('canvasDot').className = 'panel-dot red';
    document.getElementById('scenarioDesc').innerHTML =
      '<strong style="color:var(--red)">Scenario: Static Keys (No PFS)</strong><br>Alice and Bob reuse the same long-term DH key pair for every session. An adversary records all encrypted traffic. Later, Alice\'s private key is stolen. The adversary can now decrypt every recorded session retroactively.';
    reset();
  });

  document.getElementById('toggleEphemeral').addEventListener('click', () => {
    mode = 'ephemeral';
    document.getElementById('toggleEphemeral').classList.add('active');
    document.getElementById('toggleStatic').classList.remove('active');
    document.getElementById('canvasDot').className = 'panel-dot';
    document.getElementById('scenarioDesc').innerHTML =
      '<strong style="color:var(--green)">Scenario: Ephemeral Keys (With PFS)</strong><br>Alice and Bob generate a fresh DH key pair for every session and discard the private key immediately after. Even if Alice\'s long-term key is stolen later, the attacker cannot reconstruct past session keys — they were never stored.';
    reset();
  });

  drawScene('idle', false);
})();
