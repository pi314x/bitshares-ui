// TypeScript/function-component port of the legacy Page404.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical translation, no logic changes.
// Not security-sensitive per AGENTS.md (grepped for `WalletDb`/`WalletApi`/
// `Actions\.`/`ApplicationApi\.` - none appear; this is a static "not
// found" page with a link home).
//
// Structural change (not a behavior change): the original's
// `connect(Page404, {listenTo: [SettingsStore], getProps() {return
// {theme: SettingsStore.getState().settings.get("themes")};}})` is
// replaced by an outer `Page404` wrapper calling `useAltStore
// (SettingsStore)` and passing the derived `theme` into `Page404Core`,
// following this migration's established `connect` -> `useAltStore`
// translation (e.g. `AccountPortfolioList.tsx`'s header comment). Prop
// precedence is preserved exactly: alt-react's `connect` renders
// `<Component {...this.props} {...this.getNextProps()} />`, i.e.
// store-derived props always win over same-named props the caller passed
// in - the wrapper below spreads `{...props}` first and `theme={...}`
// after, same override order (not that any of the three real call sites,
// `Asset.tsx`/`ExchangeContainer.jsx`/`QuickTradeRouter.jsx`, which all
// only pass `subtitle`, or the route-level `<Route path="*"
// component={Page404} />` in `App.jsx`, ever pass a `theme` prop of their
// own to be overridden).
// `defaultProps = {subtitle: "page_not_found_subtitle"}` becomes a
// default-parameter destructure in `Page404Core`.
import * as React from "react";
import {Link} from "react-router-dom";
import SettingsStore from "stores/SettingsStore";
import Translate from "react-translate-component";
import {useAltStore} from "../../next/hooks/useAltStore";

// `Link` is cast to a loosely-typed component, matching the established
// workaround already in use elsewhere in this migration (see
// `Utility/MarketLink.tsx`'s identical `Link as React.ComponentType<any>`)
// for a `@types/react`/`@types/react-router-dom` JSX-element-key-type
// mismatch that otherwise surfaces when `<Link>` wraps certain nested
// children.
const LinkComponent = Link as React.ComponentType<any>;

import light from "assets/logo-404-light.png";
import dark from "assets/logo-404-dark.png";
import midnight from "assets/logo-404-midnight.png";

export interface Page404Props {
    subtitle?: string;
    theme?: string;
    // Permissive on purpose - this is also rendered directly as a
    // react-router route component (`<Route path="*"
    // component={Page404} />`), which implicitly passes `match`/
    // `location`/`history`, all unused here, same as the original.
    [key: string]: any;
}

function Page404Core(props: Page404Props) {
    const {subtitle = "page_not_found_subtitle", theme} = props;

    let logo;

    if (theme === "lightTheme") {
        logo = light;
    }

    if (theme === "darkTheme") {
        logo = dark;
    }

    if (theme === "midnightTheme") {
        logo = midnight;
    }

    return (
        <div className="page-404">
            <div className="page-404-container">
                <div className="page-404-logo">
                    <img src={logo} alt="Logo" />
                </div>
                <div className="page-404-title">
                    <Translate content="page404.page_not_found_title" />
                </div>
                <div className="page-404-subtitle">
                    <Translate content={"page404." + subtitle} />
                </div>
                <div className="page-404-button-back">
                    <LinkComponent to={"/"}>
                        <Translate
                            component="button"
                            className="button"
                            content="page404.home"
                        />
                    </LinkComponent>
                </div>
            </div>
        </div>
    );
}

export default function Page404(props: Page404Props) {
    const settingsState = useAltStore<any>(SettingsStore as any);
    const theme = settingsState.settings.get("themes");

    return <Page404Core {...props} theme={theme} />;
}
