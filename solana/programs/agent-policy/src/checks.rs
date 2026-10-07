use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::AgentPolicy};

pub fn validate_base_authorization(
    policy: &AgentPolicy,
    agent_signer: Pubkey,
    amount: u64,
    nonce: u64,
    now: i64,
) -> Result<()> {
    require!(policy.is_active, ErrorCode::PolicyInactive);
    require!(policy.expires_at > now, ErrorCode::PolicyExpired);
    require_keys_eq!(
        policy.agent_signer,
        agent_signer,
        ErrorCode::UnauthorizedAgent
    );
    require!(nonce == policy.nonce, ErrorCode::InvalidNonce);
    require!(
        amount <= policy.max_per_action,
        ErrorCode::MaxPerActionExceeded
    );

    let committed = policy
        .spent_amount
        .checked_add(policy.reserved_amount)
        .and_then(|value| value.checked_add(amount))
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    require!(
        committed <= policy.total_budget,
        ErrorCode::TotalBudgetExceeded
    );

    Ok(())
}

pub fn reserve_authorization(policy: &mut AgentPolicy, amount: u64) -> Result<()> {
    policy.reserved_amount = policy
        .reserved_amount
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    policy.nonce = policy
        .nonce
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok(())
}

pub fn settle_reserved_amount(policy: &mut AgentPolicy, amount: u64, success: bool) -> Result<()> {
    policy.reserved_amount = policy
        .reserved_amount
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    if success {
        policy.spent_amount = policy
            .spent_amount
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy(agent: Pubkey) -> AgentPolicy {
        AgentPolicy {
            authority: Pubkey::new_unique(),
            agent_signer: agent,
            settlement_authority: Pubkey::new_unique(),
            policy_id: [1; 32],
            policy_version: 1,
            total_budget: 10_000,
            spent_amount: 1_000,
            reserved_amount: 500,
            max_per_action: 5_000,
            auto_approve_max: 1_000,
            expires_at: 1_000,
            goal_hash: [2; 32],
            allowed_actions_hash: [3; 32],
            nonce: 7,
            is_active: true,
            bump: 255,
        }
    }

    #[test]
    fn accepts_exact_agent_nonce_and_available_budget() {
        let agent = Pubkey::new_unique();
        let policy = policy(agent);

        assert!(validate_base_authorization(&policy, agent, 2_000, 7, 900).is_ok());
    }

    #[test]
    fn rejects_wrong_agent() {
        let agent = Pubkey::new_unique();
        let policy = policy(agent);

        assert!(validate_base_authorization(&policy, Pubkey::new_unique(), 500, 7, 900,).is_err());
    }

    #[test]
    fn rejects_expired_policy() {
        let agent = Pubkey::new_unique();
        let policy = policy(agent);

        assert!(validate_base_authorization(&policy, agent, 500, 7, 1_000).is_err());
    }

    #[test]
    fn rejects_replayed_or_future_nonce() {
        let agent = Pubkey::new_unique();
        let policy = policy(agent);

        assert!(validate_base_authorization(&policy, agent, 500, 6, 900).is_err());
        assert!(validate_base_authorization(&policy, agent, 500, 8, 900).is_err());
    }

    #[test]
    fn rejects_hard_per_action_and_total_budget_limits() {
        let agent = Pubkey::new_unique();
        let mut policy = policy(agent);

        assert!(validate_base_authorization(&policy, agent, 5_001, 7, 900).is_err());

        policy.spent_amount = 9_000;
        policy.reserved_amount = 500;
        assert!(validate_base_authorization(&policy, agent, 501, 7, 900).is_err());
    }

    #[test]
    fn reservation_increments_nonce_and_failed_settlement_refunds_reservation() {
        let agent = Pubkey::new_unique();
        let mut policy = policy(agent);
        let starting_spent = policy.spent_amount;

        reserve_authorization(&mut policy, 750).expect("reserve");
        assert_eq!(policy.reserved_amount, 1_250);
        assert_eq!(policy.nonce, 8);

        settle_reserved_amount(&mut policy, 750, false).expect("settle failure");
        assert_eq!(policy.reserved_amount, 500);
        assert_eq!(policy.spent_amount, starting_spent);
    }

    #[test]
    fn successful_settlement_moves_reserved_amount_to_spent() {
        let agent = Pubkey::new_unique();
        let mut policy = policy(agent);

        reserve_authorization(&mut policy, 750).expect("reserve");
        settle_reserved_amount(&mut policy, 750, true).expect("settle success");

        assert_eq!(policy.reserved_amount, 500);
        assert_eq!(policy.spent_amount, 1_750);
    }
}
