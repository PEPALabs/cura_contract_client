# Cura Contract Client

This is the official client library for interacting with the Cura contract on Solana blockchain using the Anchor framework. The package is designed to help developers easily communicate with the Cura program, manage token rewards, distribute tokens, and burn tokens.

## Features

- Create and manage Cura token mint accounts.
- Distribute token rewards to users.
- Burn tokens from an associated token account.
- Manage admin accounts within the Cura system.

## Installation

```shell
    npm install --save-dev @pepalabs-cura/cura_contract_client
```

## Usage

### Environment Variables

Environment variables like those in the .env.example file.

### Initialization

To initialize the Cura class, pass a valid Anchor provider instance.

```typescript
import { Cura } from "@pepalabs-cura/cura_contract_client";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";

// Example provider setup
super_admint_wallet = anchor.Wallet.local();
connection = new Connection('http://127.0.0.1:8899', {
            commitment: 'confirmed',
        });
provider = new anchor.AnchorProvider(connection, super_admint_wallet, {
    commitment: "confirmed",
    skipPreflight: true,
});
const cura = new Cura(provider);
```

## Example Methods

### Distribute Token Rewards

```typescript
    const memo = "Amount: 10, Award venue: [116.42,39.92], Award type: [comment]";
    //  10 Cura tokens (The lamports calculation has already been implemented in the contract. eg. 1 Cura = 1000000000 lamports)
    const tx = await cura.distributeTokenRewards(player.publicKey, 10, memo);
    // Both the player and the administrator must sign
    const txsig = await provider.sendAndConfirm(tx, [player, super_admint_wallet.payer]);
```

### Burn Token

```typescript
    //  10 Cura tokens (The lamports calculation has already been implemented in the contract. eg. 1 Cura = 1000000000 lamports)
    const tx = await cura.burnTokens(player.publicKey, 10);
    const txsig = await provider.sendAndConfirm(new Transaction().add(tx), [player]);
```

### Transfer Tokens

```typescript
    const tx = await cura.transferTokens(super_admint_wallet.payer, reviever.publicKey, 5000);
```

## Run Tests

```bash
    npm run test
```
