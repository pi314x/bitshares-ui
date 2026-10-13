import "./store/immerConfig";
import "./design-system/fonts";
import "./design-system/theme.scss";
import "./design-system/legacy-controls.scss";
import React from "react";
import {createRoot} from "react-dom/client";
import {ChainStore} from "bitsharesjs";
import {dedupeAssetLookups} from "./lib/chain/dedupeAssetLookups";
import {installResizeGuard} from "./lib/common/resizeGuard";
import {
    installFatalErrorScreen,
    recordError,
    showFatalError
} from "./lib/common/fatalError";
import AppInit from "./AppInit";

// Before anything renders: one symbol lookup in flight, not one per render.
dedupeAssetLookups(ChainStore);
installResizeGuard();
installFatalErrorScreen();

// A render error nothing below caught would unmount the whole app and leave an
// empty dark page; say what happened instead.
class RootErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {failed: false};
    }

    static getDerivedStateFromError() {
        return {failed: true};
    }

    componentDidCatch(error, info) {
        recordError(error, info && info.componentStack);
        showFatalError();
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

const rootEl = document.getElementById("content");
const render = () => {
    createRoot(rootEl).render(
        <RootErrorBoundary>
            <AppInit />
        </RootErrorBoundary>
    );
};
render();
