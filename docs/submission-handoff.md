# Submission handoff

Status: **local MVP ready; Devnet authority evidence confirmed; public submission URLs still incomplete**

## Project

**Name:** Agentic AI Gateway  
**Thesis:** Give AI autonomy without giving it unlimited authority.

## Repository

Current local branch: `main`

Remote repository URL: **not configured yet**.

A GitHub remote must be added and verified before this field is submitted to a competition form.

## Demo

Primary local demo:

```text
http://localhost:3000
```

Public demo URL: **not verified yet**.

Do not submit a public URL until the production build has been deployed and smoke-tested.

## 60-second judge path

1. Open the product landing page, then choose **Explore demos**.
2. Open `/demos/logistics`. Logistics starts at **ESCALATE** because the $8,000 transfer exceeds the $5,000 autonomous threshold.
3. Open **Review exact action**. Show exact action binding and current human-authority evidence.
4. Confirm exactly $8,000 → scenario API returns **ALLOW → EXECUTED** with the fixture WMS receipt.
5. Open `/demos/travel`:
   - Option A +$15 → **ALLOW**;
   - Option B +$45 → **ESCALATE** → exact review → **EXECUTED**.
6. Open **Safety cases** → hard policy **BLOCK**, downstream provider **FAILED**, and +$45 → +$48 approval invalidation.
7. Optional live identity proof: connect **Phantom** and **Verify signer**. The message explicitly says `Transaction: none.` and `Funds: none.`.
8. Open **Evidence & receipts** → Phantom human-authority evidence, fixture receipts, Anchor localnet evidence, and the confirmed Devnet `initialize_policy` TX/PDA with Explorer links.

## Architecture summary

```text
Observation
  ↓
AI planning
  ↓
structured ProposedAction
  ↓
schema/context validation
  ↓
deterministic Control Plane
  ├─ ALLOW ───────────────┐
  ├─ BLOCK                │
  └─ ESCALATE → approval ─┤
                          ↓
                   execution adapter
                          ↓
                       receipt
```

AI is intentionally non-authoritative.

## Solana

Anchor program:

```text
agent_policy
```

Program ID:

```text
5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH
```

Verified local evidence:

- Anchor SBF build PASS.
- 7 Rust authority unit tests PASS.
- 1 localnet lifecycle integration test PASS.
- low-risk autonomous authorization exercised.
- exact high-risk approval exercised.
- replay nonce rejection exercised.
- successful settlement moves reserved budget to spent.
- failed settlement releases reserved budget without increasing spent.

Devnet evidence: **confirmed**.

Verified public-chain evidence:

- program `5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH` is deployed and executable on Devnet;
- Phantom authority wallet: `FHAqJnHhY3KuSQ9HskoQUmY187BhPiGGtVEqKQSoULsF`;
- Finalized `initialize_policy` transaction: `4YDM1jeqhoP5WnYxkXTLHBYhMfRzYeqytont7gwo5cvwjUPMK5NkrPwcao9Au35mQ2YHb83Tq1NsNxgwdW1QiYGr`;
- slot: `504826447`;
- AgentPolicy PDA: `FBxjL53RRFeH3sqn9k9eGDneX1rmZVUWcDNzEkwKcrtV`;
- decoded policy: budget `10000`, max/action `5000`, auto authority `2000`, active `true`, nonce `0`;
- Evidence UI clean reload recovers the real signature/slot/PDA and Explorer links without requesting another signature.

## Provider disclosure

### Default stage path

- AI provider: deterministic fixture fallback is available.
- Logistics provider: fixture WMS.
- Travel provider: fixture travel provider.
- Solana: localnet evidence available.

The primary stage demo therefore does not require external credentials.

### Optional live paths

- DeepSeek structured planning.
- Atlas travel sandbox adapter.
- Solana Devnet.

These are optional and must be disclosed as live only when credentials/network evidence is actually present.

## Current engineering evidence

Root application:

- 74 Bun tests PASS.
- 184 assertions PASS.
- TypeScript typecheck PASS.
- ESLint PASS.
- Next.js production build PASS.

Browser regression:

- desktop 1440px PASS;
- laptop 1180px PASS;
- tablet 768px PASS;
- mobile 390px PASS;
- no horizontal document overflow in tested flows;
- no browser console/runtime errors;
- Logistics escalation/approval/receipt PASS;
- forced Logistics API 500 remains ESCALATE and shows fail-closed error PASS;
- Safety cases: policy BLOCK / provider FAILED / quote invalidation PASS;
- Travel Option A auto-ALLOW PASS;
- Travel Option B escalation/approval PASS;
- Phantom provider detection / wallet public key / sign-message verification PASS;
- verified signer shows 64 signature bytes;
- signer message contains `Transaction: none.` and `Funds: none.`;
- no transaction, transfer or token approval requested;
- evidence drawer includes live Phantom human-authority identity PASS;
- secondary routes return HTTP 200 with no overflow;
- Solana localnet replay evidence visible.

## Remaining external blockers

### Remoat visual review

Remoat remains connected to the `Agentic-AI-Gateway` Antigravity target and was used for browser/Phantom interaction. The session opened the Phantom surface and reached the connected + verified signer state without any Antigravity code mutation.

The Antigravity agent panel later entered a stale `Failed to fetch` state and its internal queue did not return a fresh final prose summary. This is a reviewer-tool reporting issue, not an application runtime failure. The same browser state and all critical flows were independently re-checked through the running Chrome session and automated browser regression.

### Devnet evidence

Deployment, browser `initialize_policy`, and a full CLI lifecycle smoke are complete. The lifecycle smoke produced six Finalized transactions and asserted replay rejection plus final budget state. Keep `docs/devnet-runbook.md` for reproducibility.

## Competition scripts

VJAI:

```text
docs/demo-vjai.md
```

UniHackfest:

```text
docs/demo-unihackfest.md
```

## Known limitations

- Browser UI exposes confirmed `initialize_policy` evidence. Additional CLI Devnet smoke now covers low-risk authorization + settlement, exact high-risk approval + approved authorization, failed settlement, and replay rejection; those extra lifecycle transactions are verified on-chain but are not yet surfaced as separate UI cards.
- Atlas live sandbox is not required for the fixture demo and has no credentials configured in this release candidate.
- DeepSeek live planning requires a local API key; validated fixture planning remains deterministic fallback.
- On-chain commitments prove integrity of committed authority state, not truth of external real-world facts.

## Before submitting any form

Fill only verified values:

- repository URL;
- public demo URL;
- demo video URL;
- confirmed Devnet Explorer links.

Never replace missing evidence with placeholders that look real.
