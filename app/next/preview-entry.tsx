// Standalone mount point for reviewing `app/next` screens (screenshots,
// visual review) without booting the legacy app shell, which blocks on a
// live blockchain connection before rendering anything (see AppInit.jsx).
// Not part of the real app bundle — built separately via
// `yarn build-preview` / webpack.preview.config.js.
import * as React from "react";
import * as ReactDOM from "react-dom";
import NextShell from "./NextShell";

const mountNode = document.getElementById("preview-root");
ReactDOM.render(<NextShell />, mountNode);
