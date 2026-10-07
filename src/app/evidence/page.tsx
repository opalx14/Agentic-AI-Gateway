import Link from "next/link";

import { buildOperatorWorkspaceData } from "@/app/demo-data";
import { OnchainPolicyControl } from "@/components/OnchainPolicyControl";
import { generatedArt } from "@/lib/generated-art";

const proofStages = [
  {
    index: "01",
    title: "Who is allowed to act?",
    technical: "AgentPolicy",
    copy: "Persistent policy state: authority, delegated agent, settlement authority, budget, max per action, auto-approval limit, expiry, allowed-action hash and nonce.",
  },
  {
    index: "02",
    title: "What did the human approve?",
    technical: "ActionApproval",
    copy: "Created only when an action needs consent. It binds the approver to one action hash, amount, nonce and approval expiry.",
  },
  {
    index: "03",
    title: "Was this action authorized?",
    technical: "ActionAuthorization",
    copy: "Reserves the permitted amount against the policy and records the action hash, agent signer, nonce and authorization time.",
  },
  {
    index: "04",
    title: "What happened after execution?",
    technical: "Authorization settlement + ActionSettled event",
    copy: "Settlement writes success/failure, settlement time and provider receipt hash back to the authorization, then emits an audit event.",
  },
] as const;

export default async function EvidencePage() {
  const data = await buildOperatorWorkspaceData();
  const logistics = data.logistics.pending;
  const travel = data.travel.optionB;

  return (
    <main className="subpage-shell clarity-subpage evidence-clarity">
      <section className="subpage-head clarity-subpage-head">
        <div>
          <p className="operator-eyebrow">EVIDENCE</p>
          <h1>Follow the proof lifecycle, not just the transaction hash.</h1>
          <p>
            The product separates application behavior, local Anchor verification,
            wallet identity and public Devnet proof so no local fixture is ever
            presented as a blockchain transaction.
          </p>
        </div>
      </section>

      <section className="evidence-hero-art" aria-label="Authority proof visual">
        <div className="clarity-art evidence-hero-art-image" role="img" aria-label="3D Solana policy shield and verified authority core" style={{ backgroundImage: `url("${generatedArt.policyShield}")` }} />
        <div><span>PROOF MODEL</span><strong>Authority before execution.</strong><p>Policy limits, exact human consent and settlement evidence are separate checkpoints that can be inspected independently.</p></div>
      </section>

      <section className="evidence-truth-strip" aria-label="Evidence truth levels">
        <div><span>APP FLOW</span><strong>IMPLEMENTED</strong><small>Deterministic policy + provider receipt</small></div>
        <div><span>LOCAL ANCHOR</span><strong>VERIFIED</strong><small>Policy / approval / authorization lifecycle</small></div>
        <div><span>PHANTOM</span><strong>AVAILABLE</strong><small>Human signer identity + transaction bridge</small></div>
        <div><span>DEVNET</span><strong className="status-watch">PROGRAM DEPLOYED</strong><small>Executable program verified on Devnet</small></div>
      </section>

      <section className="landing-section evidence-lifecycle-section">
        <div className="landing-section-head">
          <p className="landing-kicker">POLICY → APPROVAL → AUTHORIZATION → SETTLEMENT</p>
          <h2>What the Solana program actually records.</h2>
          <p>
            Solana stores minimal authority state. Raw business records, AI reasoning
            and private operational context remain off-chain.
          </p>
        </div>

        <div className="clarity-chain-records">
          {proofStages.map((stage) => (
            <article key={stage.technical}>
              <span>{stage.index}</span>
              <h3>{stage.title}</h3>
              <code>{stage.technical}</code>
              <p>{stage.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section evidence-use-case-section">
        <div className="landing-section-head">
          <p className="landing-kicker">WHAT THIS MEANS IN THE TWO DEMOS</p>
          <h2>The same proof model follows different business actions.</h2>
        </div>

        <div className="clarity-ledger-grid">
          <article>
            <div className="clarity-art evidence-usecase-art" role="img" aria-label="3D logistics authority proof illustration" style={{ backgroundImage: `url("${generatedArt.logistics}")` }} />
            <div className="clarity-ledger-head">
              <span>LOGISTICS</span>
              <strong>{logistics.actionTitle}</strong>
            </div>
            <dl>
              <div><dt>Problem</dt><dd>Inbound delayed 12h; HCM SKU-X risks stockout.</dd></div>
              <div><dt>Decision</dt><dd>{logistics.decision} because $8,000 is above the $5,000 auto limit.</dd></div>
              <div><dt>Approval</dt><dd>Exact action hash + $8,000 + nonce + signer + expiry.</dd></div>
              <div><dt>Authorization</dt><dd>Reserve the amount against the policy before WMS execution.</dd></div>
              <div><dt>Settlement</dt><dd>Update authorization success/failure and attach the WMS/provider receipt hash.</dd></div>
            </dl>
            <Link href="/demos/logistics" className="clarity-inline-link">Open Logistics journey →</Link>
          </article>

          <article>
            <div className="clarity-art evidence-usecase-art" role="img" aria-label="3D travel authority proof illustration" style={{ backgroundImage: `url("${generatedArt.travel}")` }} />
            <div className="clarity-ledger-head">
              <span>TRAVEL</span>
              <strong>{travel.actionTitle}</strong>
            </div>
            <dl>
              <div><dt>Problem</dt><dd>Original flight delayed 6h; arrival before 17:00 is at risk.</dd></div>
              <div><dt>Decision</dt><dd>+$15 can be delegated; +$45 requires exact approval.</dd></div>
              <div><dt>Approval</dt><dd>Exact quote-bound action hash + amount + nonce.</dd></div>
              <div><dt>Authorization</dt><dd>Reserve the permitted fare delta before provider booking.</dd></div>
              <div><dt>Settlement</dt><dd>Update authorization status and attach the booking/provider receipt hash.</dd></div>
            </dl>
            <Link href="/demos/travel" className="clarity-inline-link">Open Travel journey →</Link>
          </article>
        </div>
      </section>

      <section className="landing-section evidence-boundary-section">
        <div className="clarity-chain-boundary">
          <div className="is-offchain">
            <span>OFF-CHAIN APPLICATION DATA</span>
            <h3>Context stays where the business needs it.</h3>
            <ul>
              <li>AI prompts and reasoning</li>
              <li>Warehouse inventory and booking records</li>
              <li>Provider API responses</li>
              <li>Private or commercially sensitive data</li>
            </ul>
          </div>
          <div className="is-onchain">
            <span>ON-CHAIN AUTHORITY PROOF</span>
            <h3>Only the minimal evidence needed to verify authority.</h3>
            <ul>
              <li>Policy limits, delegated signer, expiry and nonce</li>
              <li>Exact action hash and amount for high-risk approval</li>
              <li>Authorization reservation state</li>
              <li>Settlement result and provider receipt hash</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="evidence-approval-art">
        <div className="clarity-art evidence-approval-art-image" role="img" aria-label="3D verified human approval identity" style={{ backgroundImage: `url("${generatedArt.humanApproval}")` }} />
        <div><p className="landing-kicker">EXACT HUMAN CONSENT</p><h2>A signer approves one action—not the agent forever.</h2><p>ActionApproval binds the wallet to the action hash, amount, nonce and expiry. A changed quote or amount requires a new approval.</p></div>
      </section>

      <section className="evidence-live-control">
        <div className="evidence-live-control-copy">
          <p className="landing-kicker">REAL DEVNET TRANSACTION BRIDGE</p>
          <h2>Prepare the actual AgentPolicy transaction—only when the program exists.</h2>
          <p>
            The browser builds a real <code>initialize_policy</code> transaction for
            Phantom. The server validates the exact program, accounts and instruction
            before relay, then confirms the transaction and reads the resulting PDA.
            The configured program is deployed and executable on Devnet. The next gate is the real Phantom-signed initialize_policy transaction.
          </p>
        </div>
        <OnchainPolicyControl />
      </section>

      <Link href="/demos" className="landing-secondary inline-product-cta">Back to use cases</Link>
    </main>
  );
}
