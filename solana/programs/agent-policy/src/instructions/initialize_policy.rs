use anchor_lang::prelude::*;

use crate::{constants::POLICY_SEED, error::ErrorCode, state::AgentPolicy};

#[derive(Accounts)]
#[instruction(policy_id: [u8; 32])]
pub struct InitializePolicy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + AgentPolicy::INIT_SPACE,
        seeds = [POLICY_SEED, authority.key().as_ref(), policy_id.as_ref()],
        bump
    )]
    pub policy: Account<'info, AgentPolicy>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_initialize_policy(
    ctx: Context<InitializePolicy>,
    policy_id: [u8; 32],
    agent_signer: Pubkey,
    settlement_authority: Pubkey,
    total_budget: u64,
    max_per_action: u64,
    auto_approve_max: u64,
    expires_at: i64,
    goal_hash: [u8; 32],
    allowed_actions_hash: [u8; 32],
) -> Result<()> {
    let clock = Clock::get()?;

    require!(
        auto_approve_max <= max_per_action && max_per_action <= total_budget,
        ErrorCode::InvalidPolicyConfiguration
    );
    require!(
        expires_at > clock.unix_timestamp,
        ErrorCode::InvalidPolicyExpiry
    );

    let policy = &mut ctx.accounts.policy;
    policy.authority = ctx.accounts.authority.key();
    policy.agent_signer = agent_signer;
    policy.settlement_authority = settlement_authority;
    policy.policy_id = policy_id;
    policy.policy_version = 1;
    policy.total_budget = total_budget;
    policy.spent_amount = 0;
    policy.reserved_amount = 0;
    policy.max_per_action = max_per_action;
    policy.auto_approve_max = auto_approve_max;
    policy.expires_at = expires_at;
    policy.goal_hash = goal_hash;
    policy.allowed_actions_hash = allowed_actions_hash;
    policy.nonce = 0;
    policy.is_active = true;
    policy.bump = ctx.bumps.policy;

    Ok(())
}
