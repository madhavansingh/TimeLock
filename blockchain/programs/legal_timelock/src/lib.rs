use anchor_lang::prelude::*;

declare_id!("EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w");

#[program]
pub mod legal_timelock {
    use super::*;

    pub fn initialize_document(
        ctx: Context<InitializeDocument>,
        document_id_hash: [u8; 32],
        content_hash: [u8; 32],
        required_signers: u8,
    ) -> Result<()> {
        let document = &mut ctx.accounts.document;
        document.document_id_hash = document_id_hash;
        document.content_hash = content_hash;
        document.timestamp = Clock::get()?.unix_timestamp;
        document.status = 1; // Confirmed / Active
        document.signer_count = 0;
        document.required_signers = required_signers;
        document.authority = ctx.accounts.payer.key();
        document.bump = ctx.bumps.document;
        Ok(())
    }

    pub fn record_signature(
        ctx: Context<RecordSignature>,
        signer_role: u8,
        off_chain_cert_ref: [u8; 32],
    ) -> Result<()> {
        let document = &mut ctx.accounts.document;
        let signature_record = &mut ctx.accounts.signature_record;

        signature_record.document_record = document.key();
        signature_record.signer_role = signer_role;
        signature_record.signer_pubkey = ctx.accounts.signer.key();
        signature_record.signed_at = Clock::get()?.unix_timestamp;
        signature_record.off_chain_cert_ref = off_chain_cert_ref;

        // Increment signer count on the document
        document.signer_count = document.signer_count.saturating_add(1);

        // If threshold of signers met, update status to Fully Signed (status code 3)
        if document.signer_count >= document.required_signers && document.status < 3 {
            document.status = 3; // FULLY_EXECUTED
        }

        Ok(())
    }

    pub fn update_status(
        ctx: Context<UpdateStatus>,
        status: u8,
    ) -> Result<()> {
        let document = &mut ctx.accounts.document;
        // Verify payer is the authority of the document
        require_keys_eq!(ctx.accounts.payer.key(), document.authority, ErrorCode::Unauthorized);
        document.status = status;
        Ok(())
    }

    pub fn initiate_transfer(
        ctx: Context<InitiateTransfer>,
        transfer_id: [u8; 32],
        previous_owner_hash: [u8; 32],
        new_owner_hash: [u8; 32],
    ) -> Result<()> {
        let transfer = &mut ctx.accounts.ownership_transfer_record;
        transfer.document_record = ctx.accounts.document.key();
        transfer.transfer_id = transfer_id;
        transfer.previous_owner_hash = previous_owner_hash;
        transfer.new_owner_hash = new_owner_hash;
        transfer.initiated_at = Clock::get()?.unix_timestamp;
        transfer.finalized_at = 0;
        transfer.status = 0; // PENDING
        transfer.owner_approved = false;
        transfer.buyer_approved = false;
        transfer.notary_approved = false;
        transfer.government_approved = false;
        Ok(())
    }

    pub fn approve_transfer(
        ctx: Context<ApproveTransfer>,
        role_byte: u8,
        _approved: bool,
    ) -> Result<()> {
        let transfer = &mut ctx.accounts.ownership_transfer_record;
        
        match role_byte {
            2 => transfer.owner_approved = true,
            3 => transfer.buyer_approved = true,
            1 => transfer.notary_approved = true,
            4 => transfer.government_approved = true,
            _ => return Err(ErrorCode::InvalidRole.into()),
        }

        // If all base approvals gathered, mark transfer as approved (status code 1)
        if transfer.owner_approved && transfer.buyer_approved && transfer.notary_approved {
            transfer.status = 1; // APPROVED
        }

        Ok(())
    }

    pub fn finalize_transfer(
        ctx: Context<FinalizeTransfer>,
    ) -> Result<()> {
        let document = &mut ctx.accounts.document;
        let transfer = &mut ctx.accounts.ownership_transfer_record;

        // Ensure all required signatures have approved
        require!(transfer.owner_approved, ErrorCode::MissingOwnerSignature);
        require!(transfer.buyer_approved, ErrorCode::MissingBuyerSignature);
        require!(transfer.notary_approved, ErrorCode::MissingNotarySignature);

        // Signer of this context represents Government approval
        transfer.government_approved = true;
        transfer.status = 2; // FINALIZED
        transfer.finalized_at = Clock::get()?.unix_timestamp;

        // Update the master document status to Fully Executed (code 3)
        document.status = 3;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(document_id_hash: [u8; 32])]
pub struct InitializeDocument<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<DocumentRecord>(),
        seeds = [b"document", document_id_hash.as_ref()],
        bump
    )]
    pub document: Account<'info, DocumentRecord>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(signer_role: u8)]
pub struct RecordSignature<'info> {
    #[account(mut)]
    pub document: Account<'info, DocumentRecord>,
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<SignatureRecord>(),
        seeds = [b"signature", document.key().as_ref(), &[signer_role]],
        bump
    )]
    pub signature_record: Account<'info, SignatureRecord>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStatus<'info> {
    #[account(mut)]
    pub document: Account<'info, DocumentRecord>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(transfer_id: [u8; 32])]
pub struct InitiateTransfer<'info> {
    pub document: Account<'info, DocumentRecord>,
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<OwnershipTransferRecord>(),
        seeds = [b"transfer", document.key().as_ref(), transfer_id.as_ref()],
        bump
    )]
    pub ownership_transfer_record: Account<'info, OwnershipTransferRecord>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveTransfer<'info> {
    #[account(mut)]
    pub ownership_transfer_record: Account<'info, OwnershipTransferRecord>,
    pub signer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeTransfer<'info> {
    #[account(mut)]
    pub document: Account<'info, DocumentRecord>,
    #[account(mut)]
    pub ownership_transfer_record: Account<'info, OwnershipTransferRecord>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

#[account]
pub struct DocumentRecord {
    pub document_id_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub timestamp: i64,
    pub status: u8,
    pub signer_count: u8,
    pub required_signers: u8,
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
pub struct SignatureRecord {
    pub document_record: Pubkey,
    pub signer_role: u8,
    pub signer_pubkey: Pubkey,
    pub signed_at: i64,
    pub off_chain_cert_ref: [u8; 32],
}

#[account]
pub struct OwnershipTransferRecord {
    pub document_record: Pubkey,
    pub transfer_id: [u8; 32],
    pub previous_owner_hash: [u8; 32],
    pub new_owner_hash: [u8; 32],
    pub initiated_at: i64,
    pub finalized_at: i64,
    pub status: u8,
    pub owner_approved: bool,
    pub buyer_approved: bool,
    pub notary_approved: bool,
    pub government_approved: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to update this document.")]
    Unauthorized,
    #[msg("Invalid authority role mapping.")]
    InvalidRole,
    #[msg("Owner approval signature is required.")]
    MissingOwnerSignature,
    #[msg("Buyer approval signature is required.")]
    MissingBuyerSignature,
    #[msg("Notary approval signature is required.")]
    MissingNotarySignature,
}
