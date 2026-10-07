# Competition submission checklist

## Product

- [x] One product thesis: AI Agent Control Plane.
- [x] Logistics is primary business scenario.
- [x] Travel is a secondary cross-domain proof.
- [x] AI intelligence separated from deterministic authority.
- [x] ALLOW / BLOCK / ESCALATE visible.
- [x] Exact approval invalidation implemented.
- [x] Fail-closed provider execution.
- [x] Execution trace visible.
- [x] Fixture mode independent of external APIs.

## AI

- [x] Planning provider interface.
- [x] DeepSeek provider implementation.
- [x] Structured JSON validation.
- [x] Timeout / retry behavior.
- [x] Hallucinated action/resource rejection.
- [x] Deterministic fixture fallback.
- [ ] Live DeepSeek demo credentials configured locally if desired.

## Logistics / VJAI

- [x] inbound delay fixture;
- [x] inventory imbalance;
- [x] transfer proposal;
- [x] capacity enforcement;
- [x] quantity enforcement;
- [x] cold-chain enforcement;
- [x] value escalation;
- [x] approval execution;
- [x] before/after metrics;
- [x] no unsupported CO₂ claim.

## Travel / Atlas

- [x] +$15 autonomous path;
- [x] +$45 escalation path;
- [x] exact approval path;
- [x] +$45 → +$48 invalidation;
- [x] fixture provider;
- [x] Atlas adapter;
- [x] Atlas CLI found locally;
- [x] sandbox booking disabled by default;
- [ ] Atlas credentials configured only if a live sandbox demonstration is desired.

## Solana

- [x] AgentPolicy state.
- [x] approval state.
- [x] authorization state.
- [x] signer enforcement.
- [x] expiry enforcement.
- [x] hard amount limit.
- [x] total / reserved / spent budget.
- [x] nonce replay protection.
- [x] low-risk autonomous authorization.
- [x] high-risk exact approval.
- [x] settlement.
- [x] failed execution releases reservation.
- [x] local Anchor tests.
- [x] connected Phantom wallet has Devnet funding (20 SOL observed).
- [x] program deployed to Devnet.
- [x] confirmed Devnet smoke transactions.
- [x] Explorer evidence connected to UI.

## UI / Demo

- [x] N.E.D-inspired dark Web3 visual system restored and verified.
- [x] compact top toolbar with explicit runtime + Phantom state.
- [x] primary navigation limited to Logistics / Travel.
- [x] causal dependency path.
- [x] focused AI Proposal + Authority Decision cards.
- [x] exact Review → Confirm → Result interaction.
- [x] Safety cases drawer for BLOCK / provider FAILED / quote invalidation.
- [x] Evidence drawer with live Phantom signer evidence plus runtime receipts.
- [x] Phantom connect + public key + sign-message verification.
- [x] verification message explicitly states no transaction / no funds.
- [x] automated browser regression passes at 1440 / 1180 / 768 / 390 widths with no horizontal overflow.
- [x] Remoat-driven browser/Phantom session reached connected + verified signer state without code mutation.
- [ ] final competition screenshots selected/exported.

## Engineering gates

- [x] Bun tests PASS — 74 tests / 184 assertions.
- [x] TypeScript PASS.
- [x] ESLint PASS.
- [x] Next production build PASS.
- [x] Rust authority unit tests PASS.
- [x] Anchor localnet lifecycle PASS.
- [x] Devnet smoke PASS — full lifecycle on public Devnet, 6 finalized transactions + replay rejection.

## UniHackFest BTC mandatory submission

Official BTC requirements currently audited in `docs/unihackfest-btc-acceptance.md`.

- [ ] public live demo URL or accessible Devnet product path.
- [ ] public source repository.
- [ ] meaningful public commit history showing the build process.
- [ ] 60–90 second backup demo video recorded from the real product.
- [ ] final pitch deck submitted for preload.
- [ ] primary track verified in registration.
- [ ] topic verified in registration.
- [ ] team roster verified in registration.

Current blocking facts:
- local app is working and Devnet authority evidence is confirmed, but no verified public demo URL exists;
- no GitHub remote is configured;
- local git history currently has only the initial commit;
- no final video or pitch deck asset is present.

## Submission support assets

- [x] README judge path.
- [x] architecture document.
- [x] VJAI demo script.
- [x] UniHackFest demo script.
- [x] Devnet runbook.
- [x] trust limitations documented.
- [x] BTC acceptance audit.
- [ ] final screenshots.
- [ ] final demo recording.
- [ ] final pitch deck.
- [ ] competition-specific submission forms / URLs entered.
