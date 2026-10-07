use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::AgentPolicy};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdatePolicyArgs {
    pub total_budget: u64,
    pub max_per_action: u64,
    pub auto_approve_max: u64,
    pub expires_at: i64,
    pub settlement_authority: Pubkey,
    pub goal_hash: [u8; 32],
    pub allowed_actions_hash: [u8; 32],
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    #[account(mut)]
    pub policy: Account<'info, AgentPolicy>,
    pub authority: Signer<'info>,
}

pub fn handle_update_policy(ctx: Context<UpdatePolicy>, args: UpdatePolicyArgs) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let clock = Clock::get()?;

    require_keys_eq!(
        policy.authority,
        ctx.accounts.authority.key(),
        ErrorCode::UnauthorizedAuthority
    );
    require!(policy.is_active, ErrorCode::PolicyInactive);
    require!(
        args.auto_approve_max <= args.max_per_action && args.max_per_action <= args.total_budget,
        ErrorCode::InvalidPolicyConfiguration
    );
    require!(
        args.total_budget
            >= policy
                .spent_amount
                .checked_add(policy.reserved_amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?,
        ErrorCode::TotalBudgetExceeded
    );
    require!(
        args.expires_at > clock.unix_timestamp,
        ErrorCode::InvalidPolicyExpiry
    );

    policy.total_budget = args.total_budget;
    policy.max_per_action = args.max_per_action;
    policy.auto_approve_max = args.auto_approve_max;
    policy.expires_at = args.expires_at;
    policy.settlement_authority = args.settlement_authority;
    policy.goal_hash = args.goal_hash;
    policy.allowed_actions_hash = args.allowed_actions_hash;
    policy.policy_version = policy
        .policy_version
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok(())
}
