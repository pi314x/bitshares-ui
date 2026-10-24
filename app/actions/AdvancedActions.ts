// Chain access for the "Advanced operations" screens: the lookups they need (accounts,
// assets, the chain's parameters, a committee member, a fund, an account's custom
// authorities) and the one way they send: the operations go into one transaction that
// `WalletDb.process_transaction` signs (wallet unlock, or the extension) and broadcasts,
// or into a proposal. Failures reject, so a dialog can show the node's reason.
//
// Nothing here reads, logs or stores keys or passwords.
import "../lib/chain/extraOperations";
import {Apis} from "bitsharesjs-ws";
import WalletApi from "api/WalletApi";
import WalletDb from "../stores/WalletDb";
import {
    CustomAuthority,
    authorityIdsFromHistory,
    normalizeCustomAuthority
} from "../lib/common/customAuthorities";
import {FlashFund} from "../lib/common/advancedOps";

const db = (): any => (Apis as any).instance().db_api();

export interface AccountInfo {
    id: string;
    name: string;
}

export interface AssetInfo {
    id: string;
    symbol: string;
    precision: number;
    issuer: string;
    flags: number;
}

const assetInfo = (row: any): AssetInfo => ({
    id: row.id,
    symbol: row.symbol,
    precision: Number(row.precision),
    issuer: row.issuer,
    flags: Number(row.options?.flags ?? 0)
});

class AdvancedActionsFacade {
    /** The account of a name (null when there is none). */
    getAccountByName(name: string): Promise<AccountInfo | null> {
        return db()
            .exec("lookup_account_names", [[name]])
            .then((rows: any[]) =>
                rows && rows[0] ? {id: rows[0].id, name: rows[0].name} : null
            );
    }

    /** name -> id for the given names; null for one that does not exist. */
    getAccountIds(names: string[]): Promise<Record<string, string | null>> {
        return db()
            .exec("lookup_account_names", [names])
            .then((rows: any[]) => {
                const out: Record<string, string | null> = {};
                names.forEach((name, i) => {
                    out[name] = rows && rows[i] ? rows[i].id : null;
                });
                return out;
            });
    }

    getAccountById(id: string): Promise<AccountInfo | null> {
        return db()
            .exec("get_accounts", [[id]])
            .then((rows: any[]) =>
                rows && rows[0] ? {id: rows[0].id, name: rows[0].name} : null
            );
    }

    getAssetBySymbol(symbol: string): Promise<AssetInfo | null> {
        return db()
            .exec("lookup_asset_symbols", [[symbol]])
            .then((rows: any[]) =>
                rows && rows[0] ? assetInfo(rows[0]) : null
            );
    }

    getAssetById(id: string): Promise<AssetInfo | null> {
        return db()
            .exec("get_assets", [[id]])
            .then((rows: any[]) =>
                rows && rows[0] ? assetInfo(rows[0]) : null
            );
    }

    /** symbol -> id for the given symbols; null for one that does not exist. */
    getAssetIds(symbols: string[]): Promise<Record<string, string | null>> {
        return db()
            .exec("lookup_asset_symbols", [symbols])
            .then((rows: any[]) => {
                const out: Record<string, string | null> = {};
                symbols.forEach((symbol, i) => {
                    out[symbol] = rows && rows[i] ? rows[i].id : null;
                });
                return out;
            });
    }

    /** The chain's parameters (`get_global_properties().parameters`). */
    getParameters(): Promise<any> {
        return db()
            .exec("get_global_properties", [])
            .then((properties: any) => properties.parameters);
    }

    /** Head block time, seconds since 1970. */
    getHeadTime(): Promise<number> {
        return db()
            .exec("get_dynamic_global_properties", [])
            .then(
                (p: any) => Date.parse(String(p.time).slice(0, 19) + "Z") / 1000
            );
    }

    /** The committee member of an account, null when it is none. */
    getCommitteeMember(
        accountId: string
    ): Promise<{id: string; url: string} | null> {
        return db()
            .exec("get_committee_member_by_account", [accountId])
            .then((member: any) =>
                member ? {id: member.id, url: String(member.url ?? "")} : null
            );
    }

    getFund(id: string): Promise<FlashFund | null> {
        return db()
            .exec("get_objects", [[id]])
            .then((rows: any[]) => {
                const fund = rows && rows[0];
                return fund && fund.id === id
                    ? {
                          id: fund.id,
                          asset_type: fund.asset_type,
                          balance: String(fund.balance),
                          unpaid_amount: String(fund.unpaid_amount ?? "0"),
                          fee_rate: Number(fund.fee_rate)
                      }
                    : null;
            });
    }

    /**
     * The custom authorities of an account. The node has no query for them: its history
     * names them, and the objects are read from the chain by id.
     */
    getCustomAuthorities(
        accountId: string,
        extraIds: string[] = []
    ): Promise<CustomAuthority[]> {
        return (Apis as any)
            .instance()
            .history_api()
            .exec("get_account_history", [accountId, "1.11.0", 100, "1.11.0"])
            .catch(() => [])
            .then((history: any[]) => {
                const ids = Array.from(
                    new Set([...authorityIdsFromHistory(history), ...extraIds])
                );
                if (!ids.length) return [];
                return db()
                    .exec("get_objects", [ids])
                    .then((rows: any[]) =>
                        (rows || [])
                            .map(normalizeCustomAuthority)
                            .filter(
                                (a): a is CustomAuthority =>
                                    !!a && a.account === accountId
                            )
                    );
            });
    }

    /** One transaction of the operations [name, fields], signed and sent. */
    send(operations: Array<[string, any]>): Promise<any> {
        return Promise.resolve().then(() => {
            const tr = WalletApi.new_transaction();
            operations.forEach(([name, data]) =>
                tr.add_type_operation(name, data)
            );
            return WalletDb.process_transaction(tr, null, true);
        });
    }

    /** A proposal holding the operation (the committee's to approve, for operation 31). */
    propose(proposal: {
        fee_paying_account: string;
        proposed_ops: Array<{op: any[]}>;
    }): Promise<any> {
        return this.send([["proposal_create", proposal]]);
    }
}

export default new AdvancedActionsFacade();
