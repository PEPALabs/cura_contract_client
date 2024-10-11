import { Umi, generateSigner, PublicKey as UmiPk } from '@metaplex-foundation/umi';
import { createCollection } from '@metaplex-foundation/mpl-core';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { TransactionSignature } from '@solana/web3.js';


export async function createCollectionWithUmi(umi: Umi): Promise<[TransactionSignature, UmiPk]> {
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