# Architecture

## Product boundary

Agentic AI Gateway separates **agent intelligence** from **agent authority**.

```text
BUSINESS GOAL / INCIDENT
        │
        ▼
   AI PLANNING
        │
        │ ProposedAction
        ▼
┌───────────────────────────────┐
│       AGENT CONTROL PLANE     │
│                               │
│ Identity                      │
│ Schema validation             │
│ Context / resource validation │
│ Deterministic policy          │
│ Risk                          │
│ Budget / limits               │
│ Approval validity             │
│ Replay protection             │
└───────────────┬───────────────┘
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
     ALLOW    BLOCK   ESCALATE
       │                 │
       │            exact approval
       └────────┬────────┘
                ▼
         EXECUTION ADAPTER
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
     WMS      Travel    Solana
    fixture   provider   authority
        │       │        │
        └───────┼────────┘
                ▼
              RESULT
                │
                ▼
             RECEIPT
```

## TypeScript boundary

```text
src/control-plane/
  approval/
  execution/
  policy/
  types/

src/providers/ai/
  fixture.ts
  deepseek.ts
  schema.ts

src/scenarios/logistics/
  fixtures.ts
  graph.ts
  policy.ts
  provider.ts
  scenario.ts

src/scenarios/travel/
  fixtures.ts
  policy.ts
  scenario.ts
  providers/
    fixture.ts
    atlas.ts
```

The policy engine does not import an LLM provider.

Execution adapters do not decide authority.

## Logistics flow

```text
INBOUND_DELAY
     ↓
dependency impact
     ↓
proposal: inventory.transfer
     ↓
logistics constraints
  - source inventory
  - receiving capacity
  - max quantity
  - cold-chain
  - deterministic amount
     ↓
generic authority policy
     ↓
ALLOW / BLOCK / ESCALATE
     ↓
FixtureWarehouseProvider
```

## Travel flow

```text
FLIGHT_DELAY
    ↓
search options
    ↓
provider verify
    ↓
canonical flight.replace action
    ↓
generic authority policy
    ↓
ALLOW / ESCALATE
    ↓
exact approval if required
    ↓
provider verify again before booking
    ↓
old approval invalid if price changed
    ↓
TravelProvider
```

## Solana state model

### AgentPolicy

Authority state includes:

- authority wallet;
- delegated agent signer;
- settlement authority;
- total / spent / reserved budget;
- hard per-action ceiling;
- autonomous threshold;
- expiry;
- goal commitment;
- allowed-actions commitment;
- monotonic nonce;
- active/revoked state.

### ActionApproval

Binds authority consent to:

- policy;
- exact action hash;
- exact amount;
- exact nonce;
- approval expiry.

### ActionAuthorization

Persists:

- policy;
- delegated agent;
- exact action hash;
- amount;
- nonce;
- authorization time;
- settlement state;
- provider-reference commitment.

## Reservation semantics

Authorization reserves budget before the off-chain provider action.

```text
available = total - spent - reserved
```

Successful settlement:

```text
reserved -= amount
spent += amount
```

Failed provider settlement:

```text
reserved -= amount
spent unchanged
```

This prevents concurrent actions from oversubscribing authority while avoiding permanent spending on a provider failure.

## Trust boundary

The program can prove that:

- the right signer authorized;
- policy was active and unexpired;
- amount was inside limits;
- nonce was current;
- approval matched the action;
- budget state transitioned under program rules.

The program cannot independently prove that an airline, warehouse, API or physical-world event told the truth.

**Integrity ≠ truth.**

## UI contract

The main operator workspace is intentionally not a generic SaaS card dashboard.

Design principles adapted from the supplied reference projects:

- compact top toolbar;
- high information density;
- causal/dependency state as a primary visual;
- sticky authority work rail;
- detailed evidence on demand;
- exact approval as a focused checkpoint;
- provider/fixture state visible rather than hidden;
- responsive sheet/drawer behavior on smaller displays.
