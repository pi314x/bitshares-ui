// The node answers `get_full_accounts` with at most 500 balances (`more_data_available.balances`
// says so) and ChainStore takes that for all of them: an account with more balance objects than
// that (many of them empty, left over from assets it once held) never showed the rest, whichever
// they were - XBTSX.A, bought on the market, was not among the holdings. bitsharesjs has a helper
// for it (`requestAllDataForAccount`) that sets a field of an Immutable object and does nothing.
//
// The answer is completed on its way into ChainStore: when it says that there are more balances,
// they are asked for with `get_account_balances` (which has no cap of that kind) and the ones the
// full account lacks are added as balance objects of their own. The chain's ids of those objects are
// not known (that call names the asset and the amount only), so they get ids no real object has;
// ChainStore keys them by asset anyway. They are not subscribed to: a balance that came this way is
// as fresh as the account's last load.
import GrapheneApi from "bitsharesjs-ws/lib/GrapheneApi";

/** object numbers no real balance object has (the chain is at about two million) */
const SYNTHETIC_BASE = 9000000000;

const assetNumber = (assetId: string) => parseInt(assetId.split(".")[2], 10);

type ExecFunction = (this: any, method: string, params: any[]) => Promise<any>;

async function addMissingBalances(
    original: ExecFunction,
    api: any,
    accounts: any[]
) {
    for (const entry of accounts || []) {
        const full = entry && entry[1];
        if (!full || !full.balances) continue;
        const more = full.more_data_available;
        if (!more || !more.balances) continue;
        const accountId = full.account.id;
        const all: Array<{
            amount: any;
            asset_id: string;
        }> = await original.call(api, "get_account_balances", [accountId, []]);
        const have = new Set(full.balances.map((b: any) => b.asset_type));
        all.forEach(balance => {
            if (have.has(balance.asset_id)) return;
            full.balances.push({
                id: `2.5.${SYNTHETIC_BASE + assetNumber(balance.asset_id)}`,
                owner: accountId,
                asset_type: balance.asset_id,
                balance: balance.amount,
                maintenance_flag: false
            });
        });
    }
}

/** Patches `exec` of the API class (once): every API object, also after a reconnect, is covered. */
export function installCompleteBalances(
    apiClass: {prototype: any} = GrapheneApi as any
) {
    const proto = apiClass.prototype;
    if (proto.__balancesCompleted) return;
    const original: ExecFunction = proto.exec;
    proto.exec = function(this: any, method: string, params: any[]) {
        const answer = original.call(this, method, params);
        if (this.api_name !== "database" || method !== "get_full_accounts") {
            return answer;
        }
        return answer.then(async (accounts: any[]) => {
            try {
                await addMissingBalances(original, this, accounts);
            } catch (e) {
                // the account as the node sent it is better than none
            }
            return accounts;
        });
    };
    proto.__balancesCompleted = true;
}
