// TypeScript/functional-component port of the legacy AccountVesting.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onClaim` calls
// `WalletActions.claimVestingBalance`, a wallet transaction action -
// transcribed verbatim, no restructuring.
//
// `UNSAFE_componentWillMount` (calls `retrieveVestingBalances` once,
// unconditionally) + `componentDidUpdate` (calls it again only when the
// account id changes) are unified into one `useEffect` keyed on
// `account.get("id")` - it fires once on mount and again whenever the id
// changes, matching both original call sites with the same argument in
// both cases (the same pattern used for `AccountReferralsTable.tsx` in
// an earlier batch). Unlike a couple of other lifecycle merges in this
// migration, a plain `useEffect` (rather than a render-phase update) is
// used here since the only visible effect of the pre-fetch/post-fetch
// timing gap is a `loading` flag toggling a `PaginatedList` spinner, not
// a wrong-content flash.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../Utility/FormattedAsset";
import {ChainStore} from "bitsharesjs";
import utils from "common/utils";
import WalletActions from "actions/WalletActions";
import {Apis} from "bitsharesjs-ws";
import {Button} from "bitshares-ui-style-guide";
import PaginatedList from "components/Utility/PaginatedList";
import SearchInput from "../Utility/SearchInput";
import counterpart from "counterpart";

interface AccountVestingState {
    vesting_balances: any[];
    searchTerm: string;
    loading: boolean;
    error: boolean;
}

interface AccountVestingProps {
    account: any;
}

function AccountVesting({account}: AccountVestingProps) {
    const [state, setState] = React.useState<AccountVestingState>({
        vesting_balances: [],
        searchTerm: "",
        loading: false,
        error: false
    });

    const mergeState = (partial: Partial<AccountVestingState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const mapVestingBalances = (vb: any) => {
        if (!vb) {
            return null;
        }
        let vesting_balances = vb.filter((item: any) => {
            return item.balance.amount && item.balance.asset_id;
        });
        vesting_balances = vesting_balances.map((item: any) => {
            let cvbAsset,
                balance,
                available_percentage: any = 0,
                days_earned: any = 0,
                days_required: any = 0,
                days_remaining: any = 0,
                isCoinDays = true,
                canClaim = true;

            if (item) {
                balance = item.balance.amount;
                cvbAsset = ChainStore.getAsset(item.balance.asset_id);

                if (item.policy && item.policy[0] === 1) {
                    // cdd_vesting_policy (coin days destroyed)
                    const start = Math.floor(
                        new Date(item.policy[1].start_claim + "Z").getTime() /
                            1000
                    );
                    const now = Math.floor(new Date().getTime() / 1000);

                    if (start > 0) {
                        // Vesting has a specific start date.
                        // Vesting with locked value required to mautre fully before claiming
                        // Full vesting period must pass before it can be claimed.
                        // Calculate days left before a claim is possible
                        // Example asset is BRIDGE.BCO - 1.3.1564

                        isCoinDays = false;

                        const seconds_earned = now - start;
                        const seconds_period = item.policy[1].vesting_seconds;

                        if (seconds_earned < seconds_period) {
                            canClaim = false;
                            days_earned = parseFloat(
                                (seconds_earned / 86400) as any
                            ).toFixed(2);
                            days_required = parseFloat(
                                (seconds_period / 86400) as any
                            ).toFixed(2);
                            days_remaining = (
                                days_required - days_earned
                            ).toFixed(2);
                            available_percentage = 0;
                        } else {
                            available_percentage = 1;
                        }
                    } else {
                        // Vesting has no start time.
                        // Vesting balances has a vesting with maturing value
                        // If period is 0 we expect a 100% claimable balance
                        // otherwise we expect to be allowed to claim the matured percentage.

                        // Core is lazy calculating the vesting balance object, so we
                        // need to account for the time passed since it was last updated
                        const seconds_last_updated = Math.floor(
                            new Date(
                                item.policy[1].coin_seconds_earned_last_update +
                                    "Z"
                            ).getTime() / 1000
                        );
                        const seconds_earned =
                            parseFloat(item.policy[1].coin_seconds_earned) +
                            balance * (now - seconds_last_updated);
                        const seconds_period = item.policy[1].vesting_seconds;

                        available_percentage =
                            seconds_period === 0
                                ? 1
                                : seconds_earned / (seconds_period * balance);
                        // Make sure we don't go over 1
                        available_percentage =
                            available_percentage > 1 ? 1 : available_percentage;

                        days_earned = utils.format_number(
                            utils.get_asset_amount(
                                seconds_earned / 86400,
                                cvbAsset
                            ),
                            0
                        );
                        days_required = utils.format_number(
                            utils.get_asset_amount(
                                (item.balance.amount * seconds_period) / 86400,
                                cvbAsset
                            ),
                            0
                        );
                        days_remaining = utils.format_number(
                            (seconds_period * (1 - available_percentage)) /
                                86400 || 0,
                            2
                        );
                    }
                } else if (item.policy && item.policy[0] === 0) {
                    // linear_vesting_policy
                    const start = Math.floor(
                        new Date(
                            item.policy[1].begin_timestamp + "Z"
                        ).getTime() / 1000
                    );
                    const now = Math.floor(new Date().getTime() / 1000);
                    const seconds_earned = Math.max(now - start, 0);
                    const seconds_period =
                        item.policy[1].vesting_duration_seconds;
                    const seconds_cliff = item.policy[1].vesting_cliff_seconds;
                    const begin_balance = item.policy[1].begin_balance;
                    const claimed_percentage = 1 - balance / begin_balance;
                    const seconds_remaining = Math.max(
                        seconds_period - seconds_earned,
                        0
                    );
                    days_remaining = utils.format_number(
                        seconds_remaining / 86400,
                        2
                    );

                    const vested_percentage =
                        seconds_earned >= seconds_period
                            ? 1
                            : seconds_earned < seconds_cliff
                            ? 0
                            : seconds_earned / seconds_period;

                    available_percentage = Math.max(
                        vested_percentage - claimed_percentage,
                        0
                    );
                } else {
                    if (canClaim) {
                        available_percentage = 1;
                    }
                }
            }
            return {
                key: item.id,
                vestingId: item.id,
                vestingType: item.balance_type,
                vestingBalance: {
                    amount: item.balance.amount,
                    asset: item.balance.asset_id
                },
                coinDaysRequired: {
                    days_required,
                    isCoinDays
                },
                coinDaysEarned: {
                    days_earned,
                    isCoinDays
                },
                coinDaysRemaining: {
                    days_remaining,
                    isCoinDays
                },
                availablePercent: available_percentage,
                canClaim,
                vb: item
            };
        });
        mergeState({vesting_balances});
    };

    const retrieveVestingBalances = (accountIdArg?: any) => {
        mergeState({
            loading: true
        });
        const accountId = accountIdArg || account.get("id");
        Apis.instance()
            .db_api()
            .exec("get_vesting_balances", [accountId])
            .then((vesting_balances: any) => {
                mapVestingBalances(vesting_balances);
                mergeState({
                    loading: false
                });
            })
            .catch((err: any) => {
                console.log("error:", err);
                mergeState({
                    loading: false,
                    error: true
                });
            });
    };

    React.useEffect(() => {
        retrieveVestingBalances(account.get("id"));
    }, [account.get("id")]);

    const getHeader = () => {
        return [
            {
                title: "#",
                dataIndex: "vestingId",
                align: "left",
                defaultSortOrder: "ascend",
                sorter: (a: any, b: any) => {
                    return a.vestingId > b.vestingId
                        ? 1
                        : a.vestingId < b.vestingId
                        ? -1
                        : 0;
                }
            },
            {
                title: <Translate content="account.member.balance_type" />,
                dataIndex: "vestingType",
                align: "left",
                sorter: (a: any, b: any) => {
                    return a.vestingType > b.vestingType
                        ? 1
                        : a.vestingType < b.vestingType
                        ? -1
                        : 0;
                },
                render: (item: any) => {
                    return (
                        <span>
                            <Translate content={"account.vesting.type." + item} />
                        </span>
                    );
                }
            },
            {
                title: <Translate content="account.member.cashback" />,
                dataIndex: "vestingBalance",
                align: "left",
                render: (item: any) => {
                    return <FormattedAsset amount={item.amount} asset={item.asset} />;
                }
            },
            {
                title: <Translate content="account.member.required" />,
                dataIndex: "coinDaysRequired",
                align: "left",
                render: (item: any) => {
                    return item.days_required ? (
                        <span>
                            {item.days_required}
                            &nbsp;
                            <Translate
                                content={
                                    item.isCoinDays
                                        ? "account.member.coindays"
                                        : "account.member.days"
                                }
                            />
                        </span>
                    ) : null;
                }
            },
            {
                title: <Translate content="account.member.earned" />,
                dataIndex: "coinDaysEarned",
                align: "left",
                render: (item: any) => {
                    return item.days_earned ? (
                        <span>
                            {item.days_earned}
                            &nbsp;
                            <Translate
                                content={
                                    item.isCoinDays
                                        ? "account.member.coindays"
                                        : "account.member.days"
                                }
                            />
                        </span>
                    ) : null;
                }
            },
            {
                title: <Translate content="account.member.remaining" />,
                dataIndex: "coinDaysRemaining",
                align: "left",
                render: (item: any) => {
                    return item.days_remaining ? (
                        <span>
                            {item.days_remaining}
                            &nbsp;
                            <Translate content="account.member.days" />
                        </span>
                    ) : null;
                }
            },
            {
                title: <Translate content="account.member.available" />,
                dataIndex: "availablePercent",
                align: "left",
                render: (item: any) => {
                    return item ? <span>{(item * 100).toFixed(2)}%</span> : null;
                }
            },
            {
                title: <Translate content="account.member.action" />,
                align: "center",
                render: (item: any) => {
                    return item.canClaim ? (
                        <Button onClick={() => onClaim(item)} type="secondary">
                            <Translate content="account.member.claim" />
                        </Button>
                    ) : null;
                }
            }
        ];
    };

    const onClaim = ({vb}: {vb: any}) => {
        const account_id = account.get("id");
        (WalletActions as any)
            .claimVestingBalance(account_id, vb, false)
            .then(() => {
                retrieveVestingBalances();
            });
    };

    const onSearch = (event: any) => {
        mergeState({
            searchTerm: event.target.value || ""
        });
    };

    const header = getHeader();

    const vb = state.vesting_balances.filter(item => {
        return (
            `${item.vestingId}\0${item.vestingType}`
                .toUpperCase()
                .indexOf(state.searchTerm.toUpperCase()) !== -1
        );
    });

    return (
        <div className="grid-content vertical">
            <Translate component="h1" content="account.vesting.title" />
            <Translate content="account.vesting.explain" component="p" />
            <div className="header-selector padding">
                <SearchInput
                    onChange={onSearch}
                    value={state.searchTerm}
                    autoComplete="off"
                    placeholder={counterpart.translate("exchange.filter")}
                />
                {state.error && (
                    <Translate
                        className="header-selector--error"
                        content="errors.loading_from_blockchain"
                    />
                )}
            </div>
            <div>
                <PaginatedList
                    loading={state.loading}
                    rows={vb}
                    header={header as any}
                    pageSize={10}
                />
            </div>
        </div>
    );
}

export default AccountVesting;
