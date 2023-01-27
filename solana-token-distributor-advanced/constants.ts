import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TransactionResult } from "./types";

const CONNECTION_URL = "https://api.devnet.solana.com";
const AUTHORITY_KEYPAIR_PATH = './keypairs/creator.json';
const TOKEN_KEYPAIR_PATH = './keypairs/token.json';
const TOKEN_ADDRESS = (Keypair.fromSecretKey(Uint8Array.from(require(TOKEN_KEYPAIR_PATH)))).publicKey.toBase58()//"toVxXHF3hxTMVo8Qkir9CSB7BQW54M84RwD2cVh825z";
const TRANSFER_AMOUNT = 5;
const MAX_TRANSFER_AND_FREEZE_ADDRESS_LIMIT = 9; //Current instructions can go up to 9 wallets while keeping size < 1232 bytes
const MAX_THAW_ADDRESS_LIMIT = 25; //Current instructions can go up to 9 wallets while keeping size < 1232 bytes
const TransactionResultInitializer: TransactionResult = {};

export const SENDER_KEYPAIR = Keypair.fromSecretKey(Uint8Array.from(require(AUTHORITY_KEYPAIR_PATH)));
export const TOKEN = new PublicKey(TOKEN_ADDRESS) 
export const AMOUNT = TRANSFER_AMOUNT;
export { MAX_TRANSFER_AND_FREEZE_ADDRESS_LIMIT, MAX_THAW_ADDRESS_LIMIT };
export const TRANSACTION_RESULTS = TransactionResultInitializer;
export const CONNECTION = new Connection(CONNECTION_URL);