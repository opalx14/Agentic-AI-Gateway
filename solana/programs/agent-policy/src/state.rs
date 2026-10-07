use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AgentPolicy {
    pub authority: Pubkey,
    pub agent_signer: Pubkey,
    pub settlement_authority: Pubkey,
    pub policy_id: [u8; 32],
    pub policy_version: u64,
    pub total_budget: u64,
    pub spent_amount: u64,
    pub reserved_amount: u64,
    pub max_per_action: u64,
    pub auto_approve_max: u64,
    pub expires_at: i64,
    pub goal_hash: [u8; 32],
    pub allowed_actions_hash: [u8; 32],
    pub nonce: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ActionApproval {
    pub policy: Pubkey,
    pub approved_by: Pubkey,
    pub action_hash: [u8; 32],
    pub amount: u64,
    pub nonce: u64,
    pub expires_at: i64,
    pub used: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum AuthorizationStatus {
    Reserved,
    SettledSuccess,
    SettledFailed,
}

#[account]
#[derive(InitSpace)]
pub struct ActionAuthorization {
    pub policy: Pubkey,
    pub agent_signer: Pubkey,
    pub action_hash: [u8; 32],
    pub amount: u64,
    pub nonce: u64,
    pub authorized_at: i64,
    pub settled_at: i64,
    pub provider_ref_hash: [u8; 32],
    pub status: AuthorizationStatus,
    pub bump: u8,
}
