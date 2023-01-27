import { Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { SENDER_KEYPAIR, TRANSACTION_RESULTS, MAX_TRANSFER_AND_FREEZE_ADDRESS_LIMIT, AMOUNT, CONNECTION, MAX_THAW_ADDRESS_LIMIT, TOKEN } from "./constants";
import { getTokenAccount, addTransferAndFreezeInstructionsForWallet, prepareTransactionResults, saveTransactionResults, delay, addThawInstructionsForWallet, getStringBetween, checkUnconfirmedTransactions } from "./functions";
import { writeFileSync } from "fs";
import { program } from "commander";
import { createThawAccountInstruction, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

/*********CLI Param(s)*********/
program.option('-o, --operation <string>', "Operation to be executed: transferAndFreeze or thaw");
program.parse();
const options = program.opts();
const operation: string = options.operation;
/****************************/

(async() => {
    /*********Initialization*********/
    prepareTransactionResults(); //Prepare database
    await checkUnconfirmedTransactions();
    const fromTokenAccount = await getTokenAccount(SENDER_KEYPAIR.publicKey); //Token account of sender
    /******************************/

    switch(operation){
        case 'transferAndFreeze':
            await transferAndFreezeAccounts(fromTokenAccount);
            break;
        case 'thaw':
            await thawAccounts(fromTokenAccount);
            break;
        default:
            console.log(`\n\tInvalid operation. Please provide one of the following operations using --operation parameter:\n\t\t- transferAndFreeze\n\t\t- thaw`);
            process.exit(-1);
            break;
    }

})();

async function transferAndFreezeAccounts(fromTokenAccount: PublicKey){
    let wallet_holder: Array<string> = [];
    let wallets = (Object.keys(TRANSACTION_RESULTS)).filter((wallet) => {
        return TRANSACTION_RESULTS[wallet].transferAndFreezeStatus == 0;
    });
    let index = 0;
    let has_unsuccessful = false; 
    while(index < wallets.length){
        let transaction = new Transaction();

        for (let i = 0; i < MAX_TRANSFER_AND_FREEZE_ADDRESS_LIMIT && index < wallets.length; i++) {
            transaction = await addTransferAndFreezeInstructionsForWallet(fromTokenAccount, new PublicKey(wallets[index]), AMOUNT, transaction);
            wallet_holder.push(wallets[index]);
            index++;
        }
    
        transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
        transaction.feePayer  = SENDER_KEYPAIR.publicKey;
        
        try{
            if(transaction.instructions.length > 0) {
                const result = await sendAndConfirmTransaction(CONNECTION, transaction, [SENDER_KEYPAIR]);
                wallet_holder.forEach((wallet) => {
                    TRANSACTION_RESULTS[wallet].transferAndFreezeTransaction = result;
                    TRANSACTION_RESULTS[wallet].transferAndFreezeStatus = 1;     
                });
                saveTransactionResults();
                const tx = await CONNECTION.getTransaction(result);
                console.log(`\n\tTX has been sent: ${result}\n\tSize: ${tx?.transaction.message.serialize().byteLength} bytes`);
            }
        } catch(error: any) {
            const signature: string | null = getStringBetween(error.message, 'Check signature ', ' using the Solana Exp')
			if (signature) {
				wallet_holder.forEach((wallet) => {
                    TRANSACTION_RESULTS[wallet].transferAndFreezeTransaction = signature;
                    TRANSACTION_RESULTS[wallet].transferAndFreezeStatus = 2;     
                });
                saveTransactionResults();
			} else {
                console.log(`An error has occurred: ${error}`);
			}
            has_unsuccessful = true;
            /*console.log(err);
            wallet_holder.forEach((wallet) => {
                failed_wallet_holder.push(wallet);
            });*/
        }

        await delay(333);
        wallet_holder = [];

    }

    if(has_unsuccessful){ console.log(`\n\tUnsuccessful transaction(s) detected. Please re-run program with same configuration!`);}
}

async function thawAccounts(fromTokenAccount: PublicKey){
    let wallet_holder: Array<string> = [];
    let wallets = (Object.keys(TRANSACTION_RESULTS)).filter((wallet) => {
        return (TRANSACTION_RESULTS[wallet].transferAndFreezeStatus == 1 && TRANSACTION_RESULTS[wallet].thawStatus == 0) ;
    });
    let index = 0;
    let has_unsuccessful = false; 
    while(index < wallets.length){
        let transaction = new Transaction();

        for (let i = 0; i < MAX_THAW_ADDRESS_LIMIT && index < wallets.length; i++) {
            transaction = await addThawInstructionsForWallet(fromTokenAccount, new PublicKey(wallets[index]), AMOUNT, transaction);
            wallet_holder.push(wallets[index]);
            index++;
        }
    
        transaction.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
        transaction.feePayer  = SENDER_KEYPAIR.publicKey;
        
        try{
            if(transaction.instructions.length > 0) {
                const result = await sendAndConfirmTransaction(CONNECTION, transaction, [SENDER_KEYPAIR]);
                wallet_holder.forEach((wallet) => {
                    TRANSACTION_RESULTS[wallet].thawTransaction = result;
                    TRANSACTION_RESULTS[wallet].thawStatus = 1;
                })
                saveTransactionResults();
                const tx = await CONNECTION.getTransaction(result);
                console.log(`\n\tTX has been sent: ${result}\n\tSize: ${tx?.transaction.message.serialize().byteLength} bytes`);
            }
        } catch(error: any) {
            const signature: string | null = getStringBetween(error.message, 'Check signature ', ' using the Solana Exp')
			if (signature) {
				wallet_holder.forEach((wallet) => {
                    TRANSACTION_RESULTS[wallet].thawTransaction = signature;
                    TRANSACTION_RESULTS[wallet].thawStatus = 2;     
                });
                saveTransactionResults();
			} else {
                console.log(`An error has occurred: ${error}`);
			}
            has_unsuccessful = true;
            /*console.log(err);
            wallet_holder.forEach((wallet) => {
                failed_wallet_holder.push(wallet);
            });*/
        }
        
        await delay(333);
        wallet_holder = [];
    }

    if(has_unsuccessful){ console.log(`\n\tUnsuccessful transaction(s) detected. Please re-run program with same configuration!`);}
}