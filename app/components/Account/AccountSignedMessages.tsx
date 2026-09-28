// TypeScript/functional-component port of the legacy
// AccountSignedMessages.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `_tabSMSignAction`/`_tabVMAction`
// call `SignedMessageAction.signMessage`/`verifyMemo` (signing/verifying
// messages with the account's memo key) - transcribed verbatim, no
// restructuring.
//
// Structural change (not a behavior change): `BindToChainState(Component)`
// (required `account`) replaced by a Container under
// `useChainStoreTick()`.
//
// The many `tabsm_*`/`tabvm_*` state fields are kept as one combined
// state object (matching the original's single `this.state`), updated
// via a shallow-merge helper - the same pattern used for `SignedMessage
// .tsx`/`FeeAssetSelector.tsx`/`AccountReferralsTable.tsx` in earlier
// batches. The initial `tabsm_memo_key` value (read once from
// `account.get("options").get("memo_key")`, the original's own "do not
// use setState method!" constructor comment underscoring that it's a
// one-time initializer) is replicated with a `useState` lazy
// initializer, matching that "freeze at mount" semantics exactly.
//
// Dropped as confirmed dead: the `ref="appTables"` (outer div) and
// `ref="memo_key"` (on `<PubKeyInput>`) legacy string refs - grepped the
// whole file, neither `this.refs.appTables` nor `this.refs.memo_key` is
// ever read.
//
// Preserved verbatim (not "fixed"): the verify-on-change toggle's
// `<table><tr>...` has no `<tbody>` wrapper (invalid nesting - React
// logs a `validateDOMNesting` warning for this, unlike raw HTML parsing,
// which would insert one implicitly); and the popup message next to the
// "Verify" button uses a bare `<text>` tag (an SVG element, not a
// standard HTML one, used here outside any `<svg>`) rather than `<span>`.
//
//  This component gives a user interface for signing and verifying
//  messages with the bitShares memo key.
//  It consists of two tabs:
//    - Sign message tab (code prefix: tabSM)
//    - Verify message tab (code prefix: tabVM)
//
//  See SignedMessageAction for details on message format.
//
//    @author Stefan Schiessl <stefan.schiessl@blockchainprojectsbv.com>
import * as React from "react";
import Translate from "react-translate-component";
import PubKeyInput from "../Forms/PubKeyInput";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {Tabs, Tab} from "../Utility/Tabs";
import counterpart from "counterpart";
import SignedMessageAction from "../../actions/SignedMessageAction";
import SignedMessage from "../Account/SignedMessage";
import {Switch} from "bitshares-ui-style-guide";

interface AccountSignedMessagesState {
    tabsm_memo_key: any;
    tabsm_popup: string;
    tabsm_message_text: string;
    tabsm_message_signed: any;
    tabvm_popup: string;
    tabvm_message_signed: string;
    tabvm_verified: boolean | null;
    tabvm_message_signed_and_verified: any;
    tabvm_flag_verifyonchange: boolean;
}

interface AccountSignedMessagesCoreProps {
    account: any;
}

function AccountSignedMessages({account}: AccountSignedMessagesCoreProps) {
    // initialize state (do not use setState method!)
    const [state, setState] = React.useState<AccountSignedMessagesState>(() => ({
        tabsm_memo_key: account.get("options").get("memo_key"),
        tabsm_popup: "",
        tabsm_message_text: "",
        tabsm_message_signed: "",
        tabvm_popup: "",
        tabvm_message_signed: "",
        tabvm_verified: null,
        tabvm_message_signed_and_verified: null,
        tabvm_flag_verifyonchange: false
    }));

    const mergeState = (partial: Partial<AccountSignedMessagesState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    /**
     * Displays an information to the user that disappears over time
     *
     * @param message
     * @param timeout
     */
    const tabSMPopMessage = (message: string, timeout = 3000) => {
        mergeState({
            tabsm_popup: message
        });

        if (message !== "" && timeout > 0) {
            setTimeout(() => {
                mergeState({
                    tabsm_popup: ""
                });
            }, timeout);
        }
    };

    /**
     * Event when user pushes sign button. Memo message and meta will be
     * signed and displayed in the bottom textarea
     *
     * @param event
     */
    const tabSMSignAction = (event: any) => {
        event.preventDefault();

        try {
            // validate keys are still the same. Better: make public memokey field uneditable
            const storedKey = account.get("options").get("memo_key");
            if (state.tabsm_memo_key !== storedKey) {
                throw Error(
                    counterpart.translate("account.signedmessages.keymismatch")
                );
            }

            // there should be a message entered
            if (state.tabsm_message_text) {
                tabSMPopMessage(
                    counterpart.translate("account.signedmessages.signing"),
                    0
                );
                (SignedMessageAction as any)
                    .signMessage(account, state.tabsm_message_text)
                    .then((res: any) => {
                        mergeState({
                            tabsm_message_signed: res,
                            tabsm_popup: "" // clear loading message
                        });
                    })
                    .catch((err: any) => {
                        tabSMPopMessage(err.message);
                        mergeState({
                            tabsm_message_signed: null
                        });
                    });
            }
        } catch (err) {
            tabSMPopMessage((err as any).message);
            mergeState({
                tabsm_message_signed: null
            });
        }
    };

    const tabSMHandleChange = (event: any) => {
        // event for textarea
        mergeState({tabsm_message_text: event.target.value});
    };

    const tabSMHandleChangeKey = (value: any) => {
        // event for textfield of public key
        mergeState({tabsm_memo_key: value});
    };

    const tabSMCopyToClipBoard = (event: any) => {
        // event when user clicks into the signed message textarea
        if (event.target.value !== "") {
            event.target.focus();
            event.target.select();

            try {
                const successful = document.execCommand("copy");
                tabSMPopMessage(
                    successful
                        ? counterpart.translate(
                              "account.signedmessages.copysuccessful"
                          )
                        : counterpart.translate(
                              "account.signedmessages.copyunsuccessful"
                          )
                );
            } catch (err) {
                tabSMPopMessage(
                    counterpart.translate(
                        "account.signedmessages.copyunsuccessful"
                    )
                );
            }
        }
    };

    /**
     * Displays an information to the user that disappears over time
     *
     * @param message
     * @param timeout
     */
    const tabVMPopMessage = (message: string, timeout = 3000) => {
        mergeState({
            tabvm_popup: message
        });

        if (message !== "" && timeout > 0) {
            setTimeout(() => {
                mergeState({
                    tabvm_popup: ""
                });
            }, timeout);
        }
    };

    /**
     * Event when the user tries to verify a message, either manual
     * through the button or onChange of the textarea. The message is
     * parsed and verified, the user gets the message restated in the
     * bottom part of the site
     *
     * @param event
     */
    const tabVMAction = (event: any) => {
        event.preventDefault();

        // reset to unverified state
        mergeState({
            tabvm_message_signed_and_verified: null,
            tabvm_verified: false
        });

        // attempt verifying
        if (state.tabvm_message_signed) {
            tabVMPopMessage(
                counterpart.translate("account.signedmessages.verifying"),
                0
            );

            setTimeout(() => {
                // do not block gui
                try {
                    const message_signed_and_verified = (SignedMessageAction as any).verifyMemo(
                        state.tabvm_message_signed
                    );
                    mergeState({
                        tabvm_message_signed_and_verified: message_signed_and_verified,
                        tabvm_verified: true,
                        tabvm_popup: "" // clear verifying message
                    });
                } catch (err) {
                    tabVMPopMessage((err as any).message);
                    mergeState({
                        tabvm_message_signed_and_verified: null,
                        tabvm_verified: false
                    });
                }
            }, 0);
        }
    };

    const tabVMHandleChange = (event: any) => {
        // onchange event of the input textarea
        mergeState({
            tabvm_message_signed: event.target.value,
            tabvm_verified: false,
            tabvm_message_signed_and_verified: null
        });
        if (state.tabvm_flag_verifyonchange) {
            tabVMAction(event);
        }
    };

    const tabVMToggleVerifyOnChange = () => {
        // event when the user enables / disables verifying while typing
        mergeState({
            tabvm_flag_verifyonchange: !state.tabvm_flag_verifyonchange
        });
    };

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div className="tabs-container generic-bordered-box">
                    <Tabs
                        className="account-tabs"
                        tabsClass="account-overview no-padding bordered-header content-block"
                        setting="accountSignedMessagesTab"
                        contentClass="grid-content shrink small-vertical medium-horizontal padding"
                        segmented={false}
                    >
                        <Tab title="account.signedmessages.signmessage">
                            <div className="grid-content" style={{overflowX: "hidden"}}>
                                <div className="content-block no-margin">
                                    <h3>
                                        <Translate content="account.signedmessages.signmessage" />
                                    </h3>
                                </div>
                                <PubKeyInput
                                    value={state.tabsm_memo_key}
                                    label="account.perm.memo_public_key"
                                    placeholder="Public Key"
                                    tabIndex={7}
                                    onChange={tabSMHandleChangeKey}
                                    disableActionButton={true}
                                />
                                <br />
                                <textarea
                                    rows={10}
                                    value={state.tabsm_message_text}
                                    onChange={tabSMHandleChange}
                                    placeholder={counterpart.translate(
                                        "account.signedmessages.entermessage"
                                    )}
                                />
                                <span>
                                    <button className="button" onClick={tabSMSignAction}>
                                        <Translate content="account.signedmessages.sign" />
                                    </button>
                                    <div style={{color: "gray"}}>
                                        {state.tabsm_popup}
                                    </div>
                                </span>
                                <br />
                                <br />
                                <textarea
                                    rows={14}
                                    value={state.tabsm_message_signed}
                                    style={{editable: false} as any}
                                    placeholder={counterpart.translate(
                                        "account.signedmessages.automaticcreation"
                                    )}
                                    onClick={tabSMCopyToClipBoard}
                                />
                            </div>
                        </Tab>

                        <Tab title="account.signedmessages.verifymessage">
                            <div className="grid-content" style={{overflowX: "hidden"}}>
                                <div className="content-block no-margin">
                                    <h3>
                                        <Translate content="account.signedmessages.verifymessage" />
                                    </h3>
                                    <div
                                        style={{
                                            float: "right",
                                            marginTop: "0.1em",
                                            marginBottom: "0.5em"
                                        }}
                                    >
                                        <table>
                                            <tr>
                                                <td>
                                                    <label
                                                        style={{
                                                            marginBottom: 0,
                                                            marginRight: "0.5rem"
                                                        }}
                                                    >
                                                        <Translate content="account.signedmessages.verifyonchange" />
                                                    </label>
                                                </td>
                                                <td>
                                                    <Switch
                                                        checked={
                                                            state.tabvm_flag_verifyonchange
                                                        }
                                                        onChange={
                                                            tabVMToggleVerifyOnChange
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                                <textarea
                                    rows={10}
                                    value={state.tabvm_message_signed}
                                    onChange={tabVMHandleChange}
                                    placeholder={counterpart.translate(
                                        "account.signedmessages.entermessage"
                                    )}
                                />
                                <span>
                                    <button className="button" onClick={tabVMAction}>
                                        <Translate content="account.signedmessages.verify" />
                                    </button>
                                    <text style={{color: "gray"} as any}>
                                        {state.tabvm_popup}
                                    </text>
                                    {state.tabvm_verified !== null && (
                                        <div style={{float: "right"}}>
                                            Message is:
                                            <div
                                                style={{
                                                    backgroundColor: state.tabvm_verified
                                                        ? "green"
                                                        : "red"
                                                }}
                                            >
                                                <label>
                                                    {state.tabvm_verified
                                                        ? "verified"
                                                        : "not verified"}
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                    {((state.tabvm_verified &&
                                        state.tabvm_message_signed_and_verified !==
                                            null) ||
                                        state.tabvm_flag_verifyonchange) && (
                                        <div>
                                            <br />
                                            <SignedMessage
                                                message={state.tabvm_message_signed}
                                            />
                                        </div>
                                    )}
                                </span>
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

interface AccountSignedMessagesProps {
    account: string;
}

function AccountSignedMessagesContainer({account}: AccountSignedMessagesProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, undefined);

    if (!resolvedAccount) {
        return <span />;
    }

    return <AccountSignedMessages account={resolvedAccount} />;
}

export default AccountSignedMessagesContainer;
