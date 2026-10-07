const PROGRAM_ID = "5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH";

const instructions = [
  "initialize_policy",
  "update_policy",
  "delegate_agent",
  "revoke_policy",
  "approve_high_risk_action",
  "authorize_action",
  "authorize_approved_action",
  "settle_action",
  "close_policy",
] as const;

export default function SolanaPage() {
  return (
    <main className="subpage-shell">
      <section className="subpage-head">
        <div>
          <p className="operator-eyebrow">SOLANA / ANCHOR AUTHORITY</p>
          <h1>Delegated authority is enforceable outside the model.</h1>
          <p>
            The backend orchestrates; the Anchor program enforces signer,
            expiry, budget reservation, nonce and exact approval constraints.
          </p>
        </div>
        <div className="subpage-status">
          <span>Localnet</span>
          <strong className="status-good">8 / 8 PASS</strong>
          <span>Devnet</span>
          <strong className="status-watch">Funding pending</strong>
        </div>
      </section>

      <section className="solana-layout">
        <article className="solana-program">
          <div className="solana-program-head">
            <div>
              <span>PROGRAM</span>
              <strong>agent_policy</strong>
            </div>
            <span className="mode-pill">ANCHOR</span>
          </div>

          <div className="program-id">
            <span>Program ID</span>
            <code>{PROGRAM_ID}</code>
          </div>

          <div className="instruction-list">
            {instructions.map((instruction, index) => (
              <div key={instruction}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <code>{instruction}</code>
              </div>
            ))}
          </div>
        </article>

        <aside className="solana-evidence-rail">
          <article className="evidence-summary evidence-summary-good">
            <span>LOCAL AUTHORITY EVIDENCE</span>
            <strong>Anchor lifecycle verified</strong>
            <ul>
              <li>7 Rust policy unit tests passed.</li>
              <li>Localnet policy lifecycle passed.</li>
              <li>Replay nonce rejection verified.</li>
              <li>Failed settlement releases reserved budget.</li>
            </ul>
          </article>

          <article className="evidence-summary evidence-summary-watch">
            <span>DEVNET EVIDENCE</span>
            <strong>Pending external funding</strong>
            <p>
              Wallet balance is 0 SOL. Public CLI faucet rate-limited the
              request; no existing deploy buffer or program rent can be
              reclaimed. No Explorer signature is fabricated.
            </p>
          </article>
        </aside>
      </section>

      <section className="trust-note">
        <strong>Integrity ≠ truth</strong>
        <span>
          On-chain state proves the committed authority transition. It does not
          independently prove that an airline, warehouse or external provider
          reported a truthful real-world event.
        </span>
      </section>
    </main>
  );
}
