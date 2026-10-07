// TypeScript/functional-component port of the legacy
// AccountReferralsTable.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Structural change (not a behavior change): `BindToChainState(Component)`
// (four required chain-type props: `account`, `gprops`, `dprops`,
// `core_asset`) replaced by a Container gating on all four resolving
// under `useChainStoreTick()`. `gprops`/`dprops`/`core_asset` are
// resolved (gating first render on them, per the original's
// `.isRequired`) but - like `myActiveAccounts`/`myHiddenAccounts` below -
// are never actually read anywhere in this component's body; confirmed
// dead by inspection, but the *gating* they cause is a real, observable
// effect (this component won't render until they load), so their
// resolution is preserved even though their values are discarded (and,
// for the same reason, not threaded down to the inner component at all).
// `connect(Component, {listenTo, getProps})` (injecting
// `myActiveAccounts`/`myHiddenAccounts` from `AccountStore`) replaced by
// `useAltStore(AccountStore)`.
//
// `_getReferrals`'s local `referralsIndex` variable is captured once per
// call and *mutated in place* (`.push(...)`) inside each of several
// parallel `FetchChain(...).then(...)` callbacks, each of which then
// calls `setState` with that same mutated array reference - replicated
// exactly (not "fixed" to build a new array per update), since multiple
// referral accounts resolving concurrently is expected to progressively
// fill in the same table via repeated renders of the same, growing array.
//
// `componentDidMount` (calls `_getReferrals(0, true)` once) +
// `componentDidUpdate` (calls it again whenever `account` changes) are
// both replicated by a single `useEffect` keyed on `account` - it
// naturally fires once on mount and again on every subsequent `account`
// change, with identical arguments in both cases, so no separate
// mount-skip guard is needed here (unlike most other lifecycle merges in
// this migration).
import * as React from "react";
import {Link} from "react-router-dom";
import Translate from "react-translate-component";
import {ChainStore, FetchChain} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import AccountStore from "stores/AccountStore";
import Statistics from "./Statistics";
import {settingsAPIs} from "api/apiConfig";
import {Table} from "../../design-system/Table";
import {useAltStore} from "../../next/hooks/useAltStore";

const LinkComponent = Link as React.ComponentType<any>;

interface AccountReferralsTableState {
    referralsIndex: any[];
    referralsCount: number | null;
    errorLoading: boolean | null;
}

interface AccountReferralsTableProps {
    account: any;
}

function AccountReferralsTable({account}: AccountReferralsTableProps) {
    const [state, setState] = React.useState<AccountReferralsTableState>({
        referralsIndex: [],
        referralsCount: null,
        errorLoading: null
    });
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const mergeState = (partial: Partial<AccountReferralsTableState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const getReferrals = async (page = 0, isAccountChanged = false) => {
        if (settingsAPIs.ES_WRAPPER_LIST.length == 0) return;

        // fixme access to ES could be wrapped in a store or something else
        const esNode = (settingsAPIs.ES_WRAPPER_LIST[0] as any).url;

        let referralsIndex = stateRef.current.referralsIndex;
        let referralsCount = stateRef.current.referralsCount;

        if (isAccountChanged) {
            referralsCount = null;
            referralsIndex = [];
        }

        try {
            if (!referralsCount) {
                const referralsCountResponse = await fetch(
                    esNode + "/referrer_count?account_id=" + account.get("id")
                );
                if (!referralsCountResponse.ok) {
                    throw new Error(
                        "Could not reach referrer_count endpoint on ES wrapper" +
                            esNode
                    );
                }
                mergeState({
                    referralsCount: await referralsCountResponse.json()
                });
            }

            const referralsIndexResponse = await fetch(
                esNode +
                    "/all_referrers?account_id=" +
                    account.get("id") +
                    "&page=" +
                    page
            );
            if (!referralsIndexResponse.ok) {
                throw new Error(
                    "Could not reach all_referrers endpoint on ES wrapper" +
                        esNode
                );
            }
            const results = await referralsIndexResponse.json();

            const objectsToFetch: any[] = [];
            results.map((ref: any) => {
                objectsToFetch.push(ref.account_id);
            });
            // Fetch Account Data
            objectsToFetch.forEach((id_to_fetch: any) => {
                (FetchChain as any)("getAccount", id_to_fetch).then(
                    (acct: any) => {
                        acct = acct.toJS();

                        const network_fee = acct.network_fee_percentage / 100;
                        const lifetime_fee =
                            acct.lifetime_referrer_fee_percentage / 100;
                        const referrer_total_fee =
                            100 - network_fee - lifetime_fee;
                        const referrer_fee =
                            (referrer_total_fee *
                                acct.referrer_rewards_percentage) /
                            10000;
                        const registrar_fee =
                            100 - referrer_fee - lifetime_fee - network_fee;

                        referralsIndex.push({
                            id: acct.id,
                            name: acct.name,
                            lifetime_ref: {
                                name: acct.lifetime_referrer_name,
                                value: lifetime_fee
                            },
                            registrar_ref: {
                                name: acct.registrar_name,
                                value: registrar_fee
                            },
                            affiliate_ref: {
                                name: acct.referrer_name,
                                value: referrer_fee
                            },
                            network: network_fee,
                            statistics: acct.statistics,
                            membership_expiration: null
                        });
                        mergeState({
                            referralsIndex: referralsIndex
                        });
                    }
                );
            });
        } catch (err) {
            console.error(err);
            mergeState({
                errorLoading: true
            });
        }
    };

    React.useEffect(() => {
        getReferrals(0, true);
    }, [account]);

    const onPaginationChange = (page: number) => {
        getReferrals(page - 1);
    };

    // fixme access to ES could be wrapped in a store or something else
    if (settingsAPIs.ES_WRAPPER_LIST.length == 0) return null;

    const accountJs = account.toJS();

    const ltr = (ChainStore as any).getAccount(accountJs.lifetime_referrer, false);
    if (ltr) accountJs.lifetime_referrer_name = ltr.get("name");
    const ref = (ChainStore as any).getAccount(accountJs.referrer, false);
    if (ref) accountJs.referrer_name = ref.get("name");
    const reg = (ChainStore as any).getAccount(accountJs.registrar, false);
    if (reg) accountJs.registrar_name = reg.get("name");

    const refData = state.referralsIndex;

    const refColumns = [
        {
            key: "name",
            title: "Name",
            render: (dataItem: any) => {
                return (
                    <span>
                        <LinkComponent to={`/account/${dataItem.name}`}>
                            {dataItem.name}
                        </LinkComponent>
                    </span>
                );
            }
        },
        {
            key: "statistics",
            title: <Translate content="account.member.fees_paid" />,
            render: (dataItem: any) => {
                return <Statistics plainText stat_object={dataItem.statistics} />;
            }
        },
        {
            key: "network",
            title: <Translate content="account.member.network_percentage" />,
            render: (dataItem: any) => {
                return <span>{dataItem.network}%</span>;
            }
        },
        {
            key: "lifetime_ref",
            title: <Translate content="account.member.lifetime_referrer" />,
            render: (dataItem: any) => {
                return (
                    <span>
                        {dataItem.lifetime_ref.value}% (
                        <LinkComponent
                            to={`/account/${dataItem.lifetime_ref.name}`}
                        >
                            {dataItem.lifetime_ref.name}
                        </LinkComponent>
                        )
                    </span>
                );
            }
        },
        {
            key: "registrar_ref",
            title: <Translate content="account.member.registrar" />,
            render: (dataItem: any) => {
                return (
                    <span>
                        {dataItem.registrar_ref.value}% (
                        <LinkComponent
                            to={`/account/${dataItem.registrar_ref.name}`}
                        >
                            {dataItem.registrar_ref.name}
                        </LinkComponent>
                        )
                    </span>
                );
            }
        },
        {
            key: "affiliate_ref",
            title: <Translate content="account.member.referrer" />,
            render: (dataItem: any) => {
                return (
                    <span>
                        {dataItem.affiliate_ref.value}% (
                        <LinkComponent
                            to={`/account/${dataItem.affiliate_ref.name}`}
                        >
                            {dataItem.affiliate_ref.name}
                        </LinkComponent>
                        )
                    </span>
                );
            }
        }
    ];
    if (state.errorLoading) {
        return <Translate content="errors.loading_from_es" />;
    }
    return (
        <Table
            rowKey="accountReferrals"
            columns={refColumns}
            dataSource={refData}
            pagination={{
                pageSize: Number(20),
                total:
                    (state.referralsCount as any) <= state.referralsIndex.length
                        ? state.referralsIndex.length
                        : state.referralsIndex.length + 20,
                showTotal: () => {
                    return (
                        <Translate
                            content="account.member.total_ref"
                            total={state.referralsCount}
                        />
                    );
                }
            }}
            // The design-system `Table` fires page changes through its own
            // top-level `onChange` (antd nests this inside `pagination
            // .onChange` instead) - `pagination.current` carries the new,
            // already-1-based page number antd's own callback passed
            // directly.
            onChange={pagination => onPaginationChange(pagination.current)}
        />
    );
}

interface AccountReferralsTableContainerProps {
    account: string;
    gprops?: string;
    dprops?: string;
    core_asset?: string;
    [key: string]: any;
}

function AccountReferralsTableChainContainer({
    account,
    gprops = "2.0.0",
    dprops = "2.1.0",
    core_asset = "1.3.0"
}: AccountReferralsTableContainerProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, false);
    const resolvedGprops = ChainStore.getObject(gprops);
    const resolvedDprops = ChainStore.getObject(dprops);
    const resolvedCoreAsset = ChainStore.getAsset(core_asset);

    if (!resolvedAccount || !resolvedGprops || !resolvedDprops || !resolvedCoreAsset) {
        return <span />;
    }

    return <AccountReferralsTable account={resolvedAccount} />;
}

function AccountReferralsTableWrapper(
    props: AccountReferralsTableContainerProps
) {
    const accountState = useAltStore<any>(AccountStore);

    return (
        <AccountReferralsTableChainContainer
            {...props}
            myActiveAccounts={accountState.myActiveAccounts}
            myHiddenAccounts={accountState.myHiddenAccounts}
        />
    );
}

export default AccountReferralsTableWrapper;
