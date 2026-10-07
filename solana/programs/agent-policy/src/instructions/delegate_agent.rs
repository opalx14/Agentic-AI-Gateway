use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::AgentPolicy};

#[derive(Accounts)]
pub struct DelegateAgent<'info> {
    #[account(mut)]
    pub policy: Account<'info, AgentPolicy>,
    pub authority: Signer<'info>,
}

pub fn handle_delegate_agent(ctx: Context<DelegateAgent>, agent_signer: Pubkey) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    require_keys_eq!(
        policy.authority,
        ctx.accounts.authority.key(),
        ErrorCode::UnauthorizedAuthority
    );
    require!(policy.is_active, ErrorCode::PolicyInactive);

    policy.agent_signer = agent_signer;
    policy.policy_version = policy
        .policy_version
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok(())
}
