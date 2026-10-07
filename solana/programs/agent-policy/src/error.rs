use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Only the policy authority may perform this action")]
    UnauthorizedAuthority,
    #[msg("Only the delegated agent may authorize this action")]
    UnauthorizedAgent,
    #[msg("Only the configured settlement authority may settle this action")]
    UnauthorizedSettlementAuthority,
    #[msg("Policy is inactive or revoked")]
    PolicyInactive,
    #[msg("Policy has expired")]
    PolicyExpired,
    #[msg("Approval has expired")]
    ApprovalExpired,
    #[msg("Approval was already consumed")]
    ApprovalAlreadyUsed,
    #[msg("Approval does not match the exact action")]
    ApprovalMismatch,
    #[msg("Action amount exceeds the hard per-action limit")]
    MaxPerActionExceeded,
    #[msg("Action requires explicit authority approval")]
    ApprovalRequired,
    #[msg("Action nonce does not match the current policy nonce")]
    InvalidNonce,
    #[msg("Action would exceed the total policy budget")]
    TotalBudgetExceeded,
    #[msg("Arithmetic overflow while evaluating policy budget")]
    ArithmeticOverflow,
    #[msg("Authorization is not in a settleable state")]
    AuthorizationAlreadySettled,
    #[msg("Policy still has reserved budget")]
    ReservedBudgetOutstanding,
    #[msg("Policy account mismatch")]
    PolicyMismatch,
    #[msg("Policy limits are internally inconsistent")]
    InvalidPolicyConfiguration,
    #[msg("Policy expiry must be in the future")]
    InvalidPolicyExpiry,
}
