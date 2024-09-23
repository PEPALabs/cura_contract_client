import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction, TransactionInstruction} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createMemoInstruction} from "@solana/spl-memo";
import idl from "./IDL/cura.json";

const SUPER_ADMIN_PUBLIC_KEY: PublicKey = new PublicKey("6T9ajVYoL13jeNp9FCMoU9s4AEBaNFJpHvXptUz1MGag");

const CURA_PROGRAME_ID = new PublicKey(idl.address);
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const metadata = {
    name: "Cura Token",
    symbol: "CT",
    uri: "https://shdw-drive.genesysgo.net/FnZUwmLXWYwdH9KmAsEkc9kNM6qGo6Qb5sDdvJGdqbjy/cura-token.json",
}


export const [tokenMintPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    CURA_PROGRAME_ID
)
export const [adminManagementPDA] = PublicKey.findProgramAddressSync (
    [Buffer.from("admin_management")],
    CURA_PROGRAME_ID
)
export class Cura {
    public program: anchor.Program;
    constructor(provider: anchor.Provider) {
        if (!provider) {
            throw new Error("Provider is required to initialize Cura.");
        }
        this.program = new anchor.Program(
            idl as anchor.Idl,
            provider
        );
    }
    /**
     * Initialize or update the admin management. The signer must be the super admin.
     * @param new_admin new admin public key
     * @param cmd 0: add admin, 1: remove admin
     * @returns TransactionInstruction
     */
    async initOrUpdateAdminManagement (new_admin: PublicKey, cmd: number): Promise<TransactionInstruction> {
        const tx = this.program.methods
            .updateAdmin(cmd, new_admin)
            .accounts({
                adminManagement: adminManagementPDA,
            })
            .instruction();
        return tx;
    }


    /**
     * Create cura token mint account. The signer must be super admin or admin in admin management.
     * Only the administrator can call this function.
     * @returns TransactionInstruction
    */
    async createMinter (): Promise<TransactionInstruction> {
        const [metadataAddress] = PublicKey.findProgramAddressSync(
            [
              Buffer.from("metadata"),
              MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
              tokenMintPDA.toBuffer(),
            ],
            MPL_TOKEN_METADATA_PROGRAM_ID
          );
        const tx = this.program.methods
            .createMint(metadata.name, metadata.uri)
            .accounts({
                metadataAccount: metadataAddress,
            })
            .instruction();
        return tx;
    }

    /**
     * Create cura token account. The signer must be super admin or admin in admin management.
     *
     * @param receiver The receiver of the token.
     * @param amount The amount of token to distribute.
     * @param memo The details of this rewards distribute.
     * @returns The transaction to distribute token rewards.
    */
    async distributeTokenRewards (receiver: PublicKey, amount: number, memo: string): Promise<Transaction> {
        const ix1 = await this.program.methods
                .distributeRewards(new anchor.BN(amount))
                .accounts({
                    receiver: receiver,
                })
                .instruction();

        // add memo
        const ix2 = createMemoInstruction(memo);

        let tx = new Transaction().add(ix1).add(ix2);
        tx.feePayer = receiver;
        return tx;
    }
    /**
     * Burn cura tokens.
     *
     * @param player  The player to burn tokens， must be associate token account owner.
     * @param amount  Burn tokens amount.
     * @returns TransactionInstruction
     */
    async burnTokens (player: PublicKey, amount: number): Promise<TransactionInstruction> {
        const playerAssociateTokenAccount = getAssociatedTokenAddressSync (tokenMintPDA, player);

        const tx = await this.program.methods
            .tokenBurn(new anchor.BN(amount))
            .accounts({
                authority: player,
                tokenAccount: playerAssociateTokenAccount,
                mint: tokenMintPDA,
            })
            .instruction();
        return tx;
    }
}
