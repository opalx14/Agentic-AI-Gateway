# Browser review evidence

## Automated interaction matrix

Verified against the running Next.js development server at `http://localhost:3000`.

Viewports:

- desktop: 1440 × 900;
- laptop: 1180 × 800;
- tablet: 768 × 900;
- mobile: 390 × 844.

Observed for all four viewports:

- document scroll width equals client width;
- no horizontal document overflow;
- restored dark-purple Web3 visual system is loaded;
- body margin is 0;
- the operator header uses the intended flex layout instead of browser-default block layout;
- no browser console errors;
- no uncaught page runtime errors.

The connected Phantom control was also checked at desktop, tablet and mobile widths. It remained inside the viewport and the **Verify signer** action remained reachable on mobile.

## Flow results

### Logistics — escalation

Initial decision:

```text
ESCALATE
```

Guided next-step CTA:

```text
Review exact $8,000 action
```

The Demo Coach explicitly tells the operator why the action is paused and what to click next.

Review surface:

- exact $8,000 authority impact;
- action / scenario / binding;
- live human-authority evidence;
- exact-consent invalidation warning.

After **Approve exact action & run demo · $8,000**, the browser issues a real POST to `/api/scenarios/logistics`. The UI changes state only after the server returns an `ALLOW` decision and an `EXECUTED` receipt:

```text
ALLOW
EXECUTED
fixture:wms:transfer-bd-hcm-250
```

A browser interception test forced that API call to return HTTP 500. In that case the modal remained open, the workspace stayed `ESCALATE`, and the UI showed:

```text
Execution stopped
simulated outage
```

No successful execution state was displayed.

### Safety case — hard policy block

Case:

```text
301 units proposed / 300 max
```

Observed in **Safety cases**:

```text
BLOCK
Hard deterministic rule prevented the provider call.
```

No warehouse mutation is represented as successful.

### Safety case — provider failure

Authority:

```text
ALLOW
```

Execution:

```text
FAILED
Authority passed, but the provider did not complete the action.
```

The UI keeps authority success separate from provider success.

## Guided demo UX

The demo hub now presents a recommended sequence:

```text
01 Logistics → 02 Travel → 03 Evidence
```

Each dedicated demo now starts with one compact stage instead of stacked explanatory cards. The stage contains:

- one short problem headline;
- three scenario metrics;
- current authority state;
- four compact progress checkpoints;
- exactly one context-sensitive CTA;
- the technical Action Journey/System View only after the main interaction.

Verified browser progression:

- Logistics: compact stage → `Review exact $8,000 action` → review sheet → fixture execute → `Open evidence & proof`; below the stage, only the operational flow strip, AI action and policy boundary remain before results.
- Travel: compact stage → FIX-A `+$15` auto path → FIX-B `+$45` human gate → exact approval; redundant status/commitment/progress/instruction sections were removed.
- desktop and 390px mobile keep the stage CTA readable with no horizontal overflow; desktop header-to-stage gap is ~2px.

The review sheet explicitly separates the fixture execution button from the already-confirmed Devnet proof so judges do not confuse a local demo action with another wallet transaction.

### Travel — Option A

Verified additional cost:

```text
+$15
```

Observed:

```text
ALLOW
```

### Travel — Option B

Verified additional cost:

```text
+$45
```

Initial decision:

```text
ESCALATE
```

After exact review and confirmation, the browser POSTs `{"optionId":"flight-b","approved":true}` to `/api/scenarios/travel` before switching state:

```text
ALLOW
EXECUTED
fixture:travel:booking-1
```

### Safety case — quote change

Prior approval:

```text
+$45
```

Provider-verified amount:

```text
+$48
```

Observed:

```text
APPROVAL INVALIDATED
New verified amount requires a new consent cycle.
```

## Phantom human-authority evidence

An extension-enabled Chrome session detected Phantom and connected the existing test wallet:

```text
FHAqJnHhY3KuSQ9HskoQUmY187BhPiGGtVEqKQSoULsF
```

The signer-verification request shown by Phantom contained:

```text
Agentic AI Gateway — local demo wallet verification
Purpose: confirm the connected human authority signer.
Network action: none.
Transaction: none.
Funds: none.
```

No transaction, token approval, transfer or fund movement was requested.

After message signing, the application showed:

```text
Signer confirmed · 64 signature bytes
```

The exact-approval review then showed:

```text
Phantom signer evidence confirmed
Message signature only · no transaction · 64 signature bytes
```

The Evidence drawer showed the same wallet as **verified** and explicitly stated that the proof is signer evidence only.

## Evidence drawer

Observed evidence groups:

- live Phantom human-authority identity;
- Logistics fixture executor;
- Travel fixture fallback;
- Anchor localnet authority lifecycle;
- confirmed Devnet `initialize_policy` evidence with real transaction/PDA Explorer links.

The drawer keeps the trust boundary explicit:

```text
Integrity ≠ truth.
```

## Secondary routes

The following routes returned HTTP 200, rendered with project styling and had zero horizontal overflow at 1180px:

- `/scenarios`;
- `/scenarios/logistics`;
- `/scenarios/travel`;
- `/policies`;
- `/executions`;
- `/solana`.

## Devnet transaction evidence

A real Phantom-signed `initialize_policy` transaction is Finalized on Devnet:

- transaction: `4YDM1jeqhoP5WnYxkXTLHBYhMfRzYeqytont7gwo5cvwjUPMK5NkrPwcao9Au35mQ2YHb83Tq1NsNxgwdW1QiYGr`;
- slot: `504826447`;
- AgentPolicy PDA: `FBxjL53RRFeH3sqn9k9eGDneX1rmZVUWcDNzEkwKcrtV`;
- decoded budget / max-action / auto-authority: `10000 / 5000 / 2000`;
- account owner: configured AgentPolicy program;
- status: active, nonce `0`.

The Evidence UI recovery path was then verified after a clean reload. It displayed `CONFIRMED + PDA VERIFIED`, the numeric slot, the transaction and PDA Explorer links, and zero console/runtime errors without requesting another signature.

## React Grab development tooling

React Grab `0.2.0` is installed for development. The development DOM contains `//unpkg.com/react-grab/dist/index.global.js`; a production `next start` smoke on port 3002 returned HTTP 200 with no `react-grab` script in the rendered HTML.

## Remoat / Antigravity review status

Remoat is connected to the `Agentic-AI-Gateway` target and was used only for browser/Phantom runtime interaction. Final Evidence review PASS after clean reload: existing on-chain evidence was recovered correctly, no extra transaction was requested, and no Antigravity source/spec mutation was used for the verification.
