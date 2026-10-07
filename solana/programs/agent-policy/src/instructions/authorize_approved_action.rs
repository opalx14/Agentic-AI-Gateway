use anchor_lang::prelude::*;

use crate::{
    checks::{reserve_authorization, validate_base_authorization},
    constants::AUTHORIZATION_SEED,
    error::ErrorCode,
    instructions::authorize_action::ActionAuthorized,
    state::{ActionApproval, ActionAuthorization, AgentPolicy, AuthorizationStatus},
};

#[derive(Accounts)]
#[instruction(action_hash: [u8; 32], amount: u64, nonce: u64)]
pub struct AuthorizeApprovedAction<'info> {
    #[account(mut)]
    pub agent_signer: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, AgentPolicy>,
    #[account(mut)]
    pub approval: Account<'info, ActionApproval>,
    #[account(
        init,
        payer = agent_signer,
        space = 8 + ActionAuthorization::INIT_SPACE,
        seeds = [
            AUTHORIZATION_SEED,
            policy.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub authorization: Account<'info, ActionAuthorization>,
    pub system_program: Program<'info, System>,
}

pub fn handle_authorize_approved_action(
    ctx: Context<AuthorizeApprovedAction>,
    action_hash: [u8; 32],
    amount: u64,
    nonce: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;
    let approval = &mut ctx.accounts.approval;

    validate_base_authorization(policy, ctx.accounts.agent_signer.key(), amount, nonce, now)?;

    require_keys_eq!(approval.policy, policy.key(), ErrorCode::PolicyMismatch);
    require!(!approval.used, ErrorCode::ApprovalAlreadyUsed);
    require!(approval.expires_at > now, ErrorCode::ApprovalExpired);
    require!(
        approval.action_hash == action_hash && approval.amount == amount && approval.nonce == nonce,
        ErrorCode::ApprovalMismatch
    );

    approval.used = true;
    reserve_authorization(policy, amount)?;

    let authorization = &mut ctx.accounts.authorization;
    authorization.policy = policy.key();
    authorization.agent_signer = ctx.accounts.agent_signer.key();
    authorization.action_hash = action_hash;
    authorization.amount = amount;
    authorization.nonce = nonce;
    authorization.authorized_at = now;
    authorization.settled_at = 0;
    authorization.provider_ref_hash = [0; 32];
    authorization.status = AuthorizationStatus::Reserved;
    authorization.bump = ctx.bumps.authorization;

    emit!(ActionAuthorized {
        policy: policy.key(),
        authorization: authorization.key(),
        action_hash,
        amount,
        nonce,
        approved: true,
    });

    Ok(())
}
