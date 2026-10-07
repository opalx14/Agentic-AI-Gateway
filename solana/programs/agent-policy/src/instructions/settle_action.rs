use anchor_lang::prelude::*;

use crate::{
    checks::settle_reserved_amount,
    error::ErrorCode,
    state::{ActionAuthorization, AgentPolicy, AuthorizationStatus},
};

#[derive(Accounts)]
pub struct SettleAction<'info> {
    #[account(mut)]
    pub policy: Account<'info, AgentPolicy>,
    #[account(mut)]
    pub authorization: Account<'info, ActionAuthorization>,
    pub settlement_authority: Signer<'info>,
}

pub fn handle_settle_action(
    ctx: Context<SettleAction>,
    success: bool,
    provider_ref_hash: [u8; 32],
) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let authorization = &mut ctx.accounts.authorization;
    let now = Clock::get()?.unix_timestamp;

    require_keys_eq!(
        policy.settlement_authority,
        ctx.accounts.settlement_authority.key(),
        ErrorCode::UnauthorizedSettlementAuthority
    );
    require_keys_eq!(
        authorization.policy,
        policy.key(),
        ErrorCode::PolicyMismatch
    );
    require!(
        authorization.status == AuthorizationStatus::Reserved,
        ErrorCode::AuthorizationAlreadySettled
    );

    settle_reserved_amount(policy, authorization.amount, success)?;

    authorization.settled_at = now;
    authorization.provider_ref_hash = provider_ref_hash;
    authorization.status = if success {
        AuthorizationStatus::SettledSuccess
    } else {
        AuthorizationStatus::SettledFailed
    };

    emit!(ActionSettled {
        policy: policy.key(),
        authorization: authorization.key(),
        action_hash: authorization.action_hash,
        amount: authorization.amount,
        success,
        provider_ref_hash,
    });

    Ok(())
}

#[event]
pub struct ActionSettled {
    pub policy: Pubkey,
    pub authorization: Pubkey,
    pub action_hash: [u8; 32],
    pub amount: u64,
    pub success: bool,
    pub provider_ref_hash: [u8; 32],
}
