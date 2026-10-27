// What the Lifetime membership calculator reads from the node: the chain's fee schedule and the
// account's membership. Read-only: nothing here signs.
import {Apis} from "bitsharesjs-ws";
import {MembershipStatus, membershipStatus} from "../common/membership";

const db = () => (Apis as any).instance().db_api();

/** What the chain says a Lifetime membership costs and gives back, and the account's own status. */
export interface MembershipInfo {
    /** `membership_lifetime_fee`, in smallest units of the core asset */
    lifetimeFee: bigint;
    /** the network's share of a fee, in 1/10,000 */
    networkBp: number;
    /** the fee of one pool exchange (63) and of one limit order (1), core units */
    exchangeFee: bigint;
    orderFee: bigint;
    /** a fee up to this has its cashback paid already vested; the cashback of a larger one vests */
    vestingThreshold: bigint;
    vestingDays: number;
    status: MembershipStatus;
    /** the core asset the fees are in */
    core: {symbol: string; precision: number};
}

const CORE_ID = "1.3.0";

export async function loadMembership(
    accountName: string | null
): Promise<MembershipInfo> {
    const properties: any = await db().exec("get_global_properties", []);
    const parameters = properties.parameters;
    const scale = BigInt(String(parameters.current_fees.scale || 10000));
    const feeOf = (code: number, field = "fee"): bigint => {
        const row = (parameters.current_fees.parameters as any[]).find(
            entry => entry[0] === code
        );
        return row
            ? (BigInt(String(row[1][field] || 0)) * scale) / BigInt(10000)
            : BigInt(0);
    };
    let status: MembershipStatus = "unknown";
    if (accountName) {
        try {
            const rows: any[] = (await db().exec("get_accounts", [
                [accountName]
            ])) as any[];
            status = membershipStatus(
                rows && rows[0] && rows[0].membership_expiration_date
            );
        } catch (e) {
            status = "unknown";
        }
    }
    // the fees are in the core asset (BTS on the main chain): its symbol and precision
    let core = {symbol: "BTS", precision: 5};
    try {
        const rows: any[] = (await db().exec("get_assets", [
            [CORE_ID]
        ])) as any[];
        if (rows && rows[0] && rows[0].symbol) {
            core = {
                symbol: String(rows[0].symbol),
                precision: Number(rows[0].precision)
            };
        }
    } catch (e) {
        // the usual one stays
    }
    return {
        lifetimeFee: feeOf(8, "membership_lifetime_fee"),
        networkBp: Number(parameters.network_percent_of_fee),
        exchangeFee: feeOf(63),
        orderFee: feeOf(1),
        vestingThreshold: BigInt(String(parameters.cashback_vesting_threshold)),
        vestingDays: Math.round(
            Number(parameters.cashback_vesting_period_seconds) / 86400
        ),
        status,
        core
    };
}
