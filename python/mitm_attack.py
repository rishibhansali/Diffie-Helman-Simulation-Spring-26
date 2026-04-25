"""
mitm_attack.py — Man-in-the-Middle attack simulation.

Simulates Alice, Bob, and Eve as Python objects.
Demonstrates the full MITM DH attack and message interception.

Usage:
    python mitm_attack.py
"""

import secrets
from dh_core import generate_prime, find_primitive_root, generate_keypair, compute_shared_secret, hdr, row, SEP


class Participant:
    def __init__(self, name: str, p: int, g: int):
        self.name = name
        self.p = p
        self.g = g
        self.private, self.public = generate_keypair(p, g)
        self.shared_secret = None
        self.peer_name = None

    def receive_public_key(self, their_public: int, from_name: str):
        self.shared_secret = compute_shared_secret(their_public, self.private, self.p)
        self.peer_name = from_name

    def encrypt(self, message: str) -> str:
        """Simulated symmetric encryption using shared_secret as key."""
        key = self.shared_secret % 256
        return ''.join(chr(ord(c) ^ key) for c in message)

    def decrypt(self, ciphertext: str) -> str:
        return self.encrypt(ciphertext)   # XOR cipher is symmetric

    def __repr__(self):
        return f'<{self.name}>'


class Eve:
    """Eve positions herself between Alice and Bob."""
    def __init__(self, p: int, g: int):
        self.name = 'Eve'
        self.p = p
        self.g = g
        # Two separate key pairs — one for each side
        self.priv_to_alice, self.pub_to_alice = generate_keypair(p, g)
        self.priv_to_bob,   self.pub_to_bob   = generate_keypair(p, g)
        self.k1 = None   # shared with Alice
        self.k2 = None   # shared with Bob

    def intercept_alice_key(self, alice_public: int):
        self.alice_actual_public = alice_public
        self.k1 = compute_shared_secret(alice_public, self.priv_to_alice, self.p)

    def intercept_bob_key(self, bob_public: int):
        self.bob_actual_public = bob_public
        self.k2 = compute_shared_secret(bob_public, self.priv_to_bob, self.p)

    def _xor_crypt(self, text: str, key: int) -> str:
        k = key % 256
        return ''.join(chr(ord(c) ^ k) for c in text)

    def relay_alice_to_bob(self, ciphertext: str) -> tuple[str, str]:
        """Decrypt from Alice (K1), read, re-encrypt for Bob (K2)."""
        plaintext  = self._xor_crypt(ciphertext, self.k1)
        reencrypted = self._xor_crypt(plaintext, self.k2)
        return plaintext, reencrypted


def run_mitm_demo():
    hdr('MITM Attack Simulation')
    print('  Setting up public DH parameters…')

    p = generate_prime(64)
    g = find_primitive_root(p)
    row('Prime p:', p)
    row('Generator g:', g)

    # ── Phase 1: participants generate keys ──
    hdr('Phase 1 — Participants Generate Key Pairs')
    alice = Participant('Alice', p, g)
    bob   = Participant('Bob',   p, g)
    eve   = Eve(p, g)

    row('Alice public Y_A:', alice.public)
    row('Bob   public Y_B:', bob.public)
    print(f'\n  Eve silently generates two key pairs:')
    row('  Eve pub (→ Alice side) Y_E1:', eve.pub_to_alice)
    row('  Eve pub (→ Bob side)   Y_E2:', eve.pub_to_bob)

    # ── Phase 2: key exchange — all traffic routed through Eve ──
    hdr('Phase 2 — Key Exchange (Eve Intercepts Everything)')

    print('  Alice → Bob: sends Y_A')
    print('  Eve intercepts Y_A, records it')
    eve.intercept_alice_key(alice.public)
    print('  Eve → Bob: sends Y_E2 (instead of Y_A)')
    bob.receive_public_key(eve.pub_to_bob, from_name='Alice (actually Eve)')

    print()
    print('  Bob → Alice: sends Y_B')
    print('  Eve intercepts Y_B, records it')
    eve.intercept_bob_key(bob.public)
    print('  Eve → Alice: sends Y_E1 (instead of Y_B)')
    alice.receive_public_key(eve.pub_to_alice, from_name='Bob (actually Eve)')

    # ── Phase 3: resulting secrets ──
    hdr('Phase 3 — Resulting Shared Secrets')
    row('K_Alice (Alice↔Eve):', alice.shared_secret)
    row('K1 Eve  (Eve↔Alice):', eve.k1)
    row('K_Bob   (Bob↔Eve)  :', bob.shared_secret)
    row('K2 Eve  (Eve↔Bob)  :', eve.k2)

    match_k1 = '✓' if alice.shared_secret == eve.k1 else '✗'
    match_k2 = '✓' if bob.shared_secret   == eve.k2 else '✗'
    print(f'\n  Alice↔Eve secret match: {match_k1}')
    print(f'  Bob↔Eve   secret match: {match_k2}')
    print(f'\n  K_Alice ≠ K_Bob: {alice.shared_secret != bob.shared_secret}  ← Two separate channels!')

    # ── Phase 4: message interception ──
    hdr('Phase 4 — Message Interception & Re-Encryption')
    plaintext = 'Transfer $5000 to account 98765'
    print(f'  Alice wants to send: "{plaintext}"')

    # Alice encrypts with what she thinks is the shared key with Bob
    ciphertext = alice.encrypt(plaintext)
    print(f'  Alice sends (encrypted with K_Alice): {ciphertext.encode("unicode_escape").decode()}')

    # Eve intercepts, decrypts, reads, re-encrypts
    read_by_eve, reencrypted = eve.relay_alice_to_bob(ciphertext)
    print(f'\n  Eve intercepts and decrypts: "{read_by_eve}"')
    print(f'  Eve re-encrypts with K2:     {reencrypted.encode("unicode_escape").decode()}')

    # Bob decrypts
    bob_received = bob.decrypt(reencrypted)
    print(f'  Bob decrypts and receives:   "{bob_received}"')

    print(f'\n  ⚠  Eve read the plaintext without Alice or Bob suspecting.')
    print(f'{SEP}')


if __name__ == '__main__':
    run_mitm_demo()
