// TypeScript/functional-component port of the legacy
// AssetFeedProducers.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Preserved verbatim: the file is named `AssetFeedProducers.jsx` but the
// class inside is `AccountFeedProducers` - a pre-existing filename/export
// name mismatch, not touched here.
import * as React from "react";
import AccountSelector from "../Account/AccountSelector";
import LinkToAccountById from "../Utility/LinkToAccountById";
import Translate from "react-translate-component";
import Icon from "../Icon/Icon";

interface AccountFeedProducersProps {
    witnessFed?: boolean;
    committeeFed?: boolean;
    producers: any[];
    onChangeList: (action: string, id: any) => void;
    [key: string]: any;
}

export default function AccountFeedProducers({
    witnessFed,
    committeeFed,
    producers,
    onChangeList
}: AccountFeedProducersProps) {
    const [producer_name, setProducerName] = React.useState<string | null>(null);
    const [new_producer_id, setNewProducerId] = React.useState<any>(undefined);

    const onAccountChanged = (account: any) => {
        setNewProducerId(account ? account.get("id") : null);
    };

    const onAccountNameChanged = (name: string) => {
        setProducerName(name);
    };

    if (witnessFed || committeeFed) {
        return (
            <div className="grid-content small-12 large-8 large-offset-2">
                <Translate
                    component="p"
                    content="account.user_issued_assets.feed_not_allowed_1"
                    className="has-error"
                />
                <Translate
                    component="p"
                    content="account.user_issued_assets.feed_not_allowed_2"
                />
            </div>
        );
    }

    return (
        <div className="grid-content small-12 large-8 large-offset-2">
            <table className="table dashboard-table table-hover">
                <thead>
                    <tr>
                        <th />
                        <th style={{textAlign: "left"}}>
                            <Translate content="explorer.account.title" />
                        </th>
                        <th>
                            <Translate content="account.perm.remove_text" />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {producers.map((a, i) => {
                        return (
                            <tr key={a}>
                                <td style={{textAlign: "left"}}>#{i + 1}</td>
                                <td style={{textAlign: "left"}}>
                                    <LinkToAccountById account={a} />
                                </td>
                                <td
                                    className="clickable"
                                    onClick={onChangeList.bind(null, "remove", a)}
                                >
                                    <Icon
                                        name="cross-circle"
                                        title="icons.cross_circle.remove"
                                        className="icon-14px"
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div style={{paddingTop: "2rem"}}>
                <AccountSelector
                    label={"account.user_issued_assets.add_feed"}
                    accountName={producer_name}
                    account={producer_name}
                    onChange={onAccountNameChanged}
                    onAccountChanged={onAccountChanged}
                    error={null}
                    tabIndex={1}
                    action_label="account.perm.confirm_add"
                    onAction={onChangeList.bind(null, "add", new_producer_id)}
                />
            </div>
        </div>
    );
}
