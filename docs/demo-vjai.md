# VJAI 3-minute demo

## Story

AI can optimize operations, but autonomous action creates operational risk. The Agent Control Plane lets an AI agent react to a warehouse disruption while deterministic policy protects inventory, capacity and approval boundaries.

## 0:00–0:25 — Problem

Open the operator workspace.

Say:

> An inbound shipment to HCM is delayed 12 hours, but the customer SLA is 6 hours. HCM has only 50 units of SKU-X left.

Point to the dependency path:

```text
Inbound shipment
→ HCM inventory
→ Fulfillment
→ Customer SLA
```

## 0:25–0:55 — Agent proposal

Show:

> Transfer 250 units from Binh Duong to HCM.

Explain that AI/planning can propose the action, but cannot execute it directly.

## 0:55–1:30 — Deterministic policy

Show the authority rail:

- delegated agent: PASS;
- action type: PASS;
- quantity 250 / max 300: PASS;
- receiving capacity: PASS;
- exact action value: $8,000;
- autonomous threshold: $5,000.

Decision:

> **ESCALATE**

No WMS mutation has happened yet.

## 1:30–2:05 — Exact approval

Click **Review exact approval**.

Show that consent is bound to:

- action;
- amount;
- quote where applicable;
- nonce.

Click:

> **I approve exactly $8,000**

The decision becomes **ALLOW** and the fixture WMS executor runs.

## 2:05–2:35 — Result

Show:

- HCM inventory increases from 50 → 300;
- Binh Duong inventory decreases;
- stockout prevented: YES;
- SLA preserved: YES;
- 250 units transferred;
- execution receipt recorded.

## 2:35–3:00 — Why this is Agentic AI

Point to the execution trace:

```text
Observe
→ Build context
→ Propose
→ Validate
→ Policy
→ Approval
→ Execute
→ Receipt
```

Close with:

> AI decides what it wants to do. The Control Plane decides whether it is allowed to do it.

## Sustainability wording

Use only demonstrated operational metrics.

Safe:

- stockout prevented;
- emergency transfer avoided/used;
- inventory imbalance;
- expiring units;
- SLA preserved;
- estimated distance only when a methodology is shown.

Do not claim measured CO₂ savings without a documented calculation.
