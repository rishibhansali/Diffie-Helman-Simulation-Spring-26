# Diffie-Hellman Under Attack: A Security Simulation

An interactive, browser-based simulation of the Diffie-Hellman key exchange protocol — demonstrating the baseline exchange, three distinct attack vectors, and two cryptographic defenses.

Built for the **Network Security** course, Spring 2026.

## Live Demo

**GitHub Pages:** https://rishibhansali.github.io/Diffie-Helman-Simulation-Spring-26/

## Team

| Name | Role |
|------|------|
| Rishi Bhansali | Simulation Lead |
| Aarav Mody | Cryptography |
| Aryan Bhat | Attack Models |
| Lekha Londhe | Frontend & Visualization |

## What This Project Demonstrates

| Module | Description |
|--------|-------------|
| **DH Exchange** | The canonical Diffie-Hellman handshake. Alice and Bob exchange public keys; real BigInt modular arithmetic computes shared secrets live in the browser. |
| **MITM Attack** | Eve intercepts unauthenticated public keys, substitutes her own, and establishes two separate shared secrets. She can read and re-encrypt every message. |
| **Weak Prime Attack** | A brute-force discrete logarithm attack against small primes (16–64 bit). Runs live in the browser; compares against the infeasibility of 2048-bit primes. |
| **Forward Secrecy** | Contrasts static long-term keys (past sessions exposed after key leak) against ephemeral keys (past sessions remain secure regardless of future compromise). |
| **Authenticated DH** | Adds digital signatures to DH public keys. Eve's substituted key fails verification; the MITM attack is blocked at the protocol level. |

## Project Structure

```
Diffie-Helman-Simulation-Spring-26/
├── index.html                  ← Home / landing page
├── pages/
│   ├── dh-exchange.html        ← Normal DH key exchange
│   ├── mitm-attack.html        ← Man-in-the-Middle attack
│   ├── weak-prime.html         ← Weak prime brute force attack
│   ├── forward-secrecy.html    ← Compromised endpoint + forward secrecy
│   └── authenticated-dh.html  ← Authenticated DH defense
├── css/
│   └── style.css               ← Global dark theme stylesheet
├── js/
│   ├── dh-math.js              ← Core DH math (BigInt modular arithmetic)
│   ├── dh-exchange.js
│   ├── mitm.js
│   ├── weak-prime.js
│   ├── forward-secrecy.js
│   └── authenticated-dh.js
├── python/
│   ├── dh_core.py              ← Core DH implementation
│   ├── mitm_attack.py          ← MITM simulation
│   ├── weak_prime_attack.py    ← Brute force with timing measurements
│   ├── forward_secrecy.py      ← Static vs ephemeral key comparison
│   ├── authenticated_dh.py     ← Authenticated DH comparison
│   └── generate_graphs.py      ← Matplotlib graphs for the report
└── graphs/                     ← Output folder for generated graphs
```

## Running the Python Scripts

### Requirements

```
Python 3.10+
pip install matplotlib
```

All other modules (`dh_core`, `sympy` not required) use the standard library only.

### Usage

```bash
# Run from the python/ directory
cd python/

# Core DH demo (optional: specify bit size)
python dh_core.py 64
python dh_core.py 128

# MITM attack simulation
python mitm_attack.py

# Weak prime brute-force timing
python weak_prime_attack.py

# Forward secrecy comparison
python forward_secrecy.py

# Authenticated DH comparison
python authenticated_dh.py

# Generate report graphs (outputs to /graphs/)
python generate_graphs.py
```

### Generated Graphs

Running `generate_graphs.py` produces three files in `/graphs/`:

- `prime_size_vs_crack_time.png` — Bar chart of prime bit sizes vs. estimated brute-force time
- `dh_computation_time.png` — Line graph of prime bit size vs. legitimate DH computation time
- `attack_comparison.png` — Horizontal bar chart comparing threat severity across all scenarios

## Technical Notes

- All JavaScript cryptographic math uses **BigInt** for arbitrary-precision arithmetic — no floating-point approximations.
- The website is **fully static** — no backend, no build step. GitHub Pages serves it directly from the repository root.
- Brute-force is only performed live for primes ≤ 64-bit. For larger sizes, theoretical infeasibility is displayed mathematically.
- The simulated signatures in the JavaScript and Python are pedagogical approximations. Real deployments use ECDSA (TLS 1.3) or EdDSA (Signal).

## Academic Context

This project was developed as a term project for a university Network Security course. The goal is to make abstract cryptographic concepts — modular arithmetic, the Discrete Logarithm Problem, forward secrecy, and authenticated key exchange — tangible and interactive.

All attack simulations are run in an isolated browser or local Python environment and are strictly educational.

---

*Network Security · Spring 2026 · Bhansali · Mody · Bhat · Londhe*
