import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction, TransactionInstruction} from "@solana/web3.js";
import {
    getAccount,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount,
    approve,
    transfer } from "@solana/spl-token";
import { createMemoInstruction} from "@solana/spl-memo";
import { checkTokenAccountAndBalance } from "./utils"
import idl from "./IDL/cura.json";
import { publicDecrypt } from "crypto";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";

const CURA_PROGRAME_ID = new PublicKey(idl.address);
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const metadata = {
    name: "Cura Token",
    symbol: "CT",
    uri: "https://shdw-drive.genesysgo.net/FnZUwmLXWYwdH9KmAsEkc9kNM6qGo6Qb5sDdvJGdqbjy/cura-token.json",
}


const whitelist = new Set<String>(
    [
        "6T9ajVYoL13jeNp9FCMoU9s4AEBaNFJpHvXptUz1MGag",
        "6WbwySfYBuzcApKKqWgwqVYGCwwPkaFRJZTHLUWziALa"
    ]
);
const blacklist = new Set<String>();

// internal： close beta test， public： open beta test
const MODE: "internal" | "public" = "internal";

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
    private checkAccess(publicKey: String) {
        if (MODE === "internal" && !whitelist.has(publicKey)) {
          throw new Error("Access denied: user not in whitelist.");
        } else if (MODE === "public" && blacklist.has(publicKey)) {
          throw new Error("Access denied: user is in the blacklist.");
        }
    }
    /**
     * Initialize or update the admin management. The signer must be the super admin.
     * @param new_admin new admin public key
     * @param cmd 0: add admin, 1: remove admin
     * @returns TransactionInstruction
     */
    private async initOrUpdateAdminManagement (new_admin: PublicKey, cmd: number): Promise<TransactionInstruction> {
        const tx = this.program.methods
            .updateAdmin(cmd, new_admin)
            .accounts({
                adminManagement: adminManagementPDA,
            })
            .instruction();
        return tx;
    }


    /**
     * Create cura token mint account. The signer must be super admin or admin in admin management. It only needs to be called once.
     * Only the administrator can call this function.
     * @returns TransactionInstruction
    */
    private async createMinter (): Promise<TransactionInstruction> {
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
        this.checkAccess(receiver.toString());
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
        this.checkAccess(player.toString());
        const playerAssociateTokenAccount = getAssociatedTokenAddressSync (tokenMintPDA, player);
        try {
            const isValid = await checkTokenAccountAndBalance(this.connection, playerAssociateTokenAccount, amount);
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            } else {
                console.error("Unknown error:", error);
            }
        }
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

    /**
     * Authorize a delegate to transfer a certain amount of CURA tokens. Except for addresses on the blacklist.
     * @param owner          Owner of the token account
     * @param delegate       Account authorized to transfer tokens from the account
     * @param amount         Maximum number of tokens the delegate may transfer e.g. 10e9 = 10 CURA
     *
     * @returns The transactionSignature
     */
    async approveDelegate (owner: Keypair, delegate: PublicKey, amount: number): Promise<String> {
        this.checkAccess(owner.publicKey.toString());
        // check if the delegate is on the blacklist
        if (blacklist.has(delegate.toString())) {
            throw new Error("Delegate is on the blacklist");
        }
        const playerAssociateTokenAccount = getAssociatedTokenAddressSync (tokenMintPDA, owner.publicKey);
        const final_amount = amount * 10 ** 9;
        try {
            const isValid = await checkTokenAccountAndBalance(this.connection, playerAssociateTokenAccount, final_amount);
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            } else {
                console.error("Unknown error:", error);
            }
        }
        const tx = await approve (
            this.connection,
            owner,
            playerAssociateTokenAccount,
            delegate,
            owner.publicKey,
            final_amount
        )
        return tx;
    }

    /**
     * Transfer a specified amount of CURA tokens to a designated account. Except for addresses on the blacklist.
     * @param owner        Owner of the source account,it could also be the delegate.
     * @param receiver     The account to receive the tokens.
     * @param amount       The amount of tokens to transfer.
     *
    */
    async transferTokens (owner: Keypair, receiver: PublicKey, amount: number): Promise<String> {
        this.checkAccess(owner.publicKey.toString());
        // check if the receiver is on the blacklist
        if (blacklist.has(receiver.toString())) {
            throw new Error("receiver is on the blacklist");
        }
        const connection = this.program.provider.connection;
        const ownerAssociateTokenAccount = await getAssociatedTokenAddressSync(tokenMintPDA, owner.publicKey);
        const final_amount = amount * 10 ** 9;
        try {
            const isValid = await checkTokenAccountAndBalance(this.connection, ownerAssociateTokenAccount, final_amount);
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            } else {
                console.error("Unknown error:", error);
            }
        }
        const receiverAssociateTokenAccount = await getOrCreateAssociatedTokenAccount(connection, owner, tokenMintPDA, receiver);
        const tx = await transfer(
            connection,
            owner,
            ownerAssociateTokenAccount,
            receiverAssociateTokenAccount.address,
            owner,
            final_amount
        )
        return tx;
    }
}