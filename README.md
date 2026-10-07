# Agentic AI Gateway

> Give AI autonomy without giving it unlimited authority.

Agentic AI Gateway is an **AI Agent Control Plane**. An agent may observe, reason, plan and propose consequential actions, but deterministic authority decides whether the action is allowed to execute.

```text
Observation
   ↓
AI planning
   ↓
Proposed action
   ↓
Schema validation
   ↓
Deterministic Control Plane
   ├── ALLOW ───────→ execution adapter
   ├── BLOCK ───────→ no execution
   └── ESCALATE ────→ exact human / on-chain approval
                              ↓
                         execution
                              ↓
                           receipt
```

## Judge path — under one minute

1. Open `http://localhost:3000`. The root is the product landing page. Choose **Explore demos**.
2. Open `/demos/logistics`:
   - inbound shipment is delayed;
   - the agent proposes transferring 250 units Binh Duong → HCM;
   - operational checks pass;
   - the $8,000 action exceeds the $5,000 autonomous threshold;
   - result: **ESCALATE**.
3. Click **Review exact action**. The review surface shows the exact action binding plus current human-authority evidence.
4. Confirm exactly $8,000. The UI changes to **ALLOW / EXECUTED** only after the scenario API returns an executed receipt.
5. Open `/demos/travel`:
   - **Option A**: +$15 is inside the $20 autonomous threshold → **ALLOW**;
   - **Option B**: +$45 → **ESCALATE** → exact review → **EXECUTED**.
6. Open **Safety cases**:
   - hard policy block;
   - downstream provider failure;
   - approved +$45 quote re-verifies at +$48 and invalidates the old consent.
7. Optional live signer proof: connect **Phantom** and choose **Verify signer**. The signed message explicitly says `Transaction: none.` and `Funds: none.`; no transaction or transfer is requested.
8. Open **Evidence & receipts**:
   - live Phantom human-authority identity state;
   - fixture execution evidence;
   - Anchor localnet authority evidence;
   - Devnet remains labelled pending until real confirmed deployment evidence exists.

## What is already implemented

### Deterministic Control Plane

- `ALLOW / BLOCK / ESCALATE`
- delegated agent identity and role checks
- action allowlists
- policy active/expiry checks
- per-action and total budget limits
- risk thresholds
- exact approval binding
- quote-change approval invalidation
- replay/nonce interface
- fail-closed execution guard
- execution trace + receipt

### Logistics — primary VJAI scenario

```text
Inbound delay
→ HCM stockout risk
→ AI / fixture proposes transfer
→ quantity / capacity / cold-chain checks
→ deterministic authority
→ exact manager approval when required
→ FixtureWarehouseProvider
→ before/after metrics + receipt
```

### AI planning

- provider-agnostic `PlanningProvider`
- `FixturePlanningProvider`
- `DeepSeekProvider`
- JSON-only structured output
- Zod validation
- timeout + bounded retries
- hallucinated actions/resources/provider options rejected
- deterministic fallback path
- LLM output never calls an execution provider directly

### Travel — cross-domain proof

- `FixtureTravelProvider`
- optional `AtlasTravelProvider`
- low-cost autonomous option
- higher-cost escalation
- provider verification before final execution
- exact consent invalidation when verified price changes
- Atlas sandbox booking is disabled unless explicitly enabled

### Solana / Anchor authority layer

Program: `agent_policy`

Implemented authority lifecycle:

- `initialize_policy`
- `update_policy`
- `delegate_agent`
- `revoke_policy`
- `approve_high_risk_action`
- `authorize_action`
- `authorize_approved_action`
- `settle_action`
- `close_policy`

On-chain invariants include signer authority, expiry, hard action ceiling, budget reservation, monotonic nonce, replay protection, exact approval binding and settlement state.

Local Anchor lifecycle tests pass. The real browser transaction bridge for `initialize_policy` is implemented and fail-closed. The connected Phantom wallet has 20 Devnet SOL, but the configured `agent_policy` program is not yet deployed on Devnet, so the UI intentionally stops before requesting a transaction signature and does **not** fabricate Explorer evidence.

## Why AI?

AI handles the probabilistic part:

- interpret incidents;
- build context;
- propose recovery actions;
- compare alternatives;
- explain a recommendation;
- re-plan.

## Why deterministic policy?

Authority is not probabilistic.

The LLM does **not** own:

- permissions;
- arithmetic;
- expiry;
- replay protection;
- approval validity;
- hard risk thresholds;
- provider execution permission;
- Solana state transitions.

## Why Solana?

The Web2 version can enforce permissions. Solana changes the trust model:

- delegated authority can be inspected independently;
- nonce/budget/expiry can be enforced by the program rather than only by one backend;
- authority transitions become shared verifiable state;
- programmable on-chain value can later be bound to the same policy state.

Solana is **not** used merely as a logging database.

## Trust assumptions

```text
provider/backend → commitment → Solana
```

This can prove that a commitment was recorded and later unchanged.

It does **not** prove that the real-world provider or physical event was truthful.

**Integrity ≠ truth.**

Future stronger attestation could use provider signatures, signed webhooks, independent attestors or other oracle mechanisms.

## Run locally

Requirements:

- Bun
- Node.js
- Rust / Cargo
- Solana CLI
- Anchor CLI for the Solana phase

Install and run:

```bash
bun install
bun test
bun run typecheck
bun run lint
bun run build
bun run dev -- --port 3000
```

Open:

```text
http://localhost:3000
```

### Anchor localnet

On this macOS environment, Rust/Anchor uses the installed 26.5 SDK because the default 27.0 SDK is incompatible with the current linker:

```bash
cd solana

SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk \
  ~/.avm/bin/anchor-1.1.2 build

SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk \
  ~/.avm/bin/anchor-1.1.2 test --skip-build --validator legacy
```

## Environment

Copy `.env.example` to `.env.local` only when external providers are required.

Never commit secrets.

```text
AI_PROVIDER=fixture
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=

TRAVEL_PROVIDER=fixture
ATLAS_ALLOW_SANDBOX_BOOKING=false

SOLANA_RPC_URL=
SOLANA_CLUSTER=devnet
```

Fixture mode is intentionally the default so the stage demo does not depend on external APIs.

## Routes

- `/` — product landing page
- `/demos` — product demo hub
- `/demos/logistics` — Logistics authority demo
- `/demos/travel` — traveller recovery authority demo
- `/architecture` — AI → Policy → Approval → Provider → Receipt
- `/evidence` — application, Anchor, Phantom and Devnet evidence + real transaction review
- `/scenarios/*` — legacy compatibility demo routes
- `/policies` — deterministic policy comparison
- `/executions` — execution pipeline
- `/solana` — Anchor authority layer + evidence status

## Test status

Current verified root suite:

- **58 tests**
- **155 assertions**
- TypeScript: PASS
- ESLint: PASS
- Next.js production build: PASS

Current Solana verification:

- 7 Rust authority unit tests
- 1 localnet lifecycle integration test
- Anchor build: PASS
- localnet lifecycle: PASS
- Devnet: browser prepare/submit/readback path implemented; connected Phantom wallet has 20 SOL; deployment is blocked because the configured AgentPolicy program is not yet deployed

## Reference-project usage

The project studied the previously supplied Top-3 references as architecture/design references.

Patterns used:

- deterministic recovery and fail-closed execution;
- provider abstraction;
- dependency/blast-radius presentation;
- exact consent and price-change invalidation;
- compact operator workspace + sticky work rail;
- evidence / receipt drawer.

Reference source code is not copied when licensing does not permit reuse.

## Competition paths

### Vietnam Japan AI Hackathon 2026

Primary story: autonomous Logistics recovery with deterministic enterprise authority and measurable operational outcomes.

See `docs/demo-vjai.md`.

### UniHackfest 2026

Primary story: enforceable delegated authority for autonomous agents using Solana/Anchor, with Travel as an intuitive cross-domain provider demo.

See `docs/demo-unihackfest.md`.

## Documentation

- `docs/architecture.md`
- `docs/demo-vjai.md`
- `docs/demo-unihackfest.md`
- `docs/devnet-runbook.md`
- `docs/submission-checklist.md`
- `docs/submission-handoff.md`
- `.agents/spec/00-index.md`
