import { Commitment, Connection, PublicKey,  TransactionInstruction} from '@solana/web3.js';
import {
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";


/**
 * Check whether the Token account exists and the Token balance is sufficient
 * @param connection - Solana cluster connection
 * @param tokenAccountAddress - Associated Token Account
 * @param requiredAmount - Required Token amount
 * @returns - true if the Token account exists and the Token balance is sufficient, otherwise false
 * @throws - Error if the Token account does not exist or the Token balance is insufficient
 */
export async function checkTokenAccountAndBalance(
    connection: Connection,
    tokenAccountAddress: PublicKey,
    requiredAmount: number | bigint,
    commitment?: Commitment,
    programId = TOKEN_2022_PROGRAM_ID,
  ): Promise<boolean> {
    try {
      const account = await getAccount(connection, tokenAccountAddress, commitment, programId);

      const tokenBalance = await connection.getTokenAccountBalance(tokenAccountAddress);

      if (parseInt(tokenBalance.value.amount) < requiredAmount) {
        throw new Error("Insufficient token balance");
      }
      return true;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
        throw new Error("Associated token account not found or owner error");
      } else {
        throw error;
    }
  }
}

/*
 * Retrieve the associated token account, or create it if it doesn't exist
 *
 * @param connection               Connection to use
 * @param mint                     Mint associated with the account to set or verify
 * @param owner                    Owner of the account to set or verify
 * @param allowOwnerOffCurve       Allow the owner account to be a PDA (Program Derived Address)
 * @param commitment               Desired level of commitment for querying the state
 * @param confirmOptions           Options for confirming the transaction
 * @param programId                SPL Token program account
 * @param associatedTokenProgramId SPL Associated Token program account
 *
 * @return [Address of the new associated token account, null | TransactionInstruction]
 */
export async function getOrCreateAssociatedTokenAccountInstruction(
    connection: Connection,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve = false,
    commitment?: Commitment,
    programId = TOKEN_2022_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<[PublicKey, TransactionInstruction | null]> {
    const associatedToken = getAssociatedTokenAddressSync(
      mint,
      owner,
      allowOwnerOffCurve,
      programId,
      associatedTokenProgramId
    );
    try {
        // Try to fetch the account; if it exists, return its address with no instruction needed
        await getAccount(connection, associatedToken, commitment, programId);
        return [associatedToken, null];
    } catch (error) {
        // Handle specific errors that indicate the account doesn't exist or is invalid
        if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
            // Create the associated token account instruction if the account doesn't exist
            const instruction = createAssociatedTokenAccountInstruction(owner, associatedToken, owner, mint, programId, associatedTokenProgramId);
            return [associatedToken, instruction];
        } else {
            // Re-throw any other errors
            throw error;
        }
    }
}