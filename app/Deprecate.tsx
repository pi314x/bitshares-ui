import * as React from "react";
import WalletDb from "stores/WalletDb";
import Translate from "react-translate-component";
import Loadable from "react-loadable";
import LoadingIndicator from "./components/LoadingIndicator";
import {getWalletURL} from "./branding";

const TypedTranslate = Translate as React.ComponentType<any>;

const Settings: React.ComponentType<any> = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "settings" */ "./components/Settings/SettingsContainer"
        ),
    loading: LoadingIndicator
});

function RenderForWallet() {
    return (
        <div>
            <TypedTranslate content="migration.text_1" component="h4" />
            <TypedTranslate
                content="migration.text_2"
                component="p"
                unsafe
                wallet_url={getWalletURL()}
            />
        </div>
    );
}

function RenderForCloud() {
    return (
        <div>
            <TypedTranslate
                content="migration.text_3"
                unsafe
                component="p"
                wallet_url={getWalletURL()}
            />
        </div>
    );
}

// The page shown instead of the app on a deprecated deployment: points to the
// new wallet URL, and (when a local wallet exists) still offers the settings
// page so the user can back it up.
export default function Deprecate(props: Record<string, any>) {
    const hasWallet = !!(WalletDb as any).getWallet();

    return (
        <div className="grid-frame">
            <div
                className="grid-block vertical"
                style={{paddingBottom: "3rem"}}
            >
                <div className="grid-content large-offset-2 large-8 shrink">
                    <TypedTranslate content="migration.title" component="h2" />
                    <TypedTranslate
                        content="migration.announcement_1"
                        unsafe
                        component="p"
                    />
                    <p>
                        <a
                            href={getWalletURL()}
                            target="blank"
                            rel="noopener noreferrer"
                        >
                            {getWalletURL()}
                        </a>
                    </p>

                    {hasWallet ? <RenderForWallet /> : <RenderForCloud />}
                </div>
                {hasWallet ? <Settings {...props} deprecated /> : null}
            </div>
        </div>
    );
}
