import * as anchor from "@coral-xyz/anchor";
import { strict as assert } from 'node:assert';
import { adminManagementPDA, Cura, tokenMintPDA } from "../src/cura";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { program } from "@coral-xyz/anchor/dist/cjs/native/system";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";

describe("cura test", () => {
    let cura: Cura;
    let provider: anchor.AnchorProvider;
    let super_admint_wallet: NodeWallet;
    let connection: Connection;
    let player: Keypair = Keypair.generate();

    beforeAll(async () => {
        require('dotenv').config();
        // Configure the client to use the local cluster.
        super_admint_wallet = anchor.Wallet.local();
        // connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"));
        connection = new Connection('http://127.0.0.1:8899', {
            commitment: 'confirmed',
        });
        provider = new anchor.AnchorProvider(connection, super_admint_wallet, {
            commitment: "confirmed",
            skipPreflight: true,
        });
        anchor.setProvider(provider);

        // Initialize the program.
        cura = new Cura(provider);

        console.log("program method: ", cura.program.methods);

        // Airdrop some SOL to the player
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(player.publicKey, LAMPORTS_PER_SOL),
            'confirmed',
        );
        console.log(`player wallet ${player.publicKey.toBase58()} balance: ${await provider.connection.getBalance(player.publicKey) / LAMPORTS_PER_SOL} SOL`)
    });


    it("init or update admin management!", async () => {
        const newAdmin = new Keypair();
        const ix = await cura.initOrUpdateAdminManagement(newAdmin.publicKey, 0);
        const tx = await provider.sendAndConfirm(new Transaction().add(ix), [super_admint_wallet.payer]);
        // const admin_management = await cura.program.account.AdminManagement.fetch(adminManagementPDA);
        // assert.equal(admin_management.admins[0].toBase58(), newAdmin.publicKey.toBase58());
        console.log("init or update admin management signature: ", tx);
    })
    it("create minter!", async () => {
        const ix = await cura.createMinter();
        const tx = await provider.sendAndConfirm(new Transaction().add(ix), [super_admint_wallet.payer]);

        console.log("Your transaction signature", tx);
        console.log("Success!");
        console.log(`   Mint Address: ${tokenMintPDA}`);
        console.log(`   Transaction Signature: ${tx}`);
    });
    it ("distribute rewards!", async () => {
        const memo = "Amount: 10, Award venue: [116.42,39.92], Award type: [comment]";
        const tx = await cura.distributeTokenRewards(player.publicKey, 10, memo);
        // Both the player and the administrator must sign
        const txsig = await provider.sendAndConfirm(tx, [player, super_admint_wallet.payer]);
        console.log("distribute rewards transaction signature", txsig);
        const playerTokenAccount = await provider.connection.getTokenAccountsByOwner(player.publicKey, {mint: tokenMintPDA});
        const tokenBalance = await provider.connection.getTokenAccountBalance(playerTokenAccount.value[0].pubkey);
        assert.equal(tokenBalance.value.amount, 10e9.toString());
    });

    it("burn tokens!" , async () => {
        const tx = await cura.burnTokens(player.publicKey, 10);
        const txsig = await provider.sendAndConfirm(new Transaction().add(tx), [player]);
        const playerTokenAccount = await provider.connection.getTokenAccountsByOwner(player.publicKey, {mint: tokenMintPDA});
        const tokenBalance = await provider.connection.getTokenAccountBalance(playerTokenAccount.value[0].pubkey);
        assert.equal(tokenBalance.value.amount, "0");
    });
});
