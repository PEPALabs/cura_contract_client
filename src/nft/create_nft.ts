import {
    Umi,
    createGenericFile,
    generateSigner,
    PublicKey as UmiPk,
} from "@metaplex-foundation/umi"
import { create, fetchCollection } from '@metaplex-foundation/mpl-core'
import { base58 } from '@metaplex-foundation/umi/serializers'
import { TransactionSignature, SendTransactionError, Connection } from "@solana/web3.js"

/**
 * Create a NFT with Umi
 * @param umi - Umi instance
 * @param collectionPk - Collection public key
 * @param nftId - NFT ID, must be unique
 * @returns - Transaction signature
 */
export async function createNftToCollectionWithImage(umi: Umi, collectionPk: UmiPk, nftId: string): Promise<TransactionSignature> {
    // upload image to IRYS
    // const umiImageFile = createGenericFile(image, 'cura_nft.png', {
    //     tags: [
    //         { name: 'Content-Type', value: 'image/png' }
    //     ]
    // })
    // const imageUri = await umi.uploader.upload([umiImageFile])
    //     .catch((error) => {
    //         console.error(error)
    //         throw new Error(error)
    //     })
    // console.log(imageUri)

    // // create metadata
    // const metadata = {
    //     name: 'Cura NFT',
    //     description: 'Cura NFT',
    //     image: imageUri[0],
    //     // TODO: add attributes
    // }
    // upload json
    // const metadataUri = await umi.uploader.uploadJson(metadata)
    //     .catch((error) => {
    //         console.error(error)
    //         throw new Error(error)
    //     })
    // console.log(metadataUri)

    // fetch collection
    const collection = await fetchCollection(umi, collectionPk)
    // create nft
    const assetSinger = generateSigner(umi)
    try {
        const tx = await create(umi, {
            asset: assetSinger,
            name: `${collection.name} #${nftId}`,
            uri: 'https://gateway.irys.xyz/2VcbaNhJ3FWmQHnBLsNfDqw6NbEjMYw8u2g9acLq2bqS',
            collection: collection,
            plugins:[
                {
                    type: 'ImmutableMetadata'
                }
            ]
        }).sendAndConfirm(umi, {
            send: {
                skipPreflight: true
            }
        });
        return base58.deserialize(tx.signature)[0];
    } catch (error) {
        throw error;
    }
}