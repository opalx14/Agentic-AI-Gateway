import Link from "next/link";

const stages = [
  ["01", "AI proposes", "Structured intent only. The model never owns executable authority."],
  ["02", "Policy authorizes", "Deterministic software returns ALLOW, ESCALATE or BLOCK."],
  ["03", "Human approves", "Only exact action + amount + quote + nonce can be approved."],
  ["04", "Provider executes", "Execution is permitted only after an ALLOW result."],
  ["05", "Receipt proves", "Provider outcome and authority outcome remain distinct evidence."],
] as const;

export default function ArchitecturePage() {
  return (
    <main className="subpage-shell">
      <section className="subpage-head"><div><p className="operator-eyebrow">AUTHORITY ARCHITECTURE</p><h1>AI → Policy → Approval → Provider → Receipt</h1><p>The gateway turns probabilistic planning into bounded execution by inserting deterministic authority before every consequential action.</p></div></section>
      <section className="architecture-flow-list">{stages.map(([index,title,copy]) => (<article key={index}><span>{index}</span><div><h2>{title}</h2><p>{copy}</p></div></article>))}</section>
      <section className="subpage-note"><strong>Fail-closed invariant</strong><span>Critical dependency failure, changed approval context, or uncertain authority never falls through to provider execution.</span></section>
      <Link href="/demos" className="landing-primary inline-product-cta">See the control plane in action</Link>
    </main>
  );
}
