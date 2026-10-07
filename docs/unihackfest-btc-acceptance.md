# UniHackFest 2026 — BTC Acceptance Audit

Status: IN_PROGRESS  
Basis: official UniHackFest 2026 rules, last updated 21/07/2026.

## Registered direction

Recommended competition fit from the current implementation:

- Track: Best Technical Build
- Topic: AI x Web3

The product combines an AI planning layer with deterministic off-chain policy and an Anchor/Solana authority layer. This aligns directly with the Technical Build rubric rather than relying on a business-model-first story.

## Mandatory submission requirements

### Working product

BTC requirement:
- live demo link or accessible devnet;
- not video-only.

Current status: PARTIAL / PUBLIC APP URL STILL MISSING

Evidence:
- local application returns HTTP 200;
- production build passes;
- main product flows are implemented;
- no verified public application deployment URL exists;
- AgentPolicy is deployed on Devnet and one real `initialize_policy` transaction/PDA is publicly verifiable.

Exit gate:
- [ ] public live URL smoke-tested OR verified accessible Devnet product path.

### Source code

BTC requirement:
- public repository;
- commit history showing genuine build process.

Current status: FAIL

Evidence:
- local branch: main;
- only one local commit currently exists: Initial commit;
- no GitHub remote is configured;
- GitHub connector does not currently find this repository.

Exit gate:
- [ ] public GitHub repository exists;
- [ ] remote is verified;
- [ ] meaningful commit history exists and matches actual implementation phases;
- [ ] no secrets are committed.

### Backup demo video

BTC requirement:
- 60–90 seconds;
- live screen recording;
- no staged mockup.

Current status: FAIL

Evidence:
- demo scripts exist;
- no final video asset or verified video URL exists.

Exit gate:
- [ ] record current real product interaction;
- [ ] include real wallet/Devnet evidence only if actually confirmed;
- [ ] upload and verify URL.

### Pitch deck

BTC requirement:
- submit before presentation for BTC preload.

Current status: FAIL

Evidence:
- demo script and architecture docs exist;
- no final competition pitch deck is present in the repo.

Exit gate:
- [ ] final UniHackFest pitch deck prepared;
- [ ] all claims match live evidence;
- [ ] deck link/file verified.

### Registration data

BTC requirement:
- primary track;
- topic;
- team list.

Current status: PARTIAL

Known product direction:
- Best Technical Build;
- AI x Web3.

Team/member registration must be verified against the actual submitted team roster before final submission.

## Best Technical Build rubric

### 1. Technical difficulty and depth — 30%

Current status: PASS LOCALLY / EVIDENCE STRONG

Implemented:
- deterministic ALLOW / ESCALATE / BLOCK engine;
- exact approval binding;
- stale approval invalidation;
- replay/nonce protection;
- provider execution guard;
- DeepSeek structured planning boundary;
- Logistics + Travel domain proofs;
- Anchor AgentPolicy / ActionApproval / ActionAuthorization lifecycle;
- successful and failed settlement semantics.

Verification:
- 74 Bun tests / 184 assertions PASS;
- TypeScript PASS;
- ESLint PASS;
- Next production build PASS;
- Anchor build PASS;
- 7 Rust authority tests PASS;
- 1 local lifecycle integration PASS.

Remaining:
- public judge-accessible evidence.

### 2. On-chain/off-chain architecture and smart-contract quality — 25%

Current status: PASS WITH PUBLIC DEVNET EVIDENCE

PASS:
- explicit AI/off-chain vs deterministic/on-chain authority boundary;
- Anchor accounts and lifecycle exist;
- signer, expiry, amount, budget, nonce and settlement invariants exist;
- browser transaction bridge validates exact program/accounts/instruction before relay;
- AgentPolicy program is deployed and executable on Devnet;
- Phantom-signed `initialize_policy` is Finalized at slot `504826447`;
- PDA `FBxjL53RRFeH3sqn9k9eGDneX1rmZVUWcDNzEkwKcrtV` is read back and decoded successfully;
- product UI exposes the real transaction/PDA Explorer links.

Exit gate:
- [x] deploy AgentPolicy on Devnet;
- [x] Phantom signs real initialize_policy transaction;
- [x] RPC confirmation PASS;
- [x] AgentPolicy PDA readback PASS;
- [x] Explorer transaction shown in product UI.

### 3. Solana stack utilization, composability, performance — 25%

Current status: PARTIAL

Implemented:
- Anchor custom program;
- PDA authority state;
- Phantom browser signer;
- Solana Web3 transaction construction;
- Devnet RPC prepare/submit/confirm/readback path;
- nonce/replay and delegated budget semantics.

Judge evidence now includes:
- public Devnet program deployment;
- real browser-signed AgentPolicy transaction;
- public Explorer transaction and PDA proof;
- clean Evidence reload that recovers the confirmed signature/slot/PDA without a second signature request;
- full Devnet lifecycle smoke: initialize, low-risk authorize, successful settlement, exact high-risk approval, approved authorization, failed settlement, and replay rejection.

Exit gate:
- [x] real Devnet end-to-end path completed;
- [ ] README explains why Solana is required rather than decorative;
- [x] demo shows the confirmed PDA and Explorer evidence live.

### 4. Demo completeness and presentation — 20%

Current status: PARTIAL

PASS:
- product landing exists;
- demo hub exists;
- Logistics and Travel have dedicated experiences;
- Architecture and Evidence surfaces exist;
- Phantom signer verification works;
- real transaction review surface exists;
- fail-closed blocker appears truthfully when program is unavailable;
- responsive landing/browser review has passed on primary pages.

Remaining:
- [ ] final clean demo route console QA;
- [ ] public demo URL;
- [x] Devnet transaction evidence;
- [ ] 60–90 second backup video;
- [ ] final pitch deck;
- [ ] timed 4-minute online-round rehearsal or 5-minute final rehearsal as applicable.

## Integrity / compliance

PASS:
- no fake Devnet signature;
- no fake Explorer evidence;
- no mainnet transaction path;
- message signing is explicitly separated from smart-contract signing;
- fixture execution is labelled and not presented as blockchain proof;
- system fails closed when Devnet prerequisites are unavailable;
- real Devnet evidence is separated from fixture/localnet evidence and is recoverable from the confirmed PDA.

## Current competition verdict

NOT YET BTC-SUBMISSION-READY.

The application, local technical core, browser-signed Devnet policy proof, and full public Devnet lifecycle smoke are ready. Mandatory submission artifacts are still incomplete.

Highest-priority order:
1. Public GitHub repo with real commit history.
2. Public live demo deployment.
3. 60–90s real demo video.
4. Final pitch deck.
5. Final submission URL/roster verification.
