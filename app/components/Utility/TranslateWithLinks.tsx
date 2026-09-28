// TypeScript/functional-component port of the legacy TranslateWithLinks
// .jsx (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic
// changes.
//
// `shouldComponentUpdate` (`!utils.are_equal_shallow(nextProps.keys,
// this.props.keys)`) is a pure props shallow-equality performance guard,
// with no other side effects - not replicated, per this migration's
// established treatment of pure perf guards.
//
// Preserved verbatim (real pre-existing bugs, not "fixed"):
// - `if (splitText.indexOf(key.arg))` - `Array.prototype.indexOf` returns
//   `-1` (truthy) when not found and a real index (falsy only when `0`)
//   when found, so a `key.arg` that happens to be the very first element
//   of `splitText` is silently skipped (the condition is `if (0)`,
//   i.e. false) - should almost certainly be `!== -1`, but isn't.
// - the `"icon"` case's `let title = name.replace("-", "_");` references
//   a bare `name` identifier that isn't `key.value` or anything else in
//   scope - at runtime it resolves to the browser global `window.name`
//   (normally `""`), so `title` is in practice always an empty string
//   regardless of the icon being rendered. Written here as an explicit
//   `window.name` (TypeScript's own inference for the *bare* identifier
//   in this scope didn't match the DOM global, so the bare form didn't
//   typecheck) - behaviorally identical at runtime, since the bare
//   identifier would have resolved to the exact same global.
//
//  Given a string and a list of interpolation parameters, this component
//  will translate that string and replace the following:
//
//  account ids/names with links to accounts
//  asset ids/names with links to assets
//  amounts with fully formatted amounts with asset symbol
//  prices with fully formatted prices with symbols
//
//  Expected Properties:
//     string:  translation string key. Objects to interpolate should be wrapped in curly brackets: {amount}
//     keys: array of objects to interpolate in the string.
//         lookup goes by arg, which should match the name given inside the curly brackets in the translation string
//         example:
//         [{
//             type: "account"|"amount"|"asset"|"price",
//             value: "1.2.1"|{amount: 10, asset_id: "1.3.0"}|"1.3.1"|{base: {amount: 1, asset_id: "1.3.0"}, quote: {amount: 100, asset_id: "1.3.20"}}},
//             arg: "account"|"amount"|"asset"|"price",
//             decimalOffset: 1 (optional, only used for amounts)
//         }
//         ]
//     params: object contaning simple strings to be interpolated using standard counterpart syntax: %(string)s
import * as React from "react";
import counterpart from "counterpart";
import utils from "common/utils";
import LinkToAccountById from "../Utility/LinkToAccountById";
import LinkToAssetById from "../Utility/LinkToAssetById";
import {Link} from "react-router-dom";
import FormattedAsset from "../Utility/FormattedAsset";
import FormattedPrice from "../Utility/FormattedPrice";
import AssetName from "../Utility/AssetName";
import Translate from "react-translate-component";
import Icon from "../Icon/Icon";

const LinkComponent = Link as React.ComponentType<any>;

interface TranslateWithLinksProps {
    string: string;
    params?: any;
    keys: any[];
    noLink?: boolean;
    noTip?: boolean;
}

export default function TranslateWithLinks({
    string,
    params,
    keys,
    noLink,
    noTip
}: TranslateWithLinksProps) {
    const linkToAccount = (name_or_id: any): React.ReactNode => {
        if (!name_or_id) return <span>-</span>;
        return utils.is_object_id(name_or_id) ? (
            <LinkToAccountById account={name_or_id} noLink={noLink} />
        ) : noLink ? (
            <span>{name_or_id}</span>
        ) : (
            <LinkComponent to={`/account/${name_or_id}/overview`}>
                {name_or_id}
            </LinkComponent>
        );
    };

    const linkToAsset = (symbol_or_id: any): React.ReactNode => {
        if (!symbol_or_id) return <span>-</span>;
        return utils.is_object_id(symbol_or_id) ? (
            <LinkToAssetById asset={symbol_or_id} noLink={noLink} />
        ) : noLink ? (
            <AssetName name={symbol_or_id} dataPlace="top" noTip={noTip} />
        ) : (
            <LinkComponent to={`/asset/${symbol_or_id}`}>
                <AssetName name={symbol_or_id} dataPlace="top" noTip={noTip} />
            </LinkComponent>
        );
    };

    const text = counterpart.translate(string, params);
    const splitText: any[] = utils.get_translation_parts(text);

    keys.forEach(key => {
        if (splitText.indexOf(key.arg)) {
            let value: any;
            switch (key.type) {
                case "account":
                    value = linkToAccount(key.value);
                    break;

                case "amount":
                    value = (
                        <span>
                            <FormattedAsset
                                amount={key.value.amount}
                                asset={key.value.asset_id}
                                decimalOffset={key.decimalOffset}
                                hide_asset
                            />
                            &nbsp;
                            {linkToAsset(key.value.asset_id)}
                        </span>
                    );

                    break;

                case "price":
                    value = (
                        <FormattedPrice
                            base_asset={key.value.base.asset_id}
                            base_amount={key.value.base.amount}
                            quote_asset={key.value.quote.asset_id}
                            quote_amount={key.value.quote.amount}
                        />
                    );
                    break;

                case "asset":
                    value = linkToAsset(key.value);
                    break;

                case "translate":
                    value = <Translate content={key.value} />;
                    break;

                case "link":
                    value = (
                        <LinkComponent
                            to={key.value}
                            data-intro={key.dataIntro ? key.dataIntro : null}
                        >
                            <Translate content={key.translation} />
                        </LinkComponent>
                    );
                    break;

                case "icon": {
                    const title = (window.name as string).replace("-", "_");
                    value = (
                        <Icon
                            className={key.className}
                            name={key.value}
                            title={title}
                        />
                    );
                    break;
                }

                case "change":
                    if (key.value && Object.keys(key.value).length > 0) {
                        const {votes, active, owner, memo} = key.value;
                        const voteDiv = votes && (
                            <div>
                                <Translate content={"proposal.votes"} />
                                {votes.minus.length ? (
                                    <div>
                                        {"- " +
                                            counterpart.translate(
                                                "proposal.remove"
                                            ) +
                                            " "}{" "}
                                        {votes.minus.join(", ")}
                                    </div>
                                ) : null}
                                {votes.plus.length ? (
                                    <div>
                                        {"- " +
                                            counterpart.translate(
                                                "proposal.add"
                                            ) +
                                            " "}{" "}
                                        {votes.plus.join(", ")}
                                    </div>
                                ) : null}
                            </div>
                        );
                        const warning = (active || owner || memo) && (
                            <div>
                                <Translate
                                    content={"proposal.permission_changes"}
                                />
                                {", "}
                                <Translate
                                    style={{color: "red"}}
                                    content={"proposal.danger_operation"}
                                />
                                {"!"}
                            </div>
                        );
                        const activeDiv = active && (
                            <React.Fragment>
                                <Translate
                                    content={"proposal.changes_to_active"}
                                />
                                <div style={{marginLeft: "0.5rem"}}>
                                    {(active.keys.plus.length > 0 ||
                                        active.accounts.plus.length > 0) && (
                                        <div>
                                            {"- " +
                                                counterpart.translate(
                                                    "proposal.add"
                                                ) +
                                                " "}
                                            {active.keys.plus.join(", ")}
                                            {active.keys.plus.length > 0 &&
                                                active.accounts.plus.length >
                                                    0 &&
                                                ", "}
                                            {active.accounts.plus.length > 0
                                                ? active.accounts.plus
                                                      .map((_tmp: any) => (
                                                          <span key={_tmp}>
                                                              {linkToAccount(
                                                                  _tmp
                                                              )}
                                                          </span>
                                                      ))
                                                      .reduce(
                                                          (prev: any, curr: any) => [
                                                              prev,
                                                              ", ",
                                                              curr
                                                          ]
                                                      )
                                                : ""}
                                        </div>
                                    )}
                                    {(active.keys.minus.length > 0 ||
                                        active.accounts.minus.length > 0) && (
                                        <div>
                                            {"- " +
                                                counterpart.translate(
                                                    "proposal.remove"
                                                ) +
                                                " "}
                                            {active.keys.minus.join(", ")}
                                            {active.keys.minus.length > 0 &&
                                                active.accounts.minus.length >
                                                    0 &&
                                                ", "}
                                            {active.accounts.minus.length > 0
                                                ? active.accounts.minus
                                                      .map((_tmp: any) => (
                                                          <span key={_tmp}>
                                                              {linkToAccount(
                                                                  _tmp
                                                              )}
                                                          </span>
                                                      ))
                                                      .reduce(
                                                          (prev: any, curr: any) => [
                                                              prev,
                                                              ", ",
                                                              curr
                                                          ]
                                                      )
                                                : ""}
                                        </div>
                                    )}
                                    {active.weight_threshold && (
                                        <div>
                                            {"- " +
                                                counterpart.translate(
                                                    "proposal.set_threshold",
                                                    {
                                                        threshold:
                                                            active.weight_threshold
                                                    }
                                                )}
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                        const ownerDiv = owner && (
                            <React.Fragment>
                                <Translate content={"proposal.changes_to_owner"} />
                                <div style={{marginLeft: "0.5rem"}}>
                                    {(owner.keys.plus.length > 0 ||
                                        owner.accounts.plus.length > 0) && (
                                        <div>
                                            {"- " +
                                                counterpart.translate(
                                                    "proposal.add"
                                                ) +
                                                " "}
                                            {owner.keys.plus.join(", ")}
                                            {owner.keys.plus.length > 0 &&
                                                owner.accounts.plus.length >
                                                    0 &&
                                                ", "}
                                            {owner.accounts.plus.length > 0
                                                ? owner.accounts.plus
                                                      .map((_tmp: any) => (
                                                          <span key={_tmp}>
                                                              {linkToAccount(
                                                                  _tmp
                                                              )}
                                                          </span>
                                                      ))
                                                      .reduce(
                                                          (prev: any, curr: any) => [
                                                              prev,
                                                              ", ",
                                                              curr
                                                          ]
                                                      )
                                                : ""}
                                        </div>
                                    )}
                                    {(owner.keys.minus.length > 0 ||
                                        owner.accounts.minus.length > 0) && (
                                        <div>
                                            {"- " +
                                                counterpart.translate(
                                                    "proposal.remove"
                                                ) +
                                                " "}
                                            {owner.keys.minus.join(", ")}
                                            {owner.keys.minus.length > 0 &&
                                                owner.accounts.minus.length >
                                                    0 &&
                                                ", "}
                                            {owner.accounts.minus.length > 0
                                                ? owner.accounts.minus
                                                      .map((_tmp: any) => (
                                                          <span key={_tmp}>
                                                              {linkToAccount(
                                                                  _tmp
                                                              )}
                                                          </span>
                                                      ))
                                                      .reduce(
                                                          (prev: any, curr: any) => [
                                                              prev,
                                                              ", ",
                                                              curr
                                                          ]
                                                      )
                                                : ""}
                                        </div>
                                    )}
                                    {owner.weight_threshold && (
                                        <div>
                                            {"- " +
                                                counterpart.translate(
                                                    "proposal.set_threshold",
                                                    {
                                                        threshold:
                                                            owner.weight_threshold
                                                    }
                                                )}
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                        const memoDiv = memo &&
                            (memo.keys.plus.length > 0 ||
                                memo.keys.minus.length > 0) && (
                                <div>
                                    <Translate content={"proposal.changes_to_memo"} />
                                    {memo.keys.plus.length > 0 && (
                                        <div> + {memo.keys.plus.join(", ")}</div>
                                    )}
                                    {memo.keys.minus.length > 0 && (
                                        <div> - {memo.keys.minus.join(", ")}</div>
                                    )}
                                </div>
                            );
                        value = (
                            <div
                                style={{
                                    marginLeft: "0.5rem",
                                    marginTop: "0.5rem"
                                }}
                            >
                                {warning}
                                {voteDiv}
                                {activeDiv}
                                {ownerDiv}
                                {memoDiv}
                            </div>
                        );
                    } else {
                        value = "";
                    }
                    break;
                case "date":
                    if (key.value === null) {
                        value = "-";
                    } else {
                        value = counterpart.localize(key.value, {
                            type: "date",
                            format: "full"
                        });
                    }
                    break;

                default:
                    value = key.value;
                    break;
            }

            splitText[splitText.indexOf(key.arg)] = value;
        }
    });

    const finalText = splitText.map((text, index) => {
        return <span key={index}>{text}</span>;
    });

    return <span>{finalText}</span>;
}
