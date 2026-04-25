"""
weak_prime_attack.py — Brute-force discrete log attack on small DH primes.

Runs DH with progressively larger primes and attempts brute-force DLP.
Prints a timing comparison table.

Usage:
    python weak_prime_attack.py
"""

import time
import secrets
from dh_core import generate_prime, find_primitive_root, generate_keypair, hdr, row, SEP


SMALL_PRIMES = {
    16:  23,
    32:  4294967311,
    64:  18446744073709551629,
}

LARGE_PRIME_DISPLAY = {
    128: '340282366920938463463374607431768211507',
    2048: '(RFC 3526 MODP group 14 — 617-digit number)',
}


def brute_force_dlp(g: int, public_key: int, p: int, limit: int = 10_000_000) -> tuple[int | None, int, float]:
    """Try to find x such that g^x ≡ public_key (mod p)."""
    start = time.perf_counter()
    for x in range(1, min(p, limit)):
        if pow(g, x, p) == public_key:
            elapsed = time.perf_counter() - start
            return x, x, elapsed
    elapsed = time.perf_counter() - start
    return None, min(p, limit), elapsed


def run_demo():
    hdr('Weak Prime Brute-Force Attack')
    print('  Showing how prime bit-size determines DH security.\n')

    results = []

    # ── Small primes: actually run brute force ──
    for bits, p in SMALL_PRIMES.items():
        g = 5
        xA = secrets.randbelow(p - 3) + 2
        yA = pow(g, xA, p)

        print(f'  [{bits}-bit]  p = {p}')
        print(f'             g = {g}, Y_A = {yA}')

        t0 = time.perf_counter()
        found, attempts, crack_time = brute_force_dlp(g, yA, p)
        dh_time = time.perf_counter() - t0

        if found is not None:
            verify_ok = pow(g, found, p) == yA
            print(f'             ✓ Private key cracked: X_A = {found}')
            print(f'               Attempts: {attempts}, Time: {crack_time*1000:.2f} ms, Verified: {verify_ok}')
            status = 'BROKEN'
        else:
            print(f'               Not cracked in {attempts:,} attempts ({crack_time*1000:.1f} ms)')
            status = 'PARTIAL'

        results.append({
            'bits': bits, 'prime': str(p), 'dh_ms': dh_time * 1000,
            'crack_ms': crack_time * 1000, 'attempts': attempts, 'status': status,
        })
        print()

    # ── Large primes: theoretical only ──
    theoretical = [
        (128,  '~10^22 years',       'INFEASIBLE'),
        (2048, '>> age of universe', 'SECURE'),
    ]
    for bits, crack_est, status in theoretical:
        results.append({
            'bits': bits, 'prime': LARGE_PRIME_DISPLAY.get(bits, '—'),
            'dh_ms': 0.0, 'crack_ms': None, 'attempts': None, 'status': status,
        })

    # ── Summary table ──
    hdr('Results Summary')
    print(f'  {"Bits":>6}  {"DH time":>10}  {"Crack time":>22}  {"Status":>12}')
    print(f'  {"-"*6}  {"-"*10}  {"-"*22}  {"-"*12}')
    for r in results:
        dh   = f'{r["dh_ms"]:.2f} ms' if r['dh_ms'] else '~50 ms'
        crack = (f'{r["crack_ms"]:.2f} ms' if r["crack_ms"] is not None
                 else ('~10^22 years' if r['bits'] == 128 else '>> age of universe'))
        print(f'  {r["bits"]:>6}  {dh:>10}  {crack:>22}  {r["status"]:>12}')

    print(f'\n  Key insight: every additional bit doubles the brute-force search space.')
    print(f'  2048-bit: 2^2048 ≈ 10^617 possible private keys.')
    print(f'{SEP}')


if __name__ == '__main__':
    run_demo()
