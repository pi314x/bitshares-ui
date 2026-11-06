// IBM Plex is the app's only type family (open source, SIL Open Font
// License 1.1): IBM Plex Sans for all UI text and headings, IBM Plex Mono for
// numbers, keys and code. Self-hosted through @fontsource/* instead of a
// Google Fonts CDN link - the Electron build must not depend on the network
// just to render its own UI font - and imported from the app entry
// (app/index.js) so every screen, including the pre-connection init-error
// screen and the unlock modal, gets it, not only the lazily loaded shell.
//
// The @fontsource CSS files declare unicode-range subsets (latin, latin-ext,
// cyrillic, greek, vietnamese), so the browser only downloads the subsets a
// page actually uses. IBM Plex has no CJK glyphs; the CSS custom properties in
// theme.scss end in system-ui so Chinese/Japanese/Korean text falls back to
// the platform font.
import "@fontsource/ibm-plex-sans/300.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-sans/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
