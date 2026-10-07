use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::AgentPolicy};

#[derive(Accounts)]
pub struct ClosePolicy<'info> {
    #[account(mut, close = authority)]
    pub policy: Account<'info, AgentPolicy>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handle_close_policy(ctx: Context<ClosePolicy>) -> Result<()> {
    let policy = &ctx.accounts.policy;

    require_keys_eq!(
        policy.authority,
        ctx.accounts.authority.key(),
        ErrorCode::UnauthorizedAuthority
    );
    require!(
        policy.reserved_amount == 0,
        ErrorCode::ReservedBudgetOutstanding
    );

    Ok(())
}
