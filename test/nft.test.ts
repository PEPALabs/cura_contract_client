import * as anchor from "@coral-xyz/anchor";
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { Umi, PublicKey as UmiPk } from '@metaplex-foundation/umi'
import { mplCore } from '@metaplex-foundation/mpl-core'
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters'
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import { createNftToCollectionWithImage, createCollectionWithUmi } from '../src/nft';
import { generateKey } from "crypto";



describe('nft test', () => {
    let umi: Umi
    let connection: Connection;
    let provider: anchor.AnchorProvider
    // let playerWallet: anchor.Wallet = new anchor.Wallet(Keypair.generate());
    let playerWallet: anchor.Wallet;
    let collectionPk: UmiPk
    beforeAll(async () => {
        require('dotenv').config();
        console.log(process.env.ANCHOR_WALLET)
        playerWallet = anchor.Wallet.local()


        // connection = new Connection('https://devnet.helius-rpc.com/?api-key=32e59a48-db47-494f-a6b6-61d9cbf64a25', {
        connection = new Connection('https://api.devnet.solana.com', {
        // connection = new Connection('http://localhost:8899', {
            commitment: 'confirmed',
        });

        umi = createUmi(connection)
            .use(mplCore())
            .use(
                irysUploader({
                    // mainnet address: "https://node1.irys.xyz"
                    // devnet address: "https://devnet.irys.xyz"
                    address: 'https://devnet.irys.xyz',
                })
            )
        // player
        // await connection.confirmTransaction(
        //     await connection.requestAirdrop(playerWallet.publicKey, LAMPORTS_PER_SOL),
        //     'confirmed',
        // );
        // console.log(`player wallet ${playerWallet.publicKey.toBase58()} balance: ${await connection.getBalance(playerWallet.publicKey) / LAMPORTS_PER_SOL} SOL`)

        provider = new anchor.AnchorProvider(connection, playerWallet, {
            commitment: "confirmed",
            skipPreflight: true,
        });
        anchor.setProvider(provider);

        umi.use(walletAdapterIdentity(playerWallet))
    })

    it('create collection', async () => {
        const [tx, collectionUmiPk] = await createCollectionWithUmi(umi)
        console.log('\nCollection Created')
        console.log('View Transaction on Solana Explorer')
        console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`)
        collectionPk = collectionUmiPk
    })

    it('create nft', async () => {
        // get image from local
        // const imageFile = fs.readFileSync('/Users/star/Pictures/cura.png')
        for (let i = 0; i < 3; i++) {
            const tx = await createNftToCollectionWithImage(umi, collectionPk, `${i}`)
            console.log('\nNFT Created')
            console.log('View Transaction on Solana Explorer')
            console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`)
        }
    })
})