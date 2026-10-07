use std::time::{SystemTime, UNIX_EPOCH};

use anchor_client::{Client, Cluster, CommitmentConfig};
use solana_keypair::read_keypair_file;
use solana_pubkey::Pubkey;
use solana_signer::Signer;

use agent_policy::constants::{APPROVAL_SEED, AUTHORIZATION_SEED, POLICY_SEED};

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_secs() as i64
}

#[test]
fn test_policy_authority_lifecycle() {
    let program_id =
        Pubkey::try_from("5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH").expect("valid program id");
    let Ok(anchor_wallet) = std::env::var("ANCHOR_WALLET") else {
        eprintln!("skipping localnet integration test: ANCHOR_WALLET is not set");
        return;
    };
    let payer = read_keypair_file(&anchor_wallet).expect("read anchor wallet");

    let client = Client::new_with_options(Cluster::Localnet, &payer, CommitmentConfig::confirmed());
    let program = client.program(program_id).expect("load program");

    let policy_id = [7u8; 32];
    let goal_hash = [8u8; 32];
    let allowed_actions_hash = [9u8; 32];
    let expires_at = now_unix() + 600;

    let policy = Pubkey::find_program_address(
        &[POLICY_SEED, payer.pubkey().as_ref(), policy_id.as_ref()],
        &program_id,
    )
    .0;

    program
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
            expires_at,
            goal_hash,
            allowed_actions_hash,
        })
        .send()
        .expect("initialize policy");

    let low_action_hash = [11u8; 32];
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

    program
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
        .expect("authorize low-risk action");

    program
        .request()
        .accounts(agent_policy::accounts::SettleAction {
            policy,
            authorization: low_authorization,
            settlement_authority: payer.pubkey(),
        })
        .args(agent_policy::instruction::SettleAction {
            success: true,
            provider_ref_hash: [12u8; 32],
        })
        .send()
        .expect("settle low-risk action");

    let high_action_hash = [21u8; 32];
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

    program
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
            approval_expires_at: now_unix() + 300,
        })
        .send()
        .expect("approve high-risk action");

    program
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
        .expect("authorize approved action");

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

    assert!(replay_result.is_err(), "replay nonce must fail");

    program
        .request()
        .accounts(agent_policy::accounts::SettleAction {
            policy,
            authorization: high_authorization,
            settlement_authority: payer.pubkey(),
        })
        .args(agent_policy::instruction::SettleAction {
            success: false,
            provider_ref_hash: [22u8; 32],
        })
        .send()
        .expect("settle failed provider action");

    let policy_state: agent_policy::AgentPolicy =
        program.account(policy).expect("fetch policy state");

    assert_eq!(policy_state.spent_amount, 900);
    assert_eq!(policy_state.reserved_amount, 0);
    assert_eq!(policy_state.nonce, 2);
    assert!(policy_state.is_active);
}
