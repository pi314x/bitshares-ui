// TypeScript port of the legacy AccountWhitelist.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. The
// `BindToChainState.Wrapper` render-prop usage is kept exactly as-is
// (not part of this migration's BindToChainState-replacement scope,
// which targets the `BindToChainState(Component)` HOC wrapping pattern,
// not this inline render-prop form).
/* eslint-disable react/display-name */
import * as React from "react";
import Translate from "react-translate-component";
import BindToChainState from "../../Utility/BindToChainState";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import account_constants from "chain/account_constants";

const BindToChainStateWrapper = (BindToChainState as any).Wrapper;

interface AccountWhitelistProps {
    op: any;
    fromComponent?: string;
}

export const AccountWhitelist = ({
    op,
    fromComponent
}: AccountWhitelistProps) => {
    const listings = (account_constants as any).account_listing;
    const label =
        op[1].new_listing === listings.no_listing
            ? "unlisted_by"
            : op[1].new_listing === listings.white_listed
            ? "whitelisted_by"
            : "blacklisted_by";
    if (fromComponent === "proposed_operation") {
        return (
            <span>
                <BindToChainStateWrapper
                    lister={op[1].authorizing_account}
                    listee={op[1].account_to_list}
                >
                    {({lister, listee}: any) => (
                        <Translate
                            component="span"
                            content={"transaction." + label}
                            lister={lister.get("name")}
                            listee={listee.get("name")}
                        />
                    )}
                </BindToChainStateWrapper>
            </span>
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string={"operation." + label}
                    keys={[
                        {
                            type: "account",
                            value: op[1].authorizing_account,
                            arg: "lister"
                        },
                        {
                            type: "account",
                            value: op[1].account_to_list,
                            arg: "listee"
                        }
                    ]}
                />
            </span>
        );
    }
};
