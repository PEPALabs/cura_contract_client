import { Umi, generateSigner, PublicKey as UmiPk } from '@metaplex-foundation/umi';
import { toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import { createCollection } from '@metaplex-foundation/mpl-core';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { TransactionSignature, PublicKey } from '@solana/web3.js';


const SUPER_ADMIN = new PublicKey("6T9ajVYoL13jeNp9FCMoU9s4AEBaNFJpHvXptUz1MGag");

/**
 * Create a collection with Umi, must be called by the super admin
 * @param umi - Umi instance
 * @returns - Transaction signature and collection public key
 */
export async function createCollectionWithUmi(umi: Umi): Promise<[TransactionSignature, UmiPk]> {
    // check if the caller is the super admin
    let web3PublicKey = toWeb3JsPublicKey(umi.payer.publicKey);
    if (web3PublicKey.equals(SUPER_ADMIN)) {
        throw new Error("Only the super admin can create a collection");
    }

    const collectionSigner = generateSigner(umi);

    try {
        const tx = await createCollection(umi, {
            collection: collectionSigner,
            name: 'Cura Dog Collar',
            uri: 'https://gateway.irys.xyz/2VcbaNhJ3FWmQHnBLsNfDqw6NbEjMYw8u2g9acLq2bqS',
        }).sendAndConfirm(umi);

        return [base58.deserialize(tx.signature)[0], collectionSigner.publicKey];
    } catch (error) {
        console.error('Error creating collection:', error);
        throw error;
    }
}