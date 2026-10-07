use std::{str::FromStr, time::{SystemTime, UNIX_EPOCH}};

use anchor_client::{Client, Cluster, CommitmentConfig};
use solana_keypair::read_keypair_file;
use solana_pubkey::Pubkey;
use solana_signer::Signer;

use agent_policy::{
    constants::{APPROVAL_SEED, AUTHORIZATION_SEED, POLICY_SEED},
    AuthorizationStatus,
};

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock")
        .as_secs() as i64
}

fn unique_policy_id() -> [u8; 32] {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock")
        .as_nanos();

    let mut id = [0u8; 32];
    id[..16].copy_from_slice(&nanos.to_le_bytes());
    id[16..28].copy_from_slice(b"DEVNETFULLV1");
    id
}

fn main() {
    let program_id =
        Pubkey::try_from("5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH").expect("valid program id");
    let wallet_path = std::env::var("ANCHOR_WALLET").expect("ANCHOR_WALLET is required");
    let payer = read_keypair_file(&wallet_path).expect("read wallet");
    let cluster = std::env::var("DEVNET_SMOKE_RPC_URL")
        .ok()
        .map(|url| Cluster::from_str(&url).expect("valid DEVNET_SMOKE_RPC_URL"))
        .unwrap_or(Cluster::Devnet);
    let client = Client::new_with_options(cluster, &payer, CommitmentConfig::confirmed());
    let program = client.program(program_id).expect("load program");

    let now = unix_now();
    let policy_id = unique_policy_id();
    let policy = Pubkey::find_program_address(
        &[POLICY_SEED, payer.pubkey().as_ref(), policy_id.as_ref()],
        &program_id,
    )
    .0;

    let initialize_signature = program
        .request()
        .accounts(agent_policy::accounts::InitializePolicy {
            authority: payer.pubkey(),
            policy,
            system_program: solana_sdk_ids::system_program::id(),
        })
        .args(agent_policy::instruction::InitializePolicy {
            policy_id,
            agent_signer: payer.pubkey(),
            settlement_authority: payer.pubkey(),
            total_budget: 10_000,
            max_per_action: 5_000,
            auto_approve_max: 1_000,
            expires_at: now + 3_600,
            goal_hash: [41u8; 32],
            allowed_actions_hash: [42u8; 32],
        })
        .send()
        .expect("initialize policy on devnet");

    let low_action_hash = [51u8; 32];
    let low_nonce = 0u64;
    let low_authorization = Pubkey::find_program_address(
        &[
            AUTHORIZATION_SEED,
            policy.as_ref(),
            &low_nonce.to_le_bytes(),
        ],
        &program_id,
    )
    .0;

    let low_authorize_signature = program
        .request()
        .accounts(agent_policy::accounts::AuthorizeAction {
            agent_signer: payer.pubkey(),
            policy,
            authorization: low_authorization,
            system_program: solana_sdk_ids::system_program::id(),
        })
        .args(agent_policy::instruction::AuthorizeAction {
            action_hash: low_action_hash,
            amount: 900,
            nonce: low_nonce,
        })
        .send()
        .expect("authorize low-risk action on devnet");

    let low_settle_signature = program
        .request()
        .accounts(agent_policy::accounts::SettleAction {
            policy,
            authorization: low_authorization,
            settlement_authority: payer.pubkey(),
        })
        .args(agent_policy::instruction::SettleAction {
            success: true,
            provider_ref_hash: [52u8; 32],
        })
        .send()
        .expect("settle low-risk action on devnet");

    let high_action_hash = [61u8; 32];
    let high_nonce = 1u64;
    let approval = Pubkey::find_program_address(
        &[
            APPROVAL_SEED,
            policy.as_ref(),
            high_action_hash.as_ref(),
            &high_nonce.to_le_bytes(),
        ],
        &program_id,
    )
    .0;
    let high_authorization = Pubkey::find_program_address(
        &[
            AUTHORIZATION_SEED,
            policy.as_ref(),
            &high_nonce.to_le_bytes(),
        ],
        &program_id,
    )
    .0;

    let approval_signature = program
        .request()
        .accounts(agent_policy::accounts::ApproveHighRiskAction {
            authority: payer.pubkey(),
            policy,
            approval,
            system_program: solana_sdk_ids::system_program::id(),
        })
        .args(agent_policy::instruction::ApproveHighRiskAction {
            action_hash: high_action_hash,
            amount: 2_500,
            nonce: high_nonce,
            approval_expires_at: unix_now() + 300,
        })
        .send()
        .expect("approve high-risk action on devnet");

    let high_authorize_signature = program
        .request()
        .accounts(agent_policy::accounts::AuthorizeApprovedAction {
            agent_signer: payer.pubkey(),
            policy,
            approval,
            authorization: high_authorization,
            system_program: solana_sdk_ids::system_program::id(),
        })
        .args(agent_policy::instruction::AuthorizeApprovedAction {
            action_hash: high_action_hash,
            amount: 2_500,
            nonce: high_nonce,
        })
        .send()
        .expect("authorize exact approved action on devnet");

    let replay_result = program
        .request()
        .accounts(agent_policy::accounts::AuthorizeAction {
            agent_signer: payer.pubkey(),
            policy,
            authorization: high_authorization,
            system_program: solana_sdk_ids::system_program::id(),
        })
        .args(agent_policy::instruction::AuthorizeAction {
            action_hash: high_action_hash,
            amount: 500,
            nonce: high_nonce,
        })
        .send();

    assert!(replay_result.is_err(), "replay nonce must fail on devnet");

    let high_settle_signature = program
        .request()
        .accounts(agent_policy::accounts::SettleAction {
            policy,
            authorization: high_authorization,
            settlement_authority: payer.pubkey(),
        })
        .args(agent_policy::instruction::SettleAction {
            success: false,
            provider_ref_hash: [62u8; 32],
        })
        .send()
        .expect("settle failed high-risk action on devnet");

    let policy_state: agent_policy::AgentPolicy =
        program.account(policy).expect("fetch policy state");
    let approval_state: agent_policy::ActionApproval =
        program.account(approval).expect("fetch approval state");
    let low_authorization_state: agent_policy::ActionAuthorization =
        program.account(low_authorization).expect("fetch low authorization state");
    let high_authorization_state: agent_policy::ActionAuthorization =
        program.account(high_authorization).expect("fetch high authorization state");

    assert_eq!(policy_state.spent_amount, 900);
    assert_eq!(policy_state.reserved_amount, 0);
    assert_eq!(policy_state.nonce, 2);
    assert!(policy_state.is_active);
    assert!(approval_state.used);
    assert!(
        low_authorization_state.status == AuthorizationStatus::SettledSuccess
    );
    assert!(
        high_authorization_state.status == AuthorizationStatus::SettledFailed
    );

    println!("PROGRAM_ID={program_id}");
    println!("WALLET={}", payer.pubkey());
    println!("POLICY_PDA={policy}");
    println!("LOW_AUTHORIZATION_PDA={low_authorization}");
    println!("APPROVAL_PDA={approval}");
    println!("HIGH_AUTHORIZATION_PDA={high_authorization}");
    println!("INITIALIZE_TX={initialize_signature}");
    println!("LOW_AUTHORIZE_TX={low_authorize_signature}");
    println!("LOW_SETTLE_TX={low_settle_signature}");
    println!("APPROVAL_TX={approval_signature}");
    println!("HIGH_AUTHORIZE_TX={high_authorize_signature}");
    println!("HIGH_SETTLE_TX={high_settle_signature}");
    println!("REPLAY_REJECTED=true");
    println!("FINAL_SPENT={}", policy_state.spent_amount);
    println!("FINAL_RESERVED={}", policy_state.reserved_amount);
    println!("FINAL_NONCE={}", policy_state.nonce);
    println!("POLICY_ACTIVE={}", policy_state.is_active);
}
