use anchor_lang::prelude::*;

use crate::{
    constants::APPROVAL_SEED,
    error::ErrorCode,
    state::{ActionApproval, AgentPolicy},
};

#[derive(Accounts)]
#[instruction(action_hash: [u8; 32], amount: u64, nonce: u64)]
pub struct ApproveHighRiskAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub policy: Account<'info, AgentPolicy>,
    #[account(
        init,
        payer = authority,
        space = 8 + ActionApproval::INIT_SPACE,
        seeds = [
            APPROVAL_SEED,
            policy.key().as_ref(),
            action_hash.as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub approval: Account<'info, ActionApproval>,
    pub system_program: Program<'info, System>,
}

pub fn handle_approve_high_risk_action(
    ctx: Context<ApproveHighRiskAction>,
    action_hash: [u8; 32],
    amount: u64,
    nonce: u64,
    approval_expires_at: i64,
) -> Result<()> {
    let policy = &ctx.accounts.policy;
    let clock = Clock::get()?;

    require_keys_eq!(
        policy.authority,
        ctx.accounts.authority.key(),
        ErrorCode::UnauthorizedAuthority
    );
    require!(policy.is_active, ErrorCode::PolicyInactive);
    require!(
        policy.expires_at > clock.unix_timestamp,
        ErrorCode::PolicyExpired
    );
    require!(nonce == policy.nonce, ErrorCode::InvalidNonce);
    require!(
        amount <= policy.max_per_action,
        ErrorCode::MaxPerActionExceeded
    );
    require!(
        approval_expires_at > clock.unix_timestamp && approval_expires_at <= policy.expires_at,
        ErrorCode::InvalidPolicyExpiry
    );

    let approval = &mut ctx.accounts.approval;
    approval.policy = policy.key();
    approval.approved_by = ctx.accounts.authority.key();
    approval.action_hash = action_hash;
    approval.amount = amount;
    approval.nonce = nonce;
    approval.expires_at = approval_expires_at;
    approval.used = false;
    approval.bump = ctx.bumps.approval;

    Ok(())
}
