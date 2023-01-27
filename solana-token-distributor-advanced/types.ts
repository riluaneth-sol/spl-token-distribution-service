export interface TransactionResult {
    [wallet: string] : {
        transferAndFreezeTransaction: string | null,
        transferAndFreezeStatus: number | null,
        thawTransaction: string | null,
        thawStatus: number | null,
    }
}

/*
*STATUS CODES
* 0 - not executed
* 1 - successful
* 2 - not confirmed
*/