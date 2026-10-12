import "./store/immerConfig";
import "./design-system/fonts";
import "./design-system/theme.scss";
import "./design-system/legacy-controls.scss";
import React from "react";
import {createRoot} from "react-dom/client";
import AppInit from "./AppInit";

const rootEl = document.getElementById("content");
const render = () => {
    createRoot(rootEl).render(<AppInit />);
};
render();
