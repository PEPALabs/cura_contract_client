import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction, TransactionSignature} from "@solana/web3.js";
import {
    Account,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount,
    approve,
    createTransferCheckedWithTransferHookInstruction,
    burnChecked,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";
import { createMemoInstruction} from "@solana/spl-memo";
import { checkTokenAccountAndBalance } from "./utils"
import idl from "./IDL/cura.json";

const SUPER_ADMIN = new PublicKey("6T9ajVYoL13jeNp9FCMoU9s4AEBaNFJpHvXptUz1MGag");
const CURA_PROGRAME_ID = new PublicKey(idl.address);

const metadata = {
    name: "Cura Token",
    symbol: "CT",
    uri: "https://shdw-drive.genesysgo.net/FnZUwmLXWYwdH9KmAsEkc9kNM6qGo6Qb5sDdvJGdqbjy/cura-token.json",
}

const decimals = 9;
export const [tokenMintPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("token-2022-mint")],
    CURA_PROGRAME_ID
)
export const [adminManagementPDA] = PublicKey.findProgramAddressSync (
    [Buffer.from("admin_management")],
    CURA_PROGRAME_ID
)
export class Cura {
    public program: anchor.Program;
    public connection: anchor.web3.Connection;
    constructor(provider: anchor.Provider) {
        if (!provider) {
            throw new Error("Provider is required to initialize Cura.");
        }
        this.program = new anchor.Program(
            idl as anchor.Idl,
            provider
        );
        this.connection = provider.connection;
    }

    /**
     * Initialize or update the admin management. The signer must be the super admin.
     * @param new_admin new admin public key
     * @param cmd 0: add admin, 1: remove admin, 2: ResetCurrentDistributeAmount
     * @returns TransactionSignature
     */
    public async initOrUpdateAdminManagement (signer: Keypair, new_admin: PublicKey | null, cmd: number): Promise<TransactionSignature> {
        if (!signer.publicKey.equals(SUPER_ADMIN)) {
            throw new Error("Only the super admin can call this function.");
        }
        const txSig = this.program.methods
            .updateAdmin(cmd, new_admin)
            .accounts({})
            .rpc();
        return txSig;
    }


    /**
     * Create cura token mint account. The signer must be super admin or admin in admin management. It only needs to be called once.
     * Only the administrator can call this function.
     * @returns TransactionSignature
    */
    private async createMinter (signer: Keypair): Promise<TransactionSignature> {
        if (!signer.publicKey.equals(SUPER_ADMIN)) {
            throw new Error("Only the super admin can call this function.");
        }
        const txSig = await this.program.methods
        .createMint(metadata)
        .accounts({})
        .rpc();
        return txSig;
    }

    /**
     * Update the whitelist. The signer must be super admin.
     * @param cmd 0: add address to whitelist, 1: remove address from whitelist
     * @param address The address to add or remove from whitelist
     * @returns TransactionSignature
     */
    public async updateWhitelist(signer: Keypair, cmd: number, address: PublicKey): Promise<TransactionSignature> {
        if (!signer.publicKey.equals(SUPER_ADMIN)) {
            throw new Error("Only the super admin can call this function.");
        }
        const txSig = await this.program.methods
        .updateWhitelist(cmd, address)
        .accounts({})
        .rpc();
        return txSig;
    }

    /**
     * Update the blacklist. The signer must be super admin.
     * @param cmd 0: add address to blacklist, 1: remove address from blacklist
     * @param address The address to add or remove from blacklist
     * @returns TransactionSignature
     */
    public async updateBlacklist(signer: Keypair, cmd: number, address: PublicKey): Promise<TransactionSignature> {
        if (!signer.publicKey.equals(SUPER_ADMIN)) {
            throw new Error("Only the super admin can call this function.");
        }
        const txSig = await this.program.methods
        .updateBlacklist(cmd, address)
        .accounts({})
        .rpc();
        return txSig;
    }

    /**
     * Create cura token account. The signer must be super admin or admin in admin management.
     *
     * @param receiver The receiver of the token, this TransactionInstruction's feePayer.
     * @param amount The amount of token to distribute.
     * @param memo The details of this rewards distribute.
     * @returns The transaction to distribute token rewards.
    */
    async distributeTokenRewards (receiver: Keypair, amount: number, memo: string): Promise<Transaction> {
        const receiverAssociateTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            receiver,
            tokenMintPDA,
            receiver.publicKey,
            false,
            "confirmed",
            {skipPreflight: true},
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const ix1 = await this.program.methods
                .distributeRewards(new anchor.BN(amount))
                .accounts({
                    receiver: receiver.publicKey,
                    receiverTokenAccount: receiverAssociateTokenAccount.address,
                })
                .instruction();
        // add memo
        const ix2 = createMemoInstruction(memo);

        let tx = new Transaction().add(ix1).add(ix2);
        tx.feePayer = receiver.publicKey;
        return tx;
    }
    /**
     * Burn cura tokens.
     *
     * @param player  The player to burn tokens， must be associate token account owner.
     * @param amount  Burn tokens amount.
     * @returns       TransactionSignature
     */
    async burnTokens (player: Keypair, amount: number): Promise<TransactionSignature> {
        const playerAssociateTokenAccount = getAssociatedTokenAddressSync (tokenMintPDA, player.publicKey, false, TOKEN_2022_PROGRAM_ID);
        const final_amount = amount * 10 ** decimals;
        try {
            await checkTokenAccountAndBalance(
                this.connection,
                playerAssociateTokenAccount,
                final_amount,
                "confirmed",
            );
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            } else {
                console.error("Unknown error:", error);
            }
            throw error;
        }
        const txSig = await burnChecked(
            this.connection,
            player,
            playerAssociateTokenAccount,
            tokenMintPDA,
            player.publicKey,
            final_amount,
            decimals,
            [],
            {skipPreflight: true},
            TOKEN_2022_PROGRAM_ID,
          );
        return txSig;
    }

    /**
     * Authorize a delegate to transfer a certain amount of CURA tokens. Except for addresses on the blacklist.
     * @param owner          Owner of the token account
     * @param delegate       Account authorized to transfer tokens from the account
     * @param amount         Maximum number of tokens the delegate may transfer e.g. 10e9 = 10 CURA
     *
     * @returns The transactionSignature
     */
    async approveDelegate (owner: Keypair, delegate: PublicKey, amount: number): Promise<TransactionSignature> {
        const playerAssociateTokenAccount = getAssociatedTokenAddressSync (tokenMintPDA, owner.publicKey, false, TOKEN_2022_PROGRAM_ID);
        const final_amount = amount * 10 ** decimals;
        try {
            await checkTokenAccountAndBalance(this.connection, playerAssociateTokenAccount, final_amount);
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            } else {
                console.error("Unknown error:", error);
            }
            throw error;
        }
        const tx = await approve (
            this.connection,
            owner,
            playerAssociateTokenAccount,
            delegate,
            owner.publicKey,
            final_amount,
            [],
            {skipPreflight: true},
            TOKEN_2022_PROGRAM_ID,
        )
        return tx;
    }

    /**
     * Transfer a specified amount of CURA tokens to a designated account. Except for addresses on the blacklist.
     * @param owner        Owner of the source account,it could also be the delegate.
     * @param receiver     The account to receive the tokens.
     * @param amount       The amount of tokens to transfer.
     * @returns The transactionSignature
    */
    async transferTokens (owner: Keypair, receiver: PublicKey, amount: number): Promise<TransactionSignature> {
        const ownerAssociateTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            owner,
            tokenMintPDA,
            owner.publicKey,
            false,
            "confirmed",
            {skipPreflight: true},
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const final_amount = amount * 10 ** 9;
        try {
            await checkTokenAccountAndBalance(this.connection, ownerAssociateTokenAccount.address, final_amount);
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            } else {
                console.error("Unknown error:", error);
            }
            throw error;
        }
        const receiverAssociateTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            owner,
            tokenMintPDA,
            receiver,
            false,
            "confirmed",
            {skipPreflight: true},
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
            this.connection,
            ownerAssociateTokenAccount.address,
            tokenMintPDA,
            receiverAssociateTokenAccount.address,
            owner.publicKey,
            BigInt(final_amount),
            decimals,
            [],
            'confirmed',
            TOKEN_2022_PROGRAM_ID,
          );
        const tx = new Transaction().add(transferInstruction);
        tx.feePayer = owner.publicKey;
        const txSig =  await sendAndConfirmTransaction(
            this.connection,
            tx,
            [owner],
          );
        return txSig;
    }
}