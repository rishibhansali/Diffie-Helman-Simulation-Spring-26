"""
dh_core.py — Core Diffie-Hellman implementation using Python big integers.

Usage:
    python dh_core.py [bits]
    default bits = 64
"""

import sys
import time
import random
import secrets


# ── Primality ──────────────────────────────────────────────────────────────

def is_prime_miller_rabin(n: int, rounds: int = 20) -> bool:
    if n < 2: return False
    small_primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47]
    for p in small_primes:
        if n == p: return True
        if n % p == 0: return False
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    for _ in range(rounds):
        a = secrets.randbelow(n - 3) + 2
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def generate_prime(bits: int) -> int:
    """Generate a random prime of `bits` bit-length."""
    while True:
        candidate = secrets.randbits(bits) | (1 << (bits - 1)) | 1
        if is_prime_miller_rabin(candidate):
            return candidate


# ── Primitive root ─────────────────────────────────────────────────────────

def find_primitive_root(p: int) -> int:
    """Find the smallest primitive root (generator) for prime p."""
    phi = p - 1
    # For simplicity, factor phi as 2 * (p-1)/2 (assumes safe prime structure)
    factors = {2}
    temp = phi // 2
    d = 2
    while d * d <= temp:
        if temp % d == 0:
            factors.add(d)
            while temp % d == 0:
                temp //= d
        d += 1
    if temp > 1:
        factors.add(temp)

    for g in range(2, p):
        if all(pow(g, phi // f, p) != 1 for f in factors):
            return g
    return 2


# ── Key operations ─────────────────────────────────────────────────────────

def generate_keypair(p: int, g: int) -> tuple[int, int]:
    """Return (private_key, public_key)."""
    private = secrets.randbelow(p - 3) + 2
    public  = pow(g, private, p)
    return private, public


def compute_shared_secret(their_public: int, my_private: int, p: int) -> int:
    return pow(their_public, my_private, p)


# ── Formatting helpers ─────────────────────────────────────────────────────

SEP = '─' * 60

def hdr(title: str):
    print(f'\n{SEP}\n  {title}\n{SEP}')

def row(label: str, value, trunc: int = 40):
    s = str(value)
    if len(s) > trunc:
        s = s[:18] + '…' + s[-10:] + f'  [{len(s)} digits]'
    print(f'  {label:<35} {s}')


# ── Demo ───────────────────────────────────────────────────────────────────

def run_demo(bits: int = 64):
    hdr(f'Diffie-Hellman Key Exchange Demo ({bits}-bit prime)')

    t0 = time.perf_counter()
    print(f'  Generating {bits}-bit prime…', end=' ', flush=True)
    p = generate_prime(bits)
    print(f'done ({(time.perf_counter()-t0)*1000:.1f} ms)')

    g = find_primitive_root(p)
    row('Prime p:', p)
    row('Generator g:', g)

    hdr('Alice generates her key pair')
    t0 = time.perf_counter()
    xA, yA = generate_keypair(p, g)
    row('Alice private X_A:', xA)
    row('Alice public  Y_A = g^X_A mod p:', yA)
    print(f'  (computed in {(time.perf_counter()-t0)*1000:.3f} ms)')

    hdr('Bob generates his key pair')
    t0 = time.perf_counter()
    xB, yB = generate_keypair(p, g)
    row('Bob private X_B:', xB)
    row('Bob public  Y_B = g^X_B mod p:', yB)
    print(f'  (computed in {(time.perf_counter()-t0)*1000:.3f} ms)')

    hdr('Both compute shared secret')
    KA = compute_shared_secret(yB, xA, p)
    KB = compute_shared_secret(yA, xB, p)
    row('Alice: K = Y_B^X_A mod p:', KA)
    row('Bob:   K = Y_A^X_B mod p:', KB)
    match = '✓  MATCH' if KA == KB else '✗  MISMATCH (bug!)'
    print(f'\n  Shared secret match: {match}')
    print(f'\n{SEP}')


if __name__ == '__main__':
    bits = int(sys.argv[1]) if len(sys.argv) > 1 else 64
    run_demo(bits)
