import Image from "next/image";
import Link from "next/link";

import { generatedArt } from "@/lib/generated-art";

export default function ProductPage() {
  return (
    <main className="landing-shell landing-web3 landing-clarity">
      <div className="web3-mesh" aria-hidden="true" />
      <div className="web3-grid" aria-hidden="true" />

      <section className="landing-hero clarity-hero">
        <div className="landing-hero-copy">
          <div className="landing-chain-badges">
            <span className="solana-badge">SOLANA</span>
            <span>ANCHOR</span>
            <span>PHANTOM</span>
            <span>AI TRAVEL</span>
          </div>
          <p className="landing-kicker">AI VERIFICATION FLOW</p>
          <h1>
            See what the AI does.
            <span>Then verify the exact action it is allowed to take.</span>
          </h1>
          <p className="landing-lede clarity-lede">
            This page shows the product control flow behind Travel: user intent,
            off-chain AI work, deterministic checks, human confirmation and the
            final Solana proof. Search stays private; authority becomes verifiable.
          </p>
          <div className="landing-actions">
            <Link href="/" className="landing-primary">Try the travel agent →</Link>
            <a href="#verification-flow" className="landing-secondary">View verification steps</a>
          </div>
        </div>

        <div className="clarity-hero-visual">
          <div className="clarity-hero-art-stage">
            <Image
              src={generatedArt.travel}
              alt="AI travel agent verification flow"
              width={620}
              height={370}
              className="clarity-product-hero-image"
              unoptimized
              priority
            />
            <div className="clarity-art-float clarity-art-float-policy">
              <span>AI WORK</span>
              <strong>Search + rank off-chain</strong>
            </div>
            <div className="clarity-art-float clarity-art-float-proof">
              <span>FINAL PROOF</span>
              <strong>Phantom + Solana</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="verification-flow">
        <div className="landing-section-head">
          <p className="landing-kicker">PRODUCT FLOW</p>
          <h2>Five checkpoints make the AI&apos;s work visible before anything consequential is authorized.</h2>
          <p>
            The agent can search and compose off-chain, but it cannot silently
            turn a suggestion into authority. Each step has a clear boundary.
          </p>
        </div>
        <div className="landing-steps">
          {[
            ["01", "User goal", "The traveller gives destination, preferences, constraints and budget."],
            ["02", "AI work", "The agent searches providers, ranks options and builds a local draft off-chain."],
            ["03", "Deterministic checks", "Software validates scope, amount, dependencies and policy before execution."],
            ["04", "Human confirmation", "The traveller can select, decline or change services before final approval."],
            ["05", "Solana proof", "One final digest binds the exact approved action to Phantom and Devnet evidence."],
          ].map(([index, title, copy]) => (
            <article key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section clarity-blockchain" id="blockchain">
        <div className="landing-section-head">
          <p className="landing-kicker">WHY SOLANA IS HERE</p>
          <h2>Blockchain records consent and authority, not the traveller&apos;s private itinerary.</h2>
          <p>
            Search results and personal context stay off-chain. Exact action
            digests, policy state, approvals and authorization checkpoints are
            the verifiable layer.
          </p>
        </div>
        <div className="clarity-chain-boundary">
          <div className="is-offchain">
            <span>STAYS OFF-CHAIN</span>
            <h3>Travel context</h3>
            <ul>
              <li>Prompt and preferences</li>
              <li>Provider search responses</li>
              <li>Passenger details</li>
              <li>Hotel and activity metadata</li>
            </ul>
          </div>
          <div className="is-onchain">
            <span>GOES ON-CHAIN</span>
            <h3>Authority proof</h3>
            <ul>
              <li>Policy and nonce</li>
              <li>Exact action hash</li>
              <li>Approved amount</li>
              <li>Authorization state</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
