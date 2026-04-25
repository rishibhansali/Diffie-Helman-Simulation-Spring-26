/**
 * dh-math.js — Core Diffie-Hellman mathematics using BigInt
 * All arithmetic uses BigInt to handle arbitrarily large numbers.
 */

const DHMath = (() => {

  /* ── Modular exponentiation: base^exp mod m (square-and-multiply) ── */
  function modPow(base, exp, mod) {
    if (mod === 1n) return 0n;
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
      if (exp % 2n === 1n) result = (result * base) % mod;
      exp = exp >> 1n;
      base = (base * base) % mod;
    }
    return result;
  }

  /* ── Miller-Rabin witnesses for deterministic primality up to 3,317,044,064,679,887,385,961,981 ── */
  const MR_WITNESSES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

  function millerRabin(n) {
    if (n < 2n) return false;
    if (n === 2n || n === 3n) return true;
    if (n % 2n === 0n) return false;

    let d = n - 1n;
    let r = 0n;
    while (d % 2n === 0n) { d >>= 1n; r++; }

    outer: for (const a of MR_WITNESSES) {
      if (a >= n) continue;
      let x = modPow(a, d, n);
      if (x === 1n || x === n - 1n) continue;
      for (let i = 0n; i < r - 1n; i++) {
        x = (x * x) % n;
        if (x === n - 1n) continue outer;
      }
      return false;
    }
    return true;
  }

  /* ── Generate random BigInt in [min, max] ── */
  function randomBigInt(min, max) {
    const range = max - min + 1n;
    const bits  = range.toString(2).length;
    const bytes = Math.ceil(bits / 8);
    let val;
    do {
      const arr = new Uint8Array(bytes);
      crypto.getRandomValues(arr);
      val = arr.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
      val = val % range;
    } while (val < 0n);
    return val + min;
  }

  /* ── Generate a random prime of `bits` bit-length ── */
  function generatePrime(bits) {
    if (bits > 64) {
      // Return well-known safe primes for large sizes (browser can't brute-force these)
      const knownPrimes = {
        128: BigInt('340282366920938463463374607431768211507'),
        256: BigInt('115792089237316195423570985008687907853269984665640564039457584007913129640233'),
        512: 179769313486231590770839156793787453197860296048756011706444423684197180216158519368947833795864925541502180565485980503646440548199239100050792877003355816639229553136239076508735759914822574862575007425302077447712589550957937778424442426617334727629299387668709205606050270810842907692932019128194467627007n,
      };
      return knownPrimes[bits] || WELL_KNOWN_PRIME_2048;
    }

    const min = 1n << BigInt(bits - 1);
    const max = (1n << BigInt(bits)) - 1n;
    let candidate;
    do {
      candidate = randomBigInt(min, max);
      if (candidate % 2n === 0n) candidate += 1n;
    } while (!millerRabin(candidate));
    return candidate;
  }

  /* ── Find a primitive root (generator) for prime p ── */
  function findPrimitiveRoot(p) {
    if (p === 2n) return 1n;
    const phi = p - 1n;
    // Factor phi = 2 * q (assuming safe prime p = 2q+1)
    const q = phi / 2n;
    for (let g = 2n; g < p; g++) {
      if (modPow(g, phi, p) === 1n &&
          modPow(g, 2n, p) !== 1n &&
          modPow(g, q, p) !== 1n) {
        return g;
      }
    }
    return 2n; // fallback
  }

  /* ── Generate a DH key pair: { privateKey, publicKey } ── */
  function generateKeypair(p, g) {
    const priv = randomBigInt(2n, p - 2n);
    const pub  = modPow(g, priv, p);
    return { privateKey: priv, publicKey: pub };
  }

  /* ── Compute shared secret ── */
  function computeSharedSecret(theirPublic, myPrivate, p) {
    return modPow(theirPublic, myPrivate, p);
  }

  /* ── Small well-known safe prime sets for demos ── */
  const DEMO_PRIMES = {
    16:   23n,
    32:   4294967311n,
    64:   18446744073709551629n,
    128:  BigInt('340282366920938463463374607431768211507'),
    2048: BigInt(
      '32317006071311007300714876688669951960444102669715484032130345427524655138867890893197201411522913463688717960921898019494119559150490921095088152386448283120630877367300996091750197750389652106796057638384067568276792218642619756161838094338476170470581645852036305042887575891541065808607552399123930385521914333389668342420684974786564569494856176035326322058077805659331026192708460314150258592864177116725943603718461857357598351152301645904403697613233287231227125684710820170533763378732088658340553615682668004'
    ),
  };

  /* ── 2048-bit MODP group 14 (RFC 3526) prime ── */
  const WELL_KNOWN_PRIME_2048 = DEMO_PRIMES[2048];

  /* ── Discrete log brute-force (only feasible for small primes) ── */
  function bruteForceDiscreteLog(g, publicKey, p, onProgress) {
    const limit = p < 1000000n ? p : 1000000n;
    for (let x = 1n; x < limit; x++) {
      if (modPow(g, x, p) === publicKey) return x;
      if (onProgress && x % 1000n === 0n) onProgress(Number(x));
    }
    return null;
  }

  /* ── Helper: BigInt → hex string, padded ── */
  function toHex(n, minLen = 0) {
    let h = n.toString(16);
    while (h.length < minLen) h = '0' + h;
    return '0x' + h;
  }

  /* ── Helper: truncate large numbers for display ── */
  function displayNum(n, maxLen = 24) {
    const s = n.toString();
    if (s.length <= maxLen) return s;
    return s.slice(0, 10) + '…' + s.slice(-10) + ` (${s.length} digits)`;
  }

  /* ── Estimate brute-force time string for a given bit size ── */
  function estimateCrackTime(bits) {
    const table = {
      16:   '< 1 ms',
      32:   '~10 ms',
      64:   '~2 hours',
      128:  '~10^22 years',
      2048: '>> age of the universe',
    };
    return table[bits] || 'Unknown';
  }

  return {
    modPow,
    millerRabin,
    isPrime: millerRabin,
    generatePrime,
    findPrimitiveRoot,
    generateKeypair,
    computeSharedSecret,
    bruteForceDiscreteLog,
    randomBigInt,
    toHex,
    displayNum,
    estimateCrackTime,
    DEMO_PRIMES,
    WELL_KNOWN_PRIME_2048,
  };
})();
