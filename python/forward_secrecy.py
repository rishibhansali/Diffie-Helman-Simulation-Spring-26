"""
forward_secrecy.py — Static vs ephemeral DH key comparison.

Demonstrates that static keys allow retroactive decryption after key compromise,
while ephemeral keys guarantee forward secrecy.

Usage:
    python forward_secrecy.py
"""

import secrets
from dh_core import generate_prime, find_primitive_root, generate_keypair, compute_shared_secret, hdr, row, SEP


def xor_crypt(text: str, key: int) -> str:
    k = key % 256
    return ''.join(chr(ord(c) ^ k) for c in text)


def run_demo():
    p = generate_prime(64)
    g = find_primitive_root(p)

    # ── SCENARIO 1: Static Keys (No PFS) ──
    hdr('Scenario 1 — Static Keys (No Forward Secrecy)')
    print('  Alice and Bob reuse one long-term key pair.\n')

    alice_static_priv, alice_static_pub = generate_keypair(p, g)
    sessions_static = []

    for i in range(3):
        bob_priv, bob_pub = generate_keypair(p, g)
        K = compute_shared_secret(bob_pub, alice_static_priv, p)
        msg = f'Secret message {i+1}'
        ct  = xor_crypt(msg, K)
        sessions_static.append({
            'session': i + 1,
            'alice_pub': alice_static_pub,
            'bob_pub':   bob_pub,
            'K':         K,
            'ciphertext': ct,
            'plaintext':  msg,
        })
        row(f'Session {i+1} key K:', K)
        print(f'  Ciphertext recorded by attacker: {ct.encode("unicode_escape").decode()}')

    print('\n  --- KEY LEAK EVENT ---')
    print(f'  Alice long-term private key leaked: {alice_static_priv}')

    print('\n  Attacker recomputes all session keys:')
    for s in sessions_static:
        recovered_K = compute_shared_secret(s['bob_pub'], alice_static_priv, p)
        recovered_pt = xor_crypt(s['ciphertext'], recovered_K)
        print(f'  Session {s["session"]}: K = {recovered_K}, decrypted = "{recovered_pt}"')
    print('\n  RESULT: All past sessions COMPROMISED. ✗')

    # ── SCENARIO 2: Ephemeral Keys (PFS) ──
    hdr('Scenario 2 — Ephemeral Keys (Perfect Forward Secrecy)')
    print('  Alice uses a fresh key pair per session and discards it immediately.\n')

    sessions_ephemeral = []
    alice_long_priv, alice_long_pub = generate_keypair(p, g)  # long-term (for auth only)

    for i in range(3):
        alice_eph_priv, alice_eph_pub = generate_keypair(p, g)  # ephemeral
        bob_priv, bob_pub = generate_keypair(p, g)
        K = compute_shared_secret(bob_pub, alice_eph_priv, p)
        msg = f'Secret message {i+1}'
        ct  = xor_crypt(msg, K)
        sessions_ephemeral.append({
            'session': i + 1,
            'alice_eph_pub': alice_eph_pub,
            'bob_pub':       bob_pub,
            'K':             K,
            'ciphertext':    ct,
        })
        row(f'Session {i+1} key K (ephemeral):', K)
        print(f'  Ciphertext recorded by attacker: {ct.encode("unicode_escape").decode()}')
        print(f'  [ephemeral private key discarded after session {i+1}]')

    print('\n  --- KEY LEAK EVENT ---')
    print(f'  Alice long-term private key leaked: {alice_long_priv}')

    print('\n  Attacker tries to recompute session keys with leaked long-term key:')
    for s in sessions_ephemeral:
        # Long-term key can't help — ephemeral keys were different
        attempted_K = compute_shared_secret(s['bob_pub'], alice_long_priv, p)
        fail = attempted_K != s['K']
        print(f'  Session {s["session"]}: attempted K = {attempted_K}  → match = {not fail}  → decryption {"FAILED" if fail else "succeeded (bug!)"}')

    print('\n  RESULT: Past sessions remain SECURE. ✓ (Ephemeral keys are gone — cannot be reconstructed.)')
    print(f'{SEP}')

    # ── Comparison summary ──
    hdr('Summary Comparison')
    print(f'  {"Property":<35}  {"Static Keys":^18}  {"Ephemeral Keys (PFS)":^20}')
    print(f'  {"-"*35}  {"-"*18}  {"-"*20}')
    rows = [
        ('New session requires new keypair',   'No',  'Yes'),
        ('Private key discarded after session', 'No',  'Yes'),
        ('Past sessions safe if key leaked',    'No',  'Yes'),
        ('Future sessions safe if key leaked',  'No',  'Yes (new ephemeral)'),
        ('Computation overhead',                'Low', 'Slightly higher'),
        ('Used in TLS 1.3',                    'No',  'Yes (mandatory)'),
    ]
    for prop, static, ephem in rows:
        s_col = '✗  ' + static  if static  == 'No'  else '✓  ' + static
        e_col = '✓  ' + ephem   if 'Yes' in ephem   else '✗  ' + ephem
        print(f'  {prop:<35}  {s_col:<18}  {e_col}')
    print(f'{SEP}')


if __name__ == '__main__':
    run_demo()
