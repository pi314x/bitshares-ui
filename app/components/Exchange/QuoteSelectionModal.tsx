// TypeScript/function-component port of the legacy
// QuoteSelectionModal.jsx (Exchange/ final batch,
// docs/UI_MIGRATION_PLAN.md Phase 8). Mechanical translation, no logic
// changes intended.
//
// Not security-sensitive per AGENTS.md (grepped for `WalletDb`/
// `WalletApi`/`Actions\.`/`ApplicationApi\.` - none appear). Calls
// `SettingsActions.modifyPreferedBases` (move up/down/remove/add a
// quote asset in the user's preferred-bases list) - a UI/view-settings
// preference, not wallet/key data - every call site
// (`_onMoveUp`/`_onMoveDown`/`_onRemove`/`_onAdd`) is transcribed with
// the exact same `{oldIndex, newIndex}`/`{remove}`/`{add}` payload
// shapes.
//
// Only state -> hooks, no lifecycle methods in the original (no
// `componentDid*`/`componentWillReceiveProps`/`shouldComponentUpdate`),
// so this is a direct class-to-function translation with no structural
// changes.
//
// `showModal` (passed by the one real caller, `MyMarkets.tsx`) is never
// read anywhere in the original class body (grepped: no match) - kept
// in the props interface below as accepted-but-unused, the same
// treatment this migration gives other similarly-unread Modal props
// (see `Modal/ProposalModal.tsx`'s header comment for the precedent).
//
// Lint-forced trim: the single-element `footer` array's `<Button>` has
// no `key` in the original (a legacy `.jsx` file, not linted - see
// AGENTS.md's note that the full legacy lint isn't a useful signal) -
// `react/jsx-key` is a real error under this file's new lint coverage,
// so `key="close"` is added; with only one array element this can't
// change reconciliation/rendering behavior.
//
// Preserved bugs/quirks, not fixed:
// - `_onFoundBackingAsset` sets `this.setState({isValid: true})`/
//   `{error: ..., isValid: false}`, but the component's actual state
//   field (initialized in the constructor and the only one `render()`
//   ever reads) is named `valid`, not `isValid` - a pre-existing typo.
//   `isValid` is therefore a second, write-only state field that never
//   affects anything, and `valid` itself is a read-only field that's
//   never actually written after being initialized to `false`. Both
//   kept verbatim (`valid` stays in the initial state object unused;
//   `isValid` is still set via `mergeState`, going nowhere) rather than
//   "fixed" into a single correctly-named field.
import * as React from "react";
import Icon from "../Icon/Icon";
import AssetSelector from "../Utility/AssetSelector";
import SettingsActions from "actions/SettingsActions";
import Translate from "react-translate-component";
import counterpart from "counterpart";

import {Modal, Button} from "bitshares-ui-style-guide";

export interface QuoteSelectionModalProps {
    quotes: any;
    visible?: boolean;
    hideModal?: () => void;
    showModal?: () => void;
    [key: string]: any;
}

interface QuoteSelectionModalState {
    backingAsset: string;
    error: any;
    valid: boolean;
    isValid?: boolean;
}

export default function QuoteSelectionModal(props: QuoteSelectionModalProps) {
    const [state, setState] = React.useState<QuoteSelectionModalState>({
        backingAsset: "",
        error: false,
        valid: false
    });
    const mergeState = (patch: Partial<QuoteSelectionModalState>) =>
        setState(prev => ({...prev, ...patch}));

    const onMoveUp = (quote: any) => {
        const idx = props.quotes.findIndex((q: any) => q === quote);
        SettingsActions.modifyPreferedBases({
            oldIndex: idx,
            newIndex: idx - 1
        });
    };

    const onMoveDown = (quote: any) => {
        const idx = props.quotes.findIndex((q: any) => q === quote);
        SettingsActions.modifyPreferedBases({
            oldIndex: idx,
            newIndex: idx + 1
        });
    };

    const onRemove = (quote: any) => {
        const idx = props.quotes.findIndex((q: any) => q === quote);
        if (idx >= 0) {
            SettingsActions.modifyPreferedBases({
                remove: idx
            });
        }
    };

    const onAdd = (quote: any) => {
        const idx = props.quotes.findIndex(
            (q: any) => q === quote.get("symbol")
        );
        if (idx === -1) {
            SettingsActions.modifyPreferedBases({
                add: quote.get("symbol")
            });
        }
    };

    const onInputBackingAsset = (asset: string) => {
        mergeState({
            backingAsset: asset.toUpperCase(),
            error: null
        });
    };

    const onFoundBackingAsset = (asset: any) => {
        if (asset) {
            if (!props.quotes.includes(asset.get("symbol"))) {
                mergeState({isValid: true});
            } else {
                mergeState({
                    error: "Asset already being used",
                    isValid: false
                });
            }
        }
    };

    const {error} = state;
    const quoteCount = props.quotes.size;

    return (
        <Modal
            title={counterpart.translate("exchange.quote_selection")}
            closable={false}
            visible={props.visible}
            id="quote_selection"
            overlay={true}
            onCancel={props.hideModal}
            footer={[
                <Button key="close" onClick={props.hideModal}>
                    {counterpart.translate("modal.close")}
                </Button>
            ]}
        >
            <section className="no-border-bottom">
                <table className="table">
                    <thead>
                        <tr>
                            <th />
                            <th>
                                <Translate content="account.quote" />
                            </th>
                            <th style={{textAlign: "center"}}>
                                <Translate content="exchange.move_down" />
                            </th>
                            <th style={{textAlign: "center"}}>
                                <Translate content="exchange.move_up" />
                            </th>
                            <th style={{textAlign: "center"}}>
                                <Translate content="exchange.remove" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {props.quotes.map((q: any, idx: number) => {
                            return (
                                <tr key={q}>
                                    <td>{idx + 1}</td>
                                    <td>{q}</td>
                                    <td className="text-center">
                                        {idx !== quoteCount - 1 && (
                                            <Icon
                                                onClick={() => onMoveDown(q)}
                                                name="chevron-down"
                                                className="clickable"
                                            />
                                        )}
                                    </td>
                                    <td className="text-center">
                                        {idx !== 0 && (
                                            <Icon
                                                onClick={() => onMoveUp(q)}
                                                name="chevron-down"
                                                className="clickable rotate180"
                                            />
                                        )}
                                    </td>
                                    <td className="text-center">
                                        {quoteCount > 1 && (
                                            <Icon
                                                onClick={() => onRemove(q)}
                                                name="cross-circle"
                                                className="clickable"
                                            />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <br />

                <div>
                    <AssetSelector
                        label="exchange.custom_quote"
                        onChange={onInputBackingAsset}
                        asset={state.backingAsset}
                        assetInput={state.backingAsset}
                        tabIndex={1}
                        style={{width: "100%", paddingRight: "10px"}}
                        onFound={onFoundBackingAsset}
                        onAction={onAdd}
                        action_label="exchange.add_quote"
                        disableActionButton={!!error}
                        noLabel
                    />
                    <div className="error-area">{error}</div>
                </div>
            </section>
        </Modal>
    );
}
