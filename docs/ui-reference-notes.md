# UI reference notes

## Primary visual reference — N.E.D Wallet

Source: `Tdat10052499/Unihackfest-2026`

Patterns adapted:
- dark Web3 background;
- purple gradient accent;
- large headline / amount hierarchy;
- transaction-oriented Review → Confirm → Result flow;
- semantic success / warning / error states;
- technical detail secondary to the current user action.

Not copied:
- wallet/asset product content;
- mascot;
- exact screens;
- mobile-app navigation.

## Secondary clarity reference — SkillBridge Vietnam

Source: `2274802010922/SkillBridge-Vietnam`

Patterns adapted:
- one-line product promise before technical detail;
- explicit network/demo scope;
- human final authority is visible;
- blockchain evidence and application state are separated;
- wallet onboarding is explicit and no-funds-required;
- trust claims are bounded: chain state proves committed transitions, not real-world truth;
- wallet proof is an interaction, not a hidden setup requirement.

## Additional clarity reference — SolStreak

Source: `NTP010205/UniHackFest_SolStreak`
Hosted reference inspected with Remoat: `https://solstreak.onrender.com/admin`

Patterns adapted:
- explain the user ritual before the implementation stack;
- explicit Devnet/safety scope in the hero;
- one reusable glass-card/token system across landing, dashboard and admin states;
- product loop presented as concrete numbered steps;
- proof remains separate from animation/polish;
- loading, forbidden, empty and read-only admin states use the same design language;
- blockchain verification is described in plain language before raw transaction detail.

### Transaction-history references

Squads:
- action records show status, signers/confirmations and execution state before advanced detail.

Solscan:
- human-readable one-line action summary and key-actions mode precede raw instructions/logs.

Phantom:
- activity history is organized by action type, network, status and time, with explorer detail secondary.

Helius:
- parsed transaction descriptions demonstrate the value of translating raw Solana activity into human-readable event feeds.

### Product rule derived from these references

Agentic AI Gateway must use a **journey-first, proof-second** hierarchy:

```text
Observe
→ AI proposes
→ deterministic policy decides
→ human consents when needed
→ Solana records authority proof
→ provider executes
→ settlement closes the loop
```

The UI must explain what each use case means before showing account names, hashes or raw instructions.

## Combined direction for Agentic AI Gateway

The homepage should read as:

```text
AI proposes.
Authority decides.

Incident
→ AI proposal
→ deterministic authority
→ exact human review when required
→ execution
→ receipt
```

Primary surface:
- Logistics / Travel only.

Secondary detail:
- hard BLOCK;
- provider FAILED;
- quote-change invalidation;
- Anchor / Devnet evidence.

Wallet:
- Phantom connect is optional for browsing;
- connected wallet represents human authority identity;
- signer verification is a message signature only;
- the message explicitly states no transaction / no funds;
- no transfer is requested in this phase.
