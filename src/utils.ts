import type { Commitment, ConfirmOptions, Connection, PublicKey, Signer } from '@solana/web3.js';
import { getAccount, TokenAccountNotFoundError, TokenInvalidAccountOwnerError, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";


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