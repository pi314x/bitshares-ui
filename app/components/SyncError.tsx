// TypeScript/functional-component port of the legacy SyncError.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. This screen only lets the user pick/add/remove an API
// node when the app fails to connect to one.
//
// `connect(SyncError, {listenTo: [BlockchainStore, SettingsStore],
// getProps})` - only `apis`/`apiServer` (from `SettingsStore`) are
// actually read anywhere in the file (grepped); `rpc_connection_status`
// (from `BlockchainStore`), `defaultConnection`, and `apiLatencies` are
// all fetched by `getProps()` but never used - dropped, keeping
// `useAltStore(SettingsStore)` for `apis`/`apiServer` plus a bare
// `useAltStore(BlockchainStore)` call purely for its re-render-on-change
// side effect (matching this migration's established "connect wrap with
// an otherwise-unused store" treatment, e.g. `AccountRegistrationForm
// .tsx`).
//
// Dropped as confirmed dead (grepped): `triggerModal` - defined *twice*
// with the same name (`triggerModal(e) {...}` then `triggerModal(e,
// ...args) {...}`, the second silently shadowing the first per plain JS
// class-body semantics) - neither version is ever called anywhere in the
// file, and both reference `this.refs.ws_modal`, a legacy string ref
// that's never actually set on anything in this component's JSX either.
// Also dropped: `render()`'s local `options` (built via `props.apis
// .map(...)` into an array of `<option>` elements) - a pure computation
// with no side effects that's never referenced anywhere in the returned
// JSX (grepped) - dropping it changes nothing observable. Its only
// consumer, `counterpart.translate(...)`, is dropped with it as now
// genuinely unused. Also dropped, transitively: `onChangeWS` is passed
// to the already-ported `Settings/AccessSettings.tsx` as an `onChange`
// prop, but that component's own header comment already documents
// `onChange` (passed by every caller) as never read anywhere in that
// file - since nothing else in *this* file calls `onChangeWS` either, it
// (and the `onReloadClick` it was the only caller of, and the
// `SettingsActions`/`Apis` imports both only used inside them) are all
// confirmed dead here too.
//
// Preserved verbatim, not "fixed" (pre-existing, already flagged when
// `AccessSettings.tsx` was ported): this file's `<WebsocketAddModal>`
// call never passes a `changeConnection` prop, which that (separately
// ported) component's `onRemoveSubmit` calls when the removed node was
// the active one - a latent crash if that specific path is ever
// triggered from this screen, not introduced or fixed by this port. Cast
// with `as any` to compile past the stricter required-prop type that
// port gave `WebsocketAddModal`, rather than inventing a handler that
// wasn't there.
import * as React from "react";
import SettingsStore from "stores/SettingsStore";
import BlockchainStore from "stores/BlockchainStore";
import Translate from "react-translate-component";
import Icon from "./Icon/Icon";
import WebsocketAddModal from "./Settings/WebsocketAddModal";
import AccessSettings from "./Settings/AccessSettings";
import {useAltStore} from "../next/hooks/useAltStore";

const WebsocketAddModalAny = WebsocketAddModal as any;

interface SyncErrorState {
    isAddNodeModalVisible: boolean;
    isRemoveNodeModalVisible: boolean;
    removeNode: {name: any; url: any};
}

export default function SyncError() {
    useAltStore<any>(BlockchainStore);
    const settingsState = useAltStore<any>(SettingsStore);
    const apis = settingsState.defaults.apiServer;
    const apiServer = settingsState.settings.get("apiServer");

    const [state, setState] = React.useState<SyncErrorState>({
        isAddNodeModalVisible: false,
        isRemoveNodeModalVisible: false,
        removeNode: {name: null, url: null}
    });

    const showAddNodeModal = () => {
        setState(prev => ({...prev, isAddNodeModalVisible: true}));
    };

    const hideAddNodeModal = () => {
        setState(prev => ({...prev, isAddNodeModalVisible: false}));
    };

    const showRemoveNodeModal = (url: any, name: any) => {
        setState(prev => ({
            ...prev,
            isRemoveNodeModalVisible: true,
            removeNode: {url, name}
        }));
    };

    const hideRemoveNodeModal = () => {
        setState(prev => ({
            ...prev,
            isRemoveNodeModalVisible: false,
            removeNode: {url: null, name: null}
        }));
    };

    return (
        <div className="grid-frame vertical">
            <div
                className="grid-container text-center"
                style={{
                    padding: "5rem 10% 0 10%",
                    maxWidth: "100%",
                    overflowY: "auto",
                    margin: "0 !important" as any
                }}
            >
                <h2>
                    <Translate content="sync_fail.title" />
                </h2>
                <br />
                <p style={{marginBottom: 0}}>
                    <Translate content="sync_fail.sub_text_1" />
                </p>

                <Icon name="clock" title="icons.clock" size="5x" />

                <p>
                    <Translate unsafe content="sync_fail.sub_text_2" />
                </p>
                <hr />

                <AccessSettings
                    nodes={apis}
                    showAddNodeModal={showAddNodeModal}
                    showRemoveNodeModal={showRemoveNodeModal}
                />
            </div>

            <WebsocketAddModalAny
                removeNode={state.removeNode}
                isAddNodeModalVisible={state.isAddNodeModalVisible}
                isRemoveNodeModalVisible={state.isRemoveNodeModalVisible}
                onAddNodeClose={hideAddNodeModal}
                onRemoveNodeClose={hideRemoveNodeModal}
                apis={apis}
                api={apiServer}
            />
        </div>
    );
}
