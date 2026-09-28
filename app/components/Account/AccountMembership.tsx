// TypeScript/functional-component port of the legacy AccountMembership.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `upgradeAccount` calls `AccountActions.upgradeAccount` (an on-chain,
// fee-costing membership upgrade) - transcribed verbatim.
//
// Structural change (not a behavior change): `BindToChainState(Component)`
// (four required chain-type props, all four genuinely used in render,
// unlike the similarly-shaped `AccountReferralsTable.tsx` port in an
// earlier batch where three of the four were dead) replaced by a
// Container gating on all four under `useChainStoreTick()`.
//
// `UNSAFE_componentWillMount` (calls `accountUtils.getFinalFeeAsset`
// once, for its side effect - the return value is discarded) is
// replicated with a *mount-only* `useEffect` (`[]` deps) - unlike most
// other lifecycle merges in this migration, there is no
// `componentWillReceiveProps` counterpart here, so this really is
// mount-only, not "mount plus resync on a later prop change".
//
// Dropped as confirmed dead: `UNSAFE_componentWillReceiveProps` (calls
// `this.setState({referralsIndex: []})`) - `state.referralsIndex` is
// never read anywhere in `render()`, and this class's constructor never
// even initializes `this.state` in the first place, so this method's
// only possible effect was scheduling a redundant re-render mid-update
// with no observable output change. Also dropped: the `ref="appTables"`
// legacy string ref (never read anywhere).
import * as React from "react";
import {Link} from "react-router-dom";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import Statistics from "./Statistics";
import AccountActions from "actions/AccountActions";
import TimeAgo from "../Utility/TimeAgo";
import HelpContent from "../Utility/HelpContent";
import accountUtils from "common/account_utils";
import {Tabs, Tab} from "../Utility/Tabs";
import {getWalletName} from "branding";
import {getWalletURL} from "../../branding";
import {Button} from "bitshares-ui-style-guide";
import AccountReferralsTable from "./AccountReferralsTable";
import {settingsAPIs} from "../../api/apiConfig";

const LinkComponent = Link as React.ComponentType<any>;

interface AccountMembershipCoreProps {
    account: any;
    gprops: any;
    dprops: any;
    core_asset: any;
}

function AccountMembership({
    account: accountResolved,
    gprops,
    dprops,
    core_asset
}: AccountMembershipCoreProps) {
    React.useEffect(() => {
        accountUtils.getFinalFeeAsset(accountResolved, "account_upgrade");
    }, []);

    const upgradeAccount = (id: any, lifetime: boolean, e: any) => {
        e.preventDefault();
        (AccountActions as any).upgradeAccount(id, lifetime);
    };

    const account = accountResolved.toJS();

    const ltr = (ChainStore as any).getAccount(account.lifetime_referrer, false);
    if (ltr) account.lifetime_referrer_name = ltr.get("name");
    const ref = (ChainStore as any).getAccount(account.referrer, false);
    if (ref) account.referrer_name = ref.get("name");
    const reg = (ChainStore as any).getAccount(account.registrar, false);
    if (reg) account.registrar_name = reg.get("name");

    const account_name = account.name;

    const network_fee = account.network_fee_percentage / 100;
    const lifetime_fee = account.lifetime_referrer_fee_percentage / 100;
    const referrer_total_fee = 100 - network_fee - lifetime_fee;
    const referrer_fee =
        (referrer_total_fee * account.referrer_rewards_percentage) / 10000;
    const registrar_fee = 100 - referrer_fee - lifetime_fee - network_fee;

    const lifetime_cost =
        (gprops.getIn([
            "parameters",
            "current_fees",
            "parameters",
            8,
            1,
            "membership_lifetime_fee"
        ]) *
            gprops.getIn(["parameters", "current_fees", "scale"])) /
        10000;

    const member_status = (ChainStore as any).getAccountMemberStatus(
        accountResolved
    );
    const membership = "account.member." + member_status;
    let expiration = null;
    if (member_status === "annual")
        expiration = (
            <span>
                (<Translate content="account.member.expires" />{" "}
                <TimeAgo time={account.membership_expiration_date} />)
            </span>
        );
    let expiration_date = account.membership_expiration_date;
    if (expiration_date === "1969-12-31T23:59:59") expiration_date = "Never";
    else if (expiration_date === "1970-01-01T00:00:00")
        expiration_date = "N/A";

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div className="tabs-container generic-bordered-box">
                    <Tabs
                        segmented={false}
                        setting="membershipTab"
                        className="account-tabs"
                        tabsClass="account-overview bordered-header content-block"
                        contentClass="padding"
                    >
                        <Tab title="account.member.membership">
                            <h3>
                                <Translate content={membership} /> {expiration}
                            </h3>

                            <div className="content-block no-margin">
                                <div className="no-margin grid-block vertical large-horizontal">
                                    <div className="grid-block large-12">
                                        <div className="grid-content">
                                            <div className="grid-content">
                                                <div className="grid-block">
                                                    {member_status ===
                                                    "lifetime" ? (
                                                        <div
                                                            className="small-12 large-6"
                                                            style={{
                                                                paddingRight: 10
                                                            }}
                                                        >
                                                            <div className="asset-card">
                                                                <div className="card-divider">
                                                                    <Translate content="account.member.lifetime_title" />
                                                                </div>
                                                                <Translate
                                                                    component="p"
                                                                    content="account.member.referral_info"
                                                                    feesCashback={
                                                                        100 -
                                                                        network_fee
                                                                    }
                                                                />
                                                                <Translate
                                                                    component="h4"
                                                                    content="account.member.referral_link"
                                                                />
                                                                <Translate
                                                                    component="p"
                                                                    content="account.member.referral_text"
                                                                    wallet_name={getWalletName()}
                                                                />
                                                                <h5>
                                                                    {getWalletURL() +
                                                                        `/?r=${account.name}`}
                                                                </h5>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="small-12 large-6"
                                                            style={{
                                                                paddingRight:
                                                                    "10px !important"
                                                            }}
                                                        >
                                                            <HelpContent
                                                                path="components/AccountMembership"
                                                                section="lifetime"
                                                                feesCashback={
                                                                    100 -
                                                                    network_fee
                                                                }
                                                                price={{
                                                                    amount: lifetime_cost,
                                                                    asset: core_asset
                                                                }}
                                                            />
                                                            <br />
                                                            <Button
                                                                type="primary"
                                                                onClick={upgradeAccount.bind(
                                                                    null,
                                                                    account.id,
                                                                    true
                                                                )}
                                                            >
                                                                <Translate content="account.member.upgrade_lifetime" />
                                                            </Button>{" "}
                                                            &nbsp; &nbsp;
                                                            {true ||
                                                            member_status ===
                                                                "annual" ? null : (
                                                                <Button
                                                                    type="primary"
                                                                    onClick={upgradeAccount.bind(
                                                                        null,
                                                                        account.id,
                                                                        false
                                                                    )}
                                                                >
                                                                    <Translate content="account.member.subscribe" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="small-12 large-6">
                                                        <div className="asset-card">
                                                            <div className="card-divider">
                                                                <Translate content="account.member.fee_allocation" />
                                                            </div>

                                                            <table className="table key-value-table">
                                                                <tbody>
                                                                    <tr>
                                                                        <td>
                                                                            <Translate content="account.member.network_percentage" />
                                                                        </td>
                                                                        <td>
                                                                            {
                                                                                network_fee
                                                                            }

                                                                            %
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td>
                                                                            <Translate content="account.member.lifetime_referrer" />{" "}
                                                                            &nbsp;
                                                                            (
                                                                            <LinkComponent
                                                                                to={`/account/${account.lifetime_referrer_name}`}
                                                                            >
                                                                                {
                                                                                    account.lifetime_referrer_name
                                                                                }
                                                                            </LinkComponent>

                                                                            )
                                                                        </td>
                                                                        <td>
                                                                            {
                                                                                lifetime_fee
                                                                            }

                                                                            %
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td>
                                                                            <Translate content="account.member.registrar" />{" "}
                                                                            &nbsp;
                                                                            (
                                                                            <LinkComponent
                                                                                to={`/account/${account.registrar_name}`}
                                                                            >
                                                                                {
                                                                                    account.registrar_name
                                                                                }
                                                                            </LinkComponent>

                                                                            )
                                                                        </td>
                                                                        <td>
                                                                            {
                                                                                registrar_fee
                                                                            }

                                                                            %
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td>
                                                                            <Translate content="account.member.referrer" />{" "}
                                                                            &nbsp;
                                                                            (
                                                                            <LinkComponent
                                                                                to={`/account/${account.referrer_name}`}
                                                                            >
                                                                                {
                                                                                    account.referrer_name
                                                                                }
                                                                            </LinkComponent>

                                                                            )
                                                                        </td>
                                                                        <td>
                                                                            {
                                                                                referrer_fee
                                                                            }

                                                                            %
                                                                        </td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td>
                                                                            <Translate content="account.member.membership_expiration" />{" "}
                                                                        </td>
                                                                        <td>
                                                                            {
                                                                                expiration_date
                                                                            }
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        <div className="asset-card">
                                                            <div className="card-divider">
                                                                <Translate content="account.member.fees_cashback" />
                                                            </div>
                                                            <table className="table key-value-table">
                                                                <Statistics
                                                                    stat_object={
                                                                        account.statistics
                                                                    }
                                                                />
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid-block large-12">
                                        <div className="grid-content">
                                            <div className="grid-content">
                                                <div className="grid-block">
                                                    <div className="small-12 large-6">
                                                        <div className="asset-card">
                                                            <div className="card-divider">
                                                                <Translate content="account.member.fee_pending" />
                                                            </div>
                                                            <Translate
                                                                component="p"
                                                                content="account.member.fee_pending_text"
                                                                account={
                                                                    account_name
                                                                }
                                                                maintenanceInterval={gprops.getIn(
                                                                    [
                                                                        "parameters",
                                                                        "maintenance_interval"
                                                                    ]
                                                                )}
                                                                nextMaintenanceTime={dprops.get(
                                                                    "next_maintenance_time"
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="asset-card">
                                                            <div className="card-divider">
                                                                <Translate content="account.member.fee_vesting" />
                                                            </div>
                                                            <Translate
                                                                component="p"
                                                                content="account.member.fee_vesting_text"
                                                                account={
                                                                    account_name
                                                                }
                                                                vestingThresholdAmount={
                                                                    gprops.getIn([
                                                                        "parameters",
                                                                        "cashback_vesting_threshold"
                                                                    ]) /
                                                                    Math.pow(
                                                                        10,
                                                                        core_asset.get(
                                                                            "precision"
                                                                        )
                                                                    )
                                                                }
                                                                vestingThresholdAsset={core_asset.get(
                                                                    "symbol"
                                                                )}
                                                                vestingPeriod={
                                                                    gprops.getIn([
                                                                        "parameters",
                                                                        "cashback_vesting_period_seconds"
                                                                    ]) /
                                                                    60 /
                                                                    60 /
                                                                    24
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="small-12 large-6">
                                                        <div className="asset-card">
                                                            <div className="card-divider">
                                                                <Translate content="account.member.fee_division" />
                                                            </div>
                                                            <Translate
                                                                component="p"
                                                                content="account.member.fee_division_text.paragraph_1"
                                                                account={
                                                                    account_name
                                                                }
                                                                fee_share_network={
                                                                    network_fee
                                                                }
                                                                fee_share_ltm={
                                                                    lifetime_fee
                                                                }
                                                                fee_share_affiliate={
                                                                    referrer_fee
                                                                }
                                                                fee_share_registrar={
                                                                    registrar_fee
                                                                }
                                                            />
                                                            <Translate
                                                                component="p"
                                                                content="account.member.fee_division_text.paragraph_2"
                                                                account={
                                                                    account_name
                                                                }
                                                                fee_share_network={
                                                                    network_fee
                                                                }
                                                                fee_share_ltm={
                                                                    lifetime_fee
                                                                }
                                                                fee_share_affiliate={
                                                                    referrer_fee
                                                                }
                                                                fee_share_registrar={
                                                                    registrar_fee
                                                                }
                                                            />

                                                            <LinkComponent
                                                                to={`/account/${account_name}/vesting`}
                                                            >
                                                                <Translate
                                                                    component="p"
                                                                    content="account.member.fee_division_text.paragraph_3"
                                                                />
                                                            </LinkComponent>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {member_status == "lifetime" &&
                            settingsAPIs.ES_WRAPPER_LIST.length > 0 ? ( // fixme access to ES could be wrapped in a store or something else
                                <div className="asset-card">
                                    <div className="card-divider">
                                        <Translate content="account.member.ref_distribution" />
                                    </div>
                                    <AccountReferralsTable account={account_name} />
                                </div>
                            ) : null}
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

interface AccountMembershipProps {
    account: string;
    gprops?: string;
    dprops?: string;
    core_asset?: string;
}

function AccountMembershipContainer({
    account,
    gprops = "2.0.0",
    dprops = "2.1.0",
    core_asset = "1.3.0"
}: AccountMembershipProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, undefined);
    const resolvedGprops = ChainStore.getObject(gprops);
    const resolvedDprops = ChainStore.getObject(dprops);
    const resolvedCoreAsset = ChainStore.getAsset(core_asset);

    if (
        !resolvedAccount ||
        !resolvedGprops ||
        !resolvedDprops ||
        !resolvedCoreAsset
    ) {
        return <span />;
    }

    return (
        <AccountMembership
            account={resolvedAccount}
            gprops={resolvedGprops}
            dprops={resolvedDprops}
            core_asset={resolvedCoreAsset}
        />
    );
}

export default AccountMembershipContainer;
