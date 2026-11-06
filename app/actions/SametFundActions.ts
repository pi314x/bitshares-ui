// Chain access and transactions for SameT funds ("flash loan" funds).
//
// Reads go straight to the node's database API (`list_samet_funds`,
// `get_samet_funds_by_owner`, plus the lookups needed to show names and
// balances); there is no store, the page keeps what it fetched in component
// state. Writes (create / update / delete a fund) follow exactly the pattern of
// `CreditOfferActions`: build the operation, hand it to
// `WalletDb.process_transaction`, which prompts for the wallet unlock, signs
// locally and broadcasts. The operations themselves come from the pure,
// serializer-tested builders in `lib/common/sametFunds.ts`.
//
// Unlike the credit-offer actions, failures are NOT swallowed: the returned
// promise rejects, so the page can show the node's reason instead of going
// quiet. Nothing in this file reads, logs or stores keys or passwords.
//
// Borrow / repay (`samet_fund_borrow`, `samet_fund_repay`) are deliberately
// not offered: a flash loan has to be borrowed and repaid, with the fee, inside
// ONE transaction, which only makes sense when a program composes it. The
// operations exist in the serializers and are displayed in the account history
// (`Blockchain/OperationAnt.js`).
import {Apis} from "bitsharesjs-ws";
import WalletApi from "api/WalletApi";
import WalletDb from "../stores/WalletDb";
import {
    SametFund,
    buildCreateOp,
    buildDeleteOp,
    buildUpdateOp,
    nextStartId,
    normalizeFund,
    CreateFundArgs,
    DeleteFundArgs,
    UpdateFundArgs
} from "../lib/common/sametFunds";

/** The node serves at most this many rows per call. */
export const PAGE_SIZE = 100;

export interface AssetInfo {
    id: string;
    symbol: string;
    precision: number;
}

export interface AccountInfo {
    id: string;
    name: string;
}

export interface BalanceInfo {
    asset_id: string;
    amount: string;
}

export interface FundPage {
    funds: SametFund[];
    /** Where to continue, or null when this was the last page. */
    next: string | null;
}

function db(): any {
    return (Apis as any).instance().db_api();
}

function toPage(rows: any[]): FundPage {
    const funds = (rows || []).map(normalizeFund);
    const full = funds.length >= PAGE_SIZE;
    return {
        funds,
        next: full ? nextStartId(funds[funds.length - 1].id) : null
    };
}

class SametFundActionsFacade {
    listAll(startId?: string | null): Promise<FundPage> {
        return db()
            .exec("list_samet_funds", [PAGE_SIZE, startId || null])
            .then(toPage);
    }

    listByOwner(owner: string, startId?: string | null): Promise<FundPage> {
        return db()
            .exec("get_samet_funds_by_owner", [
                owner,
                PAGE_SIZE,
                startId || null
            ])
            .then(toPage);
    }

    /** id -> {symbol, precision} for the given asset ids (unknown ids are
     * left out). */
    getAssets(ids: string[]): Promise<Record<string, AssetInfo>> {
        const unique = Array.from(new Set(ids));
        if (!unique.length) return Promise.resolve({});
        return db()
            .exec("get_assets", [unique])
            .then((rows: any[]) => {
                const out: Record<string, AssetInfo> = {};
                (rows || []).forEach(row => {
                    if (row) {
                        out[row.id] = {
                            id: row.id,
                            symbol: row.symbol,
                            precision: Number(row.precision)
                        };
                    }
                });
                return out;
            });
    }

    /** id -> {name} for the given account ids. */
    getAccounts(ids: string[]): Promise<Record<string, AccountInfo>> {
        const unique = Array.from(new Set(ids));
        if (!unique.length) return Promise.resolve({});
        return db()
            .exec("get_accounts", [unique])
            .then((rows: any[]) => {
                const out: Record<string, AccountInfo> = {};
                (rows || []).forEach(row => {
                    if (row) out[row.id] = {id: row.id, name: row.name};
                });
                return out;
            });
    }

    /** Resolve an account name to its id (null when it does not exist). */
    getAccountByName(name: string): Promise<AccountInfo | null> {
        return db()
            .exec("lookup_account_names", [[name]])
            .then((rows: any[]) =>
                rows && rows[0] ? {id: rows[0].id, name: rows[0].name} : null
            );
    }

    /** Every non-empty balance of the account. */
    getBalances(accountId: string): Promise<BalanceInfo[]> {
        return db()
            .exec("get_account_balances", [accountId, []])
            .then((rows: any[]) =>
                (rows || [])
                    .map(row => ({
                        asset_id: row.asset_id,
                        amount: String(row.amount)
                    }))
                    .filter(row => row.amount !== "0")
            );
    }

    // The builders throw on invalid input; running them inside the promise
    // chain turns that into a rejection the page can show, not a synchronous
    // exception in an event handler.
    private submit(name: string, buildOp: () => any): Promise<any> {
        return Promise.resolve().then(() => {
            const tr = WalletApi.new_transaction();
            tr.add_type_operation(name, buildOp());
            return WalletDb.process_transaction(tr, null, true);
        });
    }

    create(args: CreateFundArgs): Promise<any> {
        return this.submit("samet_fund_create", () => buildCreateOp(args));
    }

    update(args: UpdateFundArgs): Promise<any> {
        return this.submit("samet_fund_update", () => buildUpdateOp(args));
    }

    delete(args: DeleteFundArgs): Promise<any> {
        return this.submit("samet_fund_delete", () => buildDeleteOp(args));
    }
}

export default new SametFundActionsFacade();
