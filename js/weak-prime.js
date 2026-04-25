/**
 * weak-prime.js — Brute-force weak prime attack simulation
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

  let animFrame = null, stopRequested = false;
  let particles = [];

  // ── Canvas renderer ──
  function renderAttack(progress, attempts, found, bits) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // Draw attacker terminal style
    const col = found ? C.green : (progress < 1 ? C.yellow : C.red);

    ctx.fillStyle = C.muted;
    ctx.font = `10px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`[ATTACKER] Brute forcing ${bits}-bit DLP...`, 16, 28);

    // Progress bar
    const barX = 16, barY = 48, barW = w - 32, barH = 14;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = col;
    ctx.shadowBlur = found ? 12 : 4;
    ctx.shadowColor = col;
    ctx.fillRect(barX, barY, barW * Math.min(progress, 1), barH);
    ctx.shadowBlur = 0;

    // Attempt counter
    ctx.fillStyle = col;
    ctx.font = `bold 13px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`Attempts: ${attempts.toLocaleString()}`, w/2, 82);

    if (found !== null) {
      ctx.fillStyle = C.green;
      ctx.shadowBlur = 16; ctx.shadowColor = C.green;
      ctx.font = `bold 15px 'JetBrains Mono', monospace`;
      ctx.fillText(`✓ Private key found: X_A = ${found}`, w/2, 115);
      ctx.shadowBlur = 0;
    }

    // Particle effect
    if (!found) {
      particles = particles.filter(p => p.life > 0);
      if (particles.length < 30 && progress < 1) {
        particles.push({
          x: Math.random() * w, y: h * 0.6,
          vx: (Math.random() - 0.5) * 2,
          vy: -(Math.random() * 2 + 1),
          life: 60, color: C.yellow,
        });
      }
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life--;
        ctx.save();
        ctx.globalAlpha = p.life / 60;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
        ctx.restore();
      }
    }

    // Nodes
    const aX = w * 0.15, bX = w * 0.85, nY = h * 0.78;
    [[aX, C.green, 'Alice'], [bX, C.blue, 'Bob']].forEach(([x, c, l]) => {
      ctx.beginPath();
      ctx.arc(x, nY, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#12121f';
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = c;
      ctx.font = `bold 10px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l, x, nY);
    });

    // Attacker in middle (skull)
    const eX = w / 2, eY = nY;
    ctx.beginPath();
    ctx.arc(eX, eY, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#12121f';
    ctx.strokeStyle = found ? C.green : C.red;
    ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = found ? C.green : C.red;
    ctx.font = `16px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(found ? '✓' : '💀', eX, eY);

    if (found) {
      ctx.fillStyle = C.red;
      ctx.font = `9px 'JetBrains Mono', monospace`;
      ctx.fillText('SESSION COMPROMISED', eX, eY + 36);
    }
  }

  function drawIdle() {
    resizeCanvas();
    renderAttack(0, 0, null, document.getElementById('primeSel').value);
  }

  function setNum(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof val === 'bigint' ? DHMath.displayNum(val) : String(val);
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

  async function runSim() {
    stopRequested = false;
    document.getElementById('btnRun').disabled = true;
    const banner = document.getElementById('resultBanner');
    banner.style.display = 'none';
    const bits = parseInt(document.getElementById('primeSel').value, 10);

    setNum('nBits', `${bits}-bit`);

    // Step 1: DH exchange
    activateStep(1);
    const p = DHMath.DEMO_PRIMES[bits] || DHMath.generatePrime(bits);
    const g = 5n;
    setNum('nP', p); setNum('nG', g);

    const { privateKey: xA, publicKey: yA } = DHMath.generateKeypair(p, g);
    setNum('nXA', xA);
    setNum('nYA', yA);
    setNum('nAttempts', '0');
    setNum('nFound', '—');
    document.getElementById('s1math').textContent =
      `p = ${DHMath.displayNum(p)}, g = ${g}, Y_A = ${DHMath.displayNum(yA)}`;

    renderAttack(0, 0, null, bits);

    if (bits >= 2048) {
      // Theoretical — don't run
      activateStep(2);
      activateStep(3);
      document.getElementById('s3math').textContent =
        `2^2048 ≈ 10^617 possible values. At 10^12 guesses/second, time ≈ 10^605 years — heat death of the universe at ~10^100 years.`;
      setNum('nAttempts', '> 10^617');
      setNum('nFound', 'Infeasible');
      renderAttack(0.0001, 0, null, bits);
      banner.className = 'result-banner green';
      banner.textContent = 'Brute force infeasible. A 2048-bit prime would take longer than the age of the universe to crack.';
      banner.style.display = 'block';
      document.getElementById('btnRun').disabled = false;
      return;
    }

    // Step 2: brute force
    activateStep(2);
    const crackProgress = document.getElementById('crackProgress');
    crackProgress.style.display = 'block';

    const maxSearch = p < 2000000n ? p : 2000000n;
    let attempts = 0;
    let foundX = null;
    const startTime = performance.now();

    const BATCH = 500;
    for (let x = 1n; x < maxSearch && !stopRequested; x += BigInt(BATCH)) {
      for (let dx = 0n; dx < BigInt(BATCH) && x + dx < maxSearch; dx++) {
        const candidate = x + dx;
        const val = DHMath.modPow(g, candidate, p);
        attempts++;
        if (val === yA) { foundX = candidate; break; }
      }
      if (foundX) break;

      const prog = Number(x) / Number(maxSearch);
      setNum('nAttempts', attempts.toLocaleString());
      document.getElementById('cpAttempts').textContent = attempts.toLocaleString();
      document.getElementById('cpCurrent').textContent = x.toString();
      document.getElementById('cpResult').textContent  = DHMath.modPow(g, x, p).toString();
      document.getElementById('progressBar').style.width = `${(prog * 100).toFixed(1)}%`;
      renderAttack(prog, attempts, null, bits);

      // yield to browser every batch
      await new Promise(r => setTimeout(r, 0));
    }

    const elapsed = performance.now() - startTime;
    setNum('nAttempts', attempts.toLocaleString());
    document.getElementById('progressBar').style.width = '100%';

    activateStep(3);
    if (foundX !== null) {
      setNum('nFound', foundX.toString());
      document.getElementById('s3math').textContent =
        `Found X_A = ${foundX} in ${attempts} attempts (${elapsed.toFixed(1)} ms)\nVerify: ${g}^${foundX} mod ${p} = ${DHMath.modPow(g, foundX, p)} ✓`;
      renderAttack(1, attempts, foundX.toString(), bits);
      banner.className = 'result-banner red';
      banner.textContent = `Private key cracked in ${attempts.toLocaleString()} attempts (${elapsed.toFixed(1)} ms). Full session compromise.`;
    } else {
      setNum('nFound', 'Not in range');
      document.getElementById('s3math').textContent =
        `Searched ${attempts} values in ${elapsed.toFixed(1)} ms. Key space too large for full brute force.`;
      renderAttack(1, attempts, null, bits);
      banner.className = 'result-banner yellow';
      banner.textContent = `Searched ${attempts.toLocaleString()} values — key not in demo search range. In practice, ${bits}-bit primes are ${DHMath.estimateCrackTime(bits)} to crack.`;
    }

    banner.style.display = 'block';
    document.getElementById('btnRun').disabled = false;
  }

  function reset() {
    stopRequested = true;
    cancelAnimationFrame(animFrame);
    particles = [];
    ['nBits','nP','nG','nXA','nYA','nFound'].forEach(id => setNum(id, '—'));
    setNum('nAttempts', '0');
    ['s1math','s3math'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
    document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active','done'));
    document.getElementById('crackProgress').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('resultBanner').style.display = 'none';
    document.getElementById('btnRun').disabled = false;
    drawIdle();
  }

  document.getElementById('btnRun').addEventListener('click', runSim);
  document.getElementById('btnReset').addEventListener('click', reset);

  drawIdle();
})();
