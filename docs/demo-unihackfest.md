# UniHackfest 3-minute demo

## Story

Autonomous agents need more than wallets. They need enforceable delegated authority.

The product lets AI plan and act while Solana enforces the authority boundary independently of the model.

## 0:00–0:30 — Authority thesis

Open the operator workspace and Evidence drawer.

Say:

> The AI is allowed to reason. It is not allowed to define its own permissions.

Show the trust chain:

```text
AI proposes
→ deterministic policy
→ human / Solana authority
→ provider
→ receipt
```

## 0:30–1:00 — Tiered autonomy

Switch to Travel A.

Option A:

- additional cost: +$15;
- automatic threshold: $20;
- goal arrival before 17:00.

Decision:

> **ALLOW**

This demonstrates bounded autonomy.

## 1:00–1:35 — Human escalation

Switch to Travel B.

Option B:

- +$45;
- arrives earlier;
- inside total emergency budget;
- above automatic threshold.

Decision:

> **ESCALATE**

Open exact approval and approve +$45.

Show execution receipt.

## 1:35–2:00 — Exact-consent invalidation

Switch to **Price change**.

Explain:

> The provider re-verifies the approved +$45 quote at +$48.

The previous approval is invalid.

No silent amount substitution is allowed.

## 2:00–2:35 — Solana authority

Open `/solana` or Evidence.

Explain the Anchor state:

- authority;
- delegated agent signer;
- budget / reservation;
- max/action;
- autonomous threshold;
- expiry;
- nonce;
- action commitment.

Localnet already demonstrates:

- initialization;
- low-risk authorization;
- settlement;
- high-risk exact approval;
- replay rejection;
- failed-provider reservation release.

When Devnet funding is available, run `docs/devnet-runbook.md` and show real Explorer links.

## 2:35–3:00 — Trust model

Say:

> Solana does not magically prove an airline or warehouse told the truth. It proves the delegated authority state and transitions were enforced by the program.

Close:

> Give AI autonomy without giving it unlimited authority.
