# Devnet deployment runbook

## Current verified state

- Program `5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH` is deployed and executable on Devnet.
- Phantom-signed browser `initialize_policy` is Finalized at slot `504826447` with PDA `FBxjL53RRFeH3sqn9k9eGDneX1rmZVUWcDNzEkwKcrtV`.
- CLI deploy/smoke wallet `FA6bL3YNsxCvRuPDYM5gUE6aTDD5iWaUCUcWfpTuvs8w` is funded on Devnet.
- Full lifecycle smoke has passed on public Devnet: initialize → low-risk authorize → successful settlement → high-risk approval → approved authorization → failed settlement; replay nonce is rejected.
- Final smoke policy state: spent `900`, reserved `0`, nonce `2`, active `true`.

## Preflight

```bash
solana address
solana balance --url devnet
solana cluster-version --url devnet
```

The wallet must have enough Devnet SOL for program deployment and smoke transactions.

## Build

On the current macOS environment:

```bash
cd solana

SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk \
  ~/.avm/bin/anchor-1.1.2 build
```

Reason: the installed default MacOSX27.0 SDK exposes TAPI architecture entries not understood by the current linker; the installed 26.5 SDK has been verified to build successfully.

## Confirm program key

Current program ID:

```text
5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH
```

Before deployment, confirm the generated program key and `declare_id!` remain aligned.

## Deploy

Only after Devnet wallet funding is available:

```bash
cd solana

solana balance --url devnet

SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk \
  ~/.avm/bin/anchor-1.1.2 deploy --provider.cluster devnet
```

Record the confirmed deploy signature and program ID.

## Smoke flow

The repository includes:

```text
solana/tests/src/bin/devnet_smoke.rs
```

It creates and exercises:

1. a new Policy PDA;
2. a low-risk ActionAuthorization PDA;
3. successful settlement of the low-risk authorization;
4. an exact high-risk ActionApproval PDA;
5. an approved ActionAuthorization PDA;
6. replay rejection for the consumed nonce;
7. failed settlement that releases reserved budget.

Run only after the program is deployed. Prefer a stable Devnet RPC to avoid public endpoint throttling:

```bash
cd solana
DEVNET_SMOKE_RPC_URL=https://solana-devnet.api.onfinality.io/public \
ANCHOR_WALLET=~/.config/solana/id.json \
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk \
  cargo run -p tests --bin devnet_smoke
```

Capture:

- PROGRAM_ID / WALLET
- POLICY_PDA
- LOW_AUTHORIZATION_PDA
- APPROVAL_PDA
- HIGH_AUTHORIZATION_PDA
- INITIALIZE_TX
- LOW_AUTHORIZE_TX / LOW_SETTLE_TX
- APPROVAL_TX / HIGH_AUTHORIZE_TX / HIGH_SETTLE_TX
- REPLAY_REJECTED
- FINAL_SPENT / FINAL_RESERVED / FINAL_NONCE / POLICY_ACTIVE

## Latest verified full-lifecycle smoke

Verified on Devnet with RPC `https://solana-devnet.api.onfinality.io/public`.

- Wallet: `FA6bL3YNsxCvRuPDYM5gUE6aTDD5iWaUCUcWfpTuvs8w`
- Policy PDA: `EHPA6T5r1JDPUcoVw6YrtSZm1LpTUs98iNfP9joTrScF`
- Low authorization PDA: `2d3BhamcvtehUiMGyRKP7YYDD4STBgeLtJmJ3ffFUMdu`
- Approval PDA: `4rjAem612NmLS6VdZ6MRrGKUpKiDMZrhqqXYivjt9sqD`
- High authorization PDA: `ZdYMNb9hc2PpWLFGQ8AQ8XgmQFs9rWDXbtGDimdcfDC`
- Initialize TX: `2cf4TKKXGD7LPCckJCgAS5FreBcfv8e29E2t3RDwovhEkc7poirhiMxdy3WkXFKP22LV2zoH9AnVM2dLGj7L6rwu`
- Low authorize TX: `UwcLEf7AGRYTpDpvLz4nPvBMwd9sSjEczzfB8HSVCBrxmqLeTfdY3qVNjxxwyeqQa7oemkSRMXd6J2UV4QvpnTD`
- Low settle TX: `14V6gBdAseGo3so91uVDZdZAE4HQaWRS8FZnx1iihUFpjiiP3Ga75nJtY8vqWpdrYxMNx5CBU4tAFkKRg5rtJQe`
- High-risk approval TX: `35rkUPj7Z9zBZnz6urpPJZCn2r115m9R3fV4WDRdyGQNFbxLupzWWdmU2Y78hy6Y1SsDXfCsVjzbpK772sU7zqYK`
- Approved authorization TX: `53H41MgkUWHcbrbERggQKfWRf3WHcF9qdBKA6otHwELT2NRD8Yrrk78gZ5LL4nntDug8hB3QTpyguDv2Py8NzD4E`
- Failed settlement TX: `5vWSZXTi755Q5cJdTqGcRdYJFMKq2epse41VcMc2fepJKDTh5sPUDiDpiiEWyCpwZAvQPDeYqMw2VFxtjs38wGnL`
- Replay rejection: `true`
- Final state: spent `900`, reserved `0`, nonce `2`, active `true`

All six successful transactions were independently checked as **Finalized**.

## Explorer

For each confirmed signature, open the Solana Explorer with cluster set to Devnet.

Do not put a placeholder transaction in the product UI.

## Completion evidence

Phase 7 completion evidence is now satisfied for the demonstrated path:

- program account exists on Devnet;
- deploy is confirmed;
- browser `initialize_policy` is confirmed and recoverable in UI;
- full lifecycle smoke transactions are Finalized;
- replay rejection and final budget state are asserted by the smoke harness;
- real Explorer transaction/PDA links are generated from confirmed evidence.
