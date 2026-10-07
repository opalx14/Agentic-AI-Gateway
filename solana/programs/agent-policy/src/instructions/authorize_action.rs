use anchor_lang::prelude::*;

use crate::{
    checks::{reserve_authorization, validate_base_authorization},
    constants::AUTHORIZATION_SEED,
    error::ErrorCode,
    state::{ActionAuthorization, AgentPolicy, AuthorizationStatus},
};

#[derive(Accounts)]
#[instruction(action_hash: [u8; 32], amount: u64, nonce: u64)]
pub struct AuthorizeAction<'info> {
    #[account(mut)]
    pub agent_signer: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, AgentPolicy>,
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

pub fn handle_authorize_action(
    ctx: Context<AuthorizeAction>,
    action_hash: [u8; 32],
    amount: u64,
    nonce: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;

    validate_base_authorization(policy, ctx.accounts.agent_signer.key(), amount, nonce, now)?;
    require!(
        amount <= policy.auto_approve_max,
        ErrorCode::ApprovalRequired
    );

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
        approved: false,
    });

    Ok(())
}

#[event]
pub struct ActionAuthorized {
    pub policy: Pubkey,
    pub authorization: Pubkey,
    pub action_hash: [u8; 32],
    pub amount: u64,
    pub nonce: u64,
    pub approved: bool,
}
