import "./store/immerConfig";
import "./design-system/fonts";
import "./design-system/theme.scss";
import "./design-system/legacy-controls.scss";
import React from "react";
import {createRoot} from "react-dom/client";
import {ChainStore} from "bitsharesjs";
import {dedupeAssetLookups} from "./lib/chain/dedupeAssetLookups";
import {installResizeGuard} from "./lib/common/resizeGuard";
import AppInit from "./AppInit";

// Before anything renders: one symbol lookup in flight, not one per render.
dedupeAssetLookups(ChainStore);
installResizeGuard();

const rootEl = document.getElementById("content");
const render = () => {
    createRoot(rootEl).render(<AppInit />);
};
render();
