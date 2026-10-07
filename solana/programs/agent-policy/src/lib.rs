pub mod checks;
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

declare_id!("5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH");

#[program]
pub mod agent_policy {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn initialize_policy(
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
        instructions::initialize_policy::handle_initialize_policy(
            ctx,
            policy_id,
            agent_signer,
            settlement_authority,
            total_budget,
            max_per_action,
            auto_approve_max,
            expires_at,
            goal_hash,
            allowed_actions_hash,
        )
    }

    pub fn update_policy(ctx: Context<UpdatePolicy>, args: UpdatePolicyArgs) -> Result<()> {
        instructions::update_policy::handle_update_policy(ctx, args)
    }

    pub fn delegate_agent(ctx: Context<DelegateAgent>, agent_signer: Pubkey) -> Result<()> {
        instructions::delegate_agent::handle_delegate_agent(ctx, agent_signer)
    }

    pub fn revoke_policy(ctx: Context<RevokePolicy>) -> Result<()> {
        instructions::revoke_policy::handle_revoke_policy(ctx)
    }

    pub fn approve_high_risk_action(
        ctx: Context<ApproveHighRiskAction>,
        action_hash: [u8; 32],
        amount: u64,
        nonce: u64,
        approval_expires_at: i64,
    ) -> Result<()> {
        instructions::approve_high_risk_action::handle_approve_high_risk_action(
            ctx,
            action_hash,
            amount,
            nonce,
            approval_expires_at,
        )
    }

    pub fn authorize_action(
        ctx: Context<AuthorizeAction>,
        action_hash: [u8; 32],
        amount: u64,
        nonce: u64,
    ) -> Result<()> {
        instructions::authorize_action::handle_authorize_action(ctx, action_hash, amount, nonce)
    }

    pub fn authorize_approved_action(
        ctx: Context<AuthorizeApprovedAction>,
        action_hash: [u8; 32],
        amount: u64,
        nonce: u64,
    ) -> Result<()> {
        instructions::authorize_approved_action::handle_authorize_approved_action(
            ctx,
            action_hash,
            amount,
            nonce,
        )
    }

    pub fn settle_action(
        ctx: Context<SettleAction>,
        success: bool,
        provider_ref_hash: [u8; 32],
    ) -> Result<()> {
        instructions::settle_action::handle_settle_action(ctx, success, provider_ref_hash)
    }

    pub fn close_policy(ctx: Context<ClosePolicy>) -> Result<()> {
        instructions::close_policy::handle_close_policy(ctx)
    }
}
