import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createTransferInstruction, createFreezeAccountInstruction, createThawAccountInstruction, getAccount } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { TRANSACTION_RESULTS, CONNECTION, TOKEN, SENDER_KEYPAIR, MAX_TRANSFER_AND_FREEZE_ADDRESS_LIMIT } from "./constants";
import { TransactionResult } from "./types";

export function readWalletsFile() {
    if (!existsSync('wallets.txt')) {
        console.log(`\n\twallets.txt is not found!`);
        process.exit(-1);
    }
    const buffer = readFileSync('wallets.txt', 'utf8');
    const wallets = buffer.toString().split('\n').map(walletString => { return walletString.replace(/(\r\n|\n|\r)/gm, ""); }); //Parse buffer into string, split into wallets and remove unwanted line breaks.

    return wallets;
}

export function saveTransactionResults() {
    writeFileSync('transaction_results.json', JSON.stringify(TRANSACTION_RESULTS));
}

export async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function isAddressValid(walletAddress: String) {
    try {
        const address = new PublicKey(walletAddress);
        return PublicKey.isOnCurve(address);
    } catch (err) {
        return false;
    }
}

export async function prepareTransactionResults() {
    if (!existsSync('transaction_results.json')) { //CREATE LOCAL FILE FROM wallets.txt
        const wallets = readWalletsFile();
        for (const wallet of wallets) {
            const isValid = await isAddressValid(wallet);
            if (isValid) {
                TRANSACTION_RESULTS[wallet] = {
                    transferAndFreezeTransaction: null,
                    transferAndFreezeStatus: 0,
                    thawTransaction: null,
                    thawStatus: 0,
                };
            }
        }
        saveTransactionResults();
    } else { //LOAD FROM LOCAL FILE
        const rawData = readFileSync('transaction_results.json');
        const transaction_results_from_file: TransactionResult = JSON.parse(rawData.toString());
        Object.keys(transaction_results_from_file).forEach(wallet => {
            TRANSACTION_RESULTS[wallet] = {
                transferAndFreezeTransaction: transaction_results_from_file[wallet].transferAndFreezeTransaction,
                transferAndFreezeStatus: transaction_results_from_file[wallet].transferAndFreezeStatus,
                thawTransaction: transaction_results_from_file[wallet].thawTransaction,
                thawStatus: transaction_results_from_file[wallet].thawStatus
            };
        });
    }
}

export async function getTokenAccount(walletPublicKey: PublicKey) {
    const account = await CONNECTION.getTokenAccountsByOwner(walletPublicKey, { mint: TOKEN });
    return account.value[0]?.pubkey;
}


export async function addTransferAndFreezeInstructionsForWallet(fromTokenAccount: PublicKey, receiver: PublicKey, amount: number, transaction: Transaction) {
    let toTokenAccount = await getTokenAccount(receiver);

    if (!toTokenAccount) {
        toTokenAccount = await getAssociatedTokenAddress(TOKEN, receiver);

        transaction.add(
            createAssociatedTokenAccountInstruction(
                SENDER_KEYPAIR.publicKey,
                toTokenAccount,
                receiver,
                TOKEN,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    } else {
        const toTokenAccountData = await getAccount(
            CONNECTION,
            toTokenAccount,
            undefined,
            TOKEN_PROGRAM_ID
        );

        if (toTokenAccountData.isFrozen) { //Skip if associated token account is already frozen!
            console.log(`\tATA already frozen: ${toTokenAccount} | Wallet: ${receiver} `);
            return transaction;
        }
    }

    transaction.add(
        createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            SENDER_KEYPAIR.publicKey,
            amount,
            [],
            TOKEN_PROGRAM_ID,
        )
    ).add(
        createFreezeAccountInstruction(
            toTokenAccount,
            TOKEN,
            SENDER_KEYPAIR.publicKey,
            [],
            TOKEN_PROGRAM_ID
        )
    );

    return transaction;
}

export async function addThawInstructionsForWallet(authority: PublicKey, receiver: PublicKey, amount: number, transaction: Transaction) {
    const toThawTokenAccount = await getTokenAccount(receiver);
    if (!toThawTokenAccount) { return transaction; }//Skip if there is no associated token account!

    const toThawAccountData = await getAccount(
        CONNECTION,
        toThawTokenAccount,
        undefined,
        TOKEN_PROGRAM_ID
    );

    if (!toThawAccountData.isFrozen) { //Skip if associated token account is already thawed!
        console.log(`\tATA already thawed: ${toThawTokenAccount} | Wallet: ${receiver} `);
        return transaction;
    }

    transaction.add(
        createThawAccountInstruction(
            toThawTokenAccount,
            TOKEN,
            SENDER_KEYPAIR.publicKey,
            [],
            TOKEN_PROGRAM_ID
        )
    );

    return transaction;
}

export async function checkUnconfirmedTransactions() {
    const allWallets = Object.keys(TRANSACTION_RESULTS);
    const treated_transactions: { [signature: string]: number; } = {};

    console.log(`\n\tChecking if there are any unconfirmed transactions from last run...`);

    for (const wallet of allWallets) {
        //CHECK UNCONFIRMED TRANSFER AND FREEZE TRANSACTIONS
        if (TRANSACTION_RESULTS[wallet].transferAndFreezeStatus == 2 &&
            TRANSACTION_RESULTS[wallet].transferAndFreezeTransaction !== null) {

            if (
                Object.keys(treated_transactions).includes(TRANSACTION_RESULTS[wallet].transferAndFreezeTransaction!)
            ) {
                TRANSACTION_RESULTS[wallet].transferAndFreezeStatus = treated_transactions[TRANSACTION_RESULTS[wallet].transferAndFreezeTransaction!];
            } else {
                const result = await CONNECTION.getTransaction(TRANSACTION_RESULTS[wallet].transferAndFreezeTransaction!);
                if (result) {
                    TRANSACTION_RESULTS[wallet].transferAndFreezeStatus = 1;
                } else {
                    TRANSACTION_RESULTS[wallet].transferAndFreezeStatus = 0;
                }
                treated_transactions[TRANSACTION_RESULTS[wallet].transferAndFreezeTransaction!] = TRANSACTION_RESULTS[wallet].transferAndFreezeStatus!;
                delay(100);
            }
        }
        //CHECK UNCONFIRMED THAW TRANSACTIONS
        if (TRANSACTION_RESULTS[wallet].thawStatus == 2 && 
            TRANSACTION_RESULTS[wallet].thawTransaction !== null) {
            if (
                Object.keys(treated_transactions).includes(TRANSACTION_RESULTS[wallet].thawTransaction!)
            ) {
                TRANSACTION_RESULTS[wallet].thawStatus = treated_transactions[TRANSACTION_RESULTS[wallet].thawTransaction!];
            } else {
                const result = await CONNECTION.getTransaction(TRANSACTION_RESULTS[wallet].thawTransaction!);
                if (result) {
                    TRANSACTION_RESULTS[wallet].thawStatus = 1;
                } else {
                    TRANSACTION_RESULTS[wallet].thawStatus = 0;
                }
                treated_transactions[TRANSACTION_RESULTS[wallet].thawTransaction!] = TRANSACTION_RESULTS[wallet].thawStatus!;
                delay(100);
            }
        }
    }
    saveTransactionResults();
    console.log(`\n\tUnconfirmed transactions has been checked. Processing to the next step now.\n`);
}

export function getStringBetween(str: string, start: string, end: string) {
    const result = str.match(new RegExp(start + "(.*)" + end))
    if (result) {
        return result[1]
    } else {
        return null
    }
}