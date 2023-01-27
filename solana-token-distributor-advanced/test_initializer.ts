import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { writeFileSync, existsSync, mkdirSync} from "fs";

(async() => {
    console.log(
        `Creating test configuration... This may take a few minutes!`
    );

    //Create 'wallets.txt' with new 100 addresses for testing purposes!
    const arr: Array<string> = [];
    for (let index = 0; index < 100; index++) {
        const receiver = new Keypair();
        arr.push(receiver.publicKey.toBase58());
    }

    let buffer = "";
    arr.forEach((wallet) => {
        buffer += (wallet+`\n`); 
    });
    writeFileSync('wallets.txt', buffer);

    //Create an authority keypair
    const authority = new Keypair();
    if (!existsSync('./keypairs')){ mkdirSync('./keypairs'); }
    writeFileSync('./keypairs/creator.json', JSON.stringify(Array.from(authority.secretKey)));
    
    //Create token with freeze authority and decimal
    const connection = new Connection("https://api.devnet.solana.com");
    const mintKeypair = new Keypair();
    const signature = await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);
    const mint = await createMint(
        connection,
        authority,
        authority.publicKey,
        authority.publicKey,
        0,
        mintKeypair,
        undefined,
        TOKEN_PROGRAM_ID
    );
    writeFileSync('./keypairs/token.json', JSON.stringify(Array.from(mintKeypair.secretKey)));
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        authority,
        mint,
        authority.publicKey
    );

    await mintTo(
        connection,
        authority,
        mint,
        tokenAccount.address,
        authority.publicKey,
        999999,
        [],
        undefined,
        TOKEN_PROGRAM_ID
    );

    console.log(
        `\nTest configuration has been saved:
        \tAuthority Address: ${authority.publicKey.toBase58()} | Path: ./keypairs/creator.json
        Token Address: ${mint.toBase58()} | Path: ./keypairs/token.json
        Associated Token Account: ${tokenAccount.address.toBase58()} | Minted: 999999 tokens into the account
        100 Wallets has been generated | Path ./wallets.txt
        `
    );
})();