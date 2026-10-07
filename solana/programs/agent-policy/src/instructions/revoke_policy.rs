use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::AgentPolicy};

#[derive(Accounts)]
pub struct RevokePolicy<'info> {
    #[account(mut)]
    pub policy: Account<'info, AgentPolicy>,
    pub authority: Signer<'info>,
}

pub fn handle_revoke_policy(ctx: Context<RevokePolicy>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    require_keys_eq!(
        policy.authority,
        ctx.accounts.authority.key(),
        ErrorCode::UnauthorizedAuthority
    );

    policy.is_active = false;
    policy.policy_version = policy
        .policy_version
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok(())
}
