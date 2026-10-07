// Redux-backed replacement for the Alt.js CreditOfferActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves every method
// name and the exact transaction-building/validation logic the original
// action creators ran, dispatching straight into the Redux store instead
// of going through Alt's dispatcher/`bindListeners`.
//
// `CreditOfferStore.js`'s `onCreate`/`onDisabled`/`onUpdate`/`onAccept`/
// `onRepay` handlers never mutated store state - their only effect was
// triggering a follow-up `CreditOfferActions` call once the submitted
// transaction confirmed (e.g. `onCreate` re-fetching the owner's offer
// list). Since the new Redux reducers must stay pure, that chaining is
// reproduced here instead, inline in each method's `.then()`, exactly
// where the old dispatch-triggered store handler used to run it
// synchronously. Likewise, the pagination chaining the `onGetXxx`
// handlers did when `result.end === false` (fetch the next page) is
// done here, right after dispatching the page that was just fetched.
//
// `create`/`update`/`disabled`/`delete`/`accept`/`repay` all swallow
// their promise rejection (same as the original's `.catch()` dispatching
// `{transaction: null}` rather than rethrowing) - the returned promise
// therefore always resolves, exactly as before, even though call sites
// attach a `.catch()` of their own.
import {Apis} from "bitsharesjs-ws";
import moment from "moment";
import humanizeDuration from "humanize-duration";
import WalletApi from "api/WalletApi";
import {Asset} from "../lib/common/MarketClasses";
import WalletDb from "../stores/WalletDb";
import {reduxStore} from "../store/reduxStore";
import {
    deleteOffer,
    getCreditOffersByOwner as getCreditOffersByOwnerAction,
    getCreditDealsByBorrower as getCreditDealsByBorrowerAction,
    getCreditDealsByOfferOwner as getCreditDealsByOfferOwnerAction,
    getAll as getAllAction
} from "../store/slices/creditOfferSlice";

export const FEE_RATE_DENOM = 1000000; // Denominator for SameT Fund fee calculation
export const listRepayPeriod = [
    43200,
    86400,
    259200,
    604800,
    2592000,
    7776000,
    31536000,
    63072000,
    157680000
];

export const parsingTime = (time: any, locale: string) => {
    if (locale === "zh") locale = "zh_CN" as any;
    return humanizeDuration(parseInt(time) * 1000, {
        language: locale,
        delimiter: " ",
        units: ["d", "h", "m"]
    } as any);
};

class CreditOfferActionsFacade {
    create({
        owner_account,
        asset_type,
        balance,
        fee_rate,
        max_duration_seconds,
        min_deal_amount,
        auto_disable_time,
        acceptable_collateral,
        acceptable_borrowers = [],
        enabled = true,
        fee_asset = "1.3.0"
    }: any) {
        if (fee_asset instanceof Asset) {
            fee_asset = fee_asset.asset_id;
        } else if (typeof fee_asset !== "string") {
            fee_asset = fee_asset.get("id");
        }
        if (typeof asset_type !== "string") {
            asset_type = asset_type.get("id");
        }
        if (auto_disable_time instanceof moment) {
            auto_disable_time = (auto_disable_time as any).toDate();
        }
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("credit_offer_create", {
            fee: {
                amount: 0,
                asset_id: fee_asset
            },
            owner_account,
            asset_type,
            balance,
            fee_rate,
            max_duration_seconds,
            min_deal_amount,
            enabled,
            auto_disable_time,
            acceptable_collateral,
            acceptable_borrowers
        });
        return WalletDb.process_transaction(tr, null, true)
            .then((res: any) => {
                if (res && res.length > 0) {
                    const offer_id = res[0].trx.operation_results[0][1];
                    const created_owner_account =
                        res[0].trx.operations[0][1].owner_account;
                    this.getCreditOffersByOwner({
                        name_or_id: created_owner_account,
                        limit: 1,
                        start_id: offer_id,
                        flag: "create"
                    });
                }
            })
            .catch((error: any) => {
                console.log("CreditOfferActions create ----->", error);
            });
    }

    update({
        owner_account,
        offer_id,
        delta_amount,
        fee_rate,
        max_duration_seconds,
        min_deal_amount,
        enabled = true,
        auto_disable_time,
        acceptable_collateral,
        acceptable_borrowers = [],
        fee_asset = "1.3.0"
    }: any) {
        if (fee_asset instanceof Asset) {
            fee_asset = fee_asset.asset_id;
        } else if (typeof fee_asset !== "string") {
            fee_asset = fee_asset.get("id");
        }
        if (auto_disable_time instanceof moment) {
            auto_disable_time = (auto_disable_time as any).toDate();
        }
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("credit_offer_update", {
            fee: {
                amount: 0,
                asset_id: fee_asset
            },
            owner_account,
            offer_id,
            delta_amount,
            fee_rate,
            max_duration_seconds,
            min_deal_amount,
            enabled,
            auto_disable_time,
            acceptable_collateral,
            acceptable_borrowers
        });
        return WalletDb.process_transaction(tr, null, true)
            .then((res: any) => {
                if (res && res.length > 0) {
                    const op = res[0].trx.operations[0][1];
                    this.getCreditOffersByOwner({
                        name_or_id: op.owner_account,
                        limit: 1,
                        start_id: op.offer_id,
                        flag: "update"
                    });
                }
            })
            .catch((error: any) => {
                console.log("CreditOfferActions update ----->", error);
            });
    }

    disabled({
        owner_account,
        offer_id,
        enabled = false,
        fee_asset = "1.3.0"
    }: any) {
        if (typeof owner_account !== "string") {
            owner_account = owner_account.get("id");
        }
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("credit_offer_update", {
            fee: {
                amount: 0,
                asset_id: fee_asset
            },
            owner_account,
            offer_id,
            enabled
        });
        return WalletDb.process_transaction(tr, null, true)
            .then((res: any) => {
                if (res && res.length > 0) {
                    const disabled_offer_id = res[0].trx.operations[0][1].offer_id;
                    const disabled_owner_account =
                        res[0].trx.operations[0][1].owner_account;
                    this.getCreditOffersByOwner({
                        name_or_id: disabled_owner_account,
                        limit: 1,
                        start_id: disabled_offer_id,
                        flag: "update"
                    });
                }
            })
            .catch((error: any) => {
                console.log("CreditOfferActions disabled ----->", error);
            });
    }

    delete({owner_account, offer_id, fee_asset = "1.3.0"}: any) {
        if (typeof owner_account !== "string") {
            owner_account = owner_account.get("id");
        }
        if (fee_asset instanceof Asset) {
            fee_asset = fee_asset.asset_id;
        } else if (typeof fee_asset !== "string") {
            fee_asset = fee_asset.get("id");
        }
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("credit_offer_delete", {
            fee: {
                amount: 0,
                asset_id: fee_asset
            },
            owner_account,
            offer_id
        });
        return WalletDb.process_transaction(tr, null, true)
            .then((res: any) => {
                reduxStore.dispatch(deleteOffer({transaction: res}));
            })
            .catch((error: any) => {
                console.log("CreditOfferActions delete ----->", error);
            });
    }

    accept({
        borrower,
        offer_id,
        borrow_amount,
        collateral,
        max_fee_rate,
        min_duration_seconds,
        fee_asset = "1.3.0"
    }: any) {
        if (typeof borrower !== "string") {
            borrower = borrower.get("id");
        }
        if (fee_asset instanceof Asset) {
            fee_asset = fee_asset.asset_id;
        } else if (typeof fee_asset !== "string") {
            fee_asset = fee_asset.get("id");
        }
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("credit_offer_accept", {
            fee: {
                amount: 0,
                asset_id: fee_asset
            },
            borrower,
            offer_id,
            borrow_amount,
            collateral,
            max_fee_rate,
            min_duration_seconds
        });
        return WalletDb.process_transaction(tr, null, true)
            .then((res: any) => {
                if (res && res.length > 0) {
                    const accepted_offer_id = res[0].trx.operations[0][1].offer_id;
                    this.getAll({
                        limit: 1,
                        start_id: accepted_offer_id,
                        flag: "update"
                    });
                }
            })
            .catch((error: any) => {
                // Original logs the "delete" label here too (a
                // pre-existing copy-paste mistake, not "accept") -
                // preserved verbatim.
                console.log("CreditOfferActions delete ----->", error);
            });
    }

    repay({account, deal_id, repay_amount, credit_fee, fee_asset = "1.3.0"}: any) {
        if (typeof account !== "string") {
            account = account.get("id");
        }
        if (fee_asset instanceof Asset) {
            fee_asset = fee_asset.asset_id;
        } else if (typeof fee_asset !== "string") {
            fee_asset = fee_asset.get("id");
        }
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("credit_deal_repay", {
            fee: {
                amount: 0,
                asset_id: fee_asset
            },
            account,
            deal_id,
            repay_amount: repay_amount.toObject(),
            credit_fee: credit_fee.toObject()
        });
        return WalletDb.process_transaction(tr, null, true)
            .then((res: any) => {
                if (res && res.length > 0) {
                    const repaid_deal_id = res[0].trx.operations[0][1].deal_id;
                    const repaid_account = res[0].trx.operations[0][1].account;
                    this.getCreditDealsByBorrower({
                        name_or_id: repaid_account,
                        limit: 1,
                        start_id: repaid_deal_id,
                        flag: "update"
                    });
                }
            })
            .catch((error: any) => {
                // Original logs the "create" label here too (a
                // pre-existing copy-paste mistake, not "repay") -
                // preserved verbatim.
                console.log("CreditOfferActions create ----->", error);
            });
    }

    getCreditOffersByOwner({
        name_or_id,
        limit = 100,
        start_id = null,
        flag = false
    }: any) {
        Apis.instance()
            .db_api()
            .exec("get_credit_offers_by_owner", [name_or_id, limit, start_id])
            .then((result: any) => {
                if (result && result.length == limit) {
                    const payload = {
                        list: result,
                        end:
                            flag === false || flag === "first" ? false : true,
                        flag,
                        pars: {name_or_id, limit, start_id}
                    };
                    reduxStore.dispatch(
                        getCreditOffersByOwnerAction(payload)
                    );
                    if (payload.end === false) {
                        const oId = payload.list[
                            payload.list.length - 1
                        ].id.split(".");
                        this.getCreditOffersByOwner({
                            name_or_id: payload.pars.name_or_id,
                            limit: payload.pars.limit,
                            start_id: `${oId[0]}.${oId[1]}.${parseInt(
                                oId[2]
                            ) + 1}`
                        });
                    }
                } else {
                    reduxStore.dispatch(
                        getCreditOffersByOwnerAction({
                            list: result,
                            end: true,
                            flag
                        })
                    );
                }
            })
            .catch((err: any) => {
                console.error(err);
                reduxStore.dispatch(
                    getCreditOffersByOwnerAction({list: [], end: true, flag})
                );
            });
    }

    getCreditDealsByBorrower({
        name_or_id,
        limit = 100,
        start_id = null,
        flag = false
    }: any) {
        Apis.instance()
            .db_api()
            .exec("get_credit_deals_by_borrower", [
                name_or_id,
                limit,
                start_id
            ])
            .then((result: any) => {
                if (result && result.length == limit) {
                    const payload = {
                        list: result,
                        end:
                            flag === false || flag === "first" ? false : true,
                        flag,
                        pars: {name_or_id, limit, start_id}
                    };
                    reduxStore.dispatch(
                        getCreditDealsByBorrowerAction(payload)
                    );
                    if (payload.end === false) {
                        const oId = payload.list[
                            payload.list.length - 1
                        ].id.split(".");
                        this.getCreditDealsByBorrower({
                            name_or_id: payload.pars.name_or_id,
                            limit: payload.pars.limit,
                            start_id: `${oId[0]}.${oId[1]}.${parseInt(
                                oId[2]
                            ) + 1}`
                        });
                    }
                } else {
                    reduxStore.dispatch(
                        getCreditDealsByBorrowerAction({
                            list: result,
                            end: true,
                            flag,
                            pars: {name_or_id, limit, start_id}
                        })
                    );
                }
            })
            .catch((err: any) => {
                console.error(err);
                reduxStore.dispatch(
                    getCreditDealsByBorrowerAction({
                        list: [],
                        end: true,
                        flag
                    })
                );
            });
    }

    getCreditDealsByOfferOwner({
        name_or_id,
        limit = 100,
        start_id = null,
        flag = false
    }: any) {
        Apis.instance()
            .db_api()
            .exec("get_credit_deals_by_offer_owner", [
                name_or_id,
                limit,
                start_id
            ])
            .then((result: any) => {
                if (result && result.length == limit) {
                    const payload = {
                        list: result,
                        end:
                            flag === false || flag === "first" ? false : true,
                        flag,
                        pars: {name_or_id, limit, start_id}
                    };
                    reduxStore.dispatch(
                        getCreditDealsByOfferOwnerAction(payload)
                    );
                    if (payload.end === false) {
                        const oId = payload.list[
                            payload.list.length - 1
                        ].id.split(".");
                        this.getCreditDealsByOfferOwner({
                            name_or_id: payload.pars.name_or_id,
                            limit: payload.pars.limit,
                            start_id: `${oId[0]}.${oId[1]}.${parseInt(
                                oId[2]
                            ) + 1}`
                        });
                    }
                } else {
                    reduxStore.dispatch(
                        getCreditDealsByOfferOwnerAction({
                            list: result,
                            end: true,
                            flag
                        })
                    );
                }
            })
            .catch((err: any) => {
                console.error(err);
                reduxStore.dispatch(
                    getCreditDealsByOfferOwnerAction({
                        list: [],
                        end: true,
                        flag
                    })
                );
            });
    }

    getAll({limit = 100, start_id = null, flag = false}: any) {
        Apis.instance()
            .db_api()
            .exec("list_credit_offers", [limit, start_id])
            .then((result: any) => {
                if (result && result.length == limit) {
                    const payload = {
                        list: result,
                        end:
                            flag === false || flag === "first" ? false : true,
                        flag,
                        pars: {limit, start_id}
                    };
                    reduxStore.dispatch(getAllAction(payload));
                    if (payload.end === false) {
                        const oId = payload.list[
                            payload.list.length - 1
                        ].id.split(".");
                        this.getAll({
                            limit: payload.pars.limit,
                            start_id: `${oId[0]}.${oId[1]}.${parseInt(
                                oId[2]
                            ) + 1}`
                        });
                    }
                } else {
                    reduxStore.dispatch(
                        getAllAction({list: result, end: true, flag})
                    );
                }
            })
            .catch((err: any) => {
                console.error(err);
                reduxStore.dispatch(
                    getAllAction({list: [], end: true, flag})
                );
            });
    }
}

export default new CreditOfferActionsFacade();
