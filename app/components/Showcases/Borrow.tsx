// TypeScript/functional-component port of the legacy Borrow.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `showBorrowModal` (originally an
// unbound instance method, now a plain function in the Core component)
// still calls the real `WalletUnlockActions.unlock()` before revealing
// the borrow modal when no account is yet known - the exact
// unlock-then-proceed flow (`.then` sets `isBorrowBaseModalVisible: true`,
// `.catch` silently does nothing) is transcribed verbatim, not
// restructured. No private key/password/brainkey is read, logged, or
// persisted here - `WalletUnlockActions.unlock()` itself lives elsewhere
// (`app/actions/WalletUnlockActions.js`) and is only invoked here, and
// its resolved value is never inspected.
//
// `connect(Borrow, {listenTo: [AccountStore], getProps})` becomes a
// `BorrowContainer` calling `useAltStore(AccountStore)` and computing
// `currentAccount` the same way `getProps()` did
// (`state.currentAccount || state.passwordAccount`), passed as a prop
// into the debounced Core - the same "outer wrapper gathers stores, inner
// component stays a plain `debounceRender`-wrapped function" shape used
// by `AccountPortfolioList.tsx`/`MyMarkets.tsx`. This route has no caller
// passing its own props (`App.jsx` lazy-loads it directly as a route
// component), so the store-derived-props-win-over-caller-props precedence
// noted in `AccountPortfolioList.tsx`'s header comment doesn't come into
// play here in practice.
//
// `componentDidMount` and `componentDidUpdate` both call the exact same
// `focusDiv()` with no extra gating - combined into a single
// dependency-less `useEffect` that runs after every render (mount and
// every subsequent update alike), matching that "always call it" shape.
// The two legacy string refs (`ref="next"`/`ref="previous"`, read via
// `ReactDOM.findDOMNode(...)` in the original) become real `useRef`s
// attached to the two `<Button>`s, still read through
// `ReactDOM.findDOMNode(...)` - the same "keep findDOMNode, just fed by a
// real ref instead of a legacy string ref" translation already
// established for `CollapsibleTable.tsx`.
//
// Dropped as confirmed dead (grepped): the `AssetWrapper` import - it
// appears only on its own `import` line, never referenced anywhere else
// in the file.
//
// Preserved verbatim (not "fixed"), both pre-existing bugs:
// - `<Icon name="steps[current].icon" />`: a literal string, not an
//   interpolated `{steps[current].icon}` - almost certainly a typo, kept
//   as-is.
// - The legend `try`/`catch` in `render()`: on the `catch` branch,
//   `legend` is reassigned to the raw (un-split) translated string
//   instead of the `string[][]` the happy path produces, which the
//   surrounding JSX later unconditionally calls `.map(...)` on - a
//   pre-existing latent crash if that `catch` branch is ever actually
//   reached, transcribed exactly rather than guarded.
// `tinyScreen = window.innerWidth <= 800` is likewise recomputed inline
// on every render, exactly as the original did - not wired to a `resize`
// listener (so it only updates on a render triggered some other way),
// preserved as-is.
//
// One TS-forced cast: the outermost `<div>`'s inline `style` object
// includes `align: "center"`, which isn't a real CSS property (React
// silently drops unknown style keys at runtime, same behavior before and
// after this port) - `tsc` rejects it against `React.CSSProperties`, so
// that one object literal is cast `as React.CSSProperties` rather than
// dropping the property, keeping the (inert) original value verbatim.
import * as React from "react";
import * as ReactDOM from "react-dom";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import {Button, Card, Steps, Tooltip} from "bitshares-ui-style-guide";
import debounceRender from "react-debounce-render";
import {ChainStore} from "bitsharesjs";
import WalletUnlockActions from "actions/WalletUnlockActions";

import BorrowModal from "../Modal/BorrowModal";
import AccountStore from "../../stores/AccountStore";
import Icon from "../Icon/Icon";
import AssetSelect from "../Utility/AssetSelect";
import {useAltStore} from "../../next/hooks/useAltStore";

interface BorrowStep {
    key: string;
    icon?: string;
    has_legend?: boolean;
}

const STEPS: BorrowStep[] = [
    {
        key: "introduction",
        icon: "borrow"
    },
    {
        key: "concept",
        has_legend: true
    },
    {
        key: "setup",
        has_legend: true
    },
    {
        key: "benefits",
        has_legend: true
    },
    {
        key: "risks",
        has_legend: true
    }
];

interface BorrowCoreState {
    isBorrowBaseModalVisible: boolean;
    selectedAsset: any;
    step: number;
}

interface BorrowCoreProps {
    currentAccount?: any;
}

function BorrowCore({currentAccount: currentAccountProp}: BorrowCoreProps) {
    const [state, setState] = React.useState<BorrowCoreState>({
        isBorrowBaseModalVisible: false,
        selectedAsset: null,
        step: 0
    });
    const mergeState = (patch: Partial<BorrowCoreState>) =>
        setState(prev => ({...prev, ...patch}));

    const showBorrowModal = () => {
        // needs a known account
        if (!currentAccountProp) {
            (WalletUnlockActions as any)
                .unlock()
                .then(() => {
                    mergeState({
                        isBorrowBaseModalVisible: true
                    });
                })
                .catch(() => {});
        } else {
            mergeState({
                isBorrowBaseModalVisible: true
            });
        }
    };

    const hideBorrowModal = () => {
        mergeState({
            isBorrowBaseModalVisible: false
        });
    };

    const next = () => {
        setState(prev => {
            let step = prev.step + 1;
            if (step >= STEPS.length) step = STEPS.length;
            return {...prev, step};
        });
    };

    const prev = () => {
        setState(prevState => {
            let step = prevState.step - 1;
            if (step < 0) step = 0;
            return {...prevState, step};
        });
    };

    const onAssetChange = (selected_asset: any) => {
        mergeState({
            selectedAsset: selected_asset
        });
    };

    const onKeyDown = (e: any) => {
        // arrow up/down button should select next/previous list element
        if (e.keyCode === 39 || e.key == "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            next();
        } else if (e.keyCode === 37 || e.key == "ArrowLeft") {
            e.preventDefault();
            e.stopPropagation();
            prev();
        }
    };

    const nextRef = React.useRef<any>(null);
    const previousRef = React.useRef<any>(null);

    const focusDiv = () => {
        const current = state.step;
        if (current < STEPS.length && !!nextRef.current) {
            // eslint-disable-next-line react/no-find-dom-node
            const node = ReactDOM.findDOMNode(nextRef.current) as HTMLElement;
            if (node && node.focus) node.focus();
        } else if (current == STEPS.length && !!previousRef.current) {
            // eslint-disable-next-line react/no-find-dom-node
            const node = ReactDOM.findDOMNode(
                previousRef.current
            ) as HTMLElement;
            if (node && node.focus) node.focus();
        }
    };

    // Mirrors componentDidMount + componentDidUpdate (both call
    // focusDiv() unconditionally - see file header): runs after every
    // render.
    React.useEffect(() => {
        focusDiv();
    });

    const currentAccount = ChainStore.getAccount(currentAccountProp);
    const accountLoaded = !(
        !currentAccount || typeof currentAccount === "string"
    );
    const current = state.step;
    const tinyScreen = window.innerWidth <= 800;
    const started = state.step > 0;

    const selectedAssetObject = ChainStore.getAsset(state.selectedAsset);
    const steps = STEPS;
    let legend: any = null;
    if (current < steps.length) {
        try {
            if (steps[current].has_legend) {
                legend = counterpart.translate(
                    "showcases.borrow.steps_" + steps[current].key + ".text_legend"
                );
                legend = legend.split("\n").map((item: string) => {
                    return item.split(":");
                });
            }
        } catch (err) {
            legend = counterpart.translate(
                "showcases.borrow.steps_" + steps[current].key + ".text_legend"
            );
        }
    }

    let finishedCard = null;
    if (current >= steps.length) {
        finishedCard = (
            <Card>
                <div className={"center-content"}>
                    <Translate
                        content={"showcases.borrow.choose"}
                        component={"h4"}
                    />
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center"
                    }}
                >
                    <div>
                        <AssetSelect
                            style={{
                                width: "12rem",
                                marginBottom: "1rem"
                            }}
                            assets={[
                                "1.3.113",
                                "1.3.120",
                                "1.3.121",
                                "1.3.1325",
                                "1.3.105",
                                "1.3.106",
                                "1.3.103",
                                "1.3.5641", // HONEST.CNY
                                "1.3.5649", // HONEST.USD
                                "1.3.5650", // HONEST.BTC
                                "1.3.5651", // HONEST.XAU
                                "1.3.5652", // HONEST.XAG
                                "1.3.5659", // HONEST.ETH
                                "1.3.5660", // HONEST.XRP
                                "1.3.5661", // HONEST.ETH1
                                "1.3.5662", // HONEST.XRP1
                                "1.3.6289", // HONEST.USDSHORT
                                "1.3.6290", // HONEST.BTCSHORT
                                "1.3.4633", // URTHR
                                "1.3.4634", // SKULD
                                "1.3.4635", // VERTHANDI
                                "1.3.1382" // HERTZ
                            ]}
                            value={state.selectedAsset}
                            onChange={onAssetChange}
                        />
                        <Tooltip
                            title={counterpart.translate(
                                "showcases.borrow.borrow_tooltip"
                            )}
                            placement="bottom"
                        >
                            <Button
                                type="primary"
                                style={{
                                    width: "12rem"
                                }}
                                disabled={
                                    state.selectedAsset !== null && accountLoaded
                                        ? (currentAccount as any).get("id") ===
                                          "1.2.3"
                                        : true
                                }
                                onClick={showBorrowModal}
                            >
                                <Translate content="exchange.borrow" />
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div
            style={
                {
                    // `align` isn't a real CSS property (React silently
                    // drops it at runtime, same as the original) - kept
                    // verbatim, cast to satisfy `React.CSSProperties`.
                    align: "center",
                    display: "flex",
                    paddingTop: "1rem",
                    justifyContent: "center"
                } as React.CSSProperties
            }
            onKeyDown={onKeyDown}
        >
            <Card
                style={{
                    borderRadius: "50px",
                    width: "70%",
                    maxWidth: "70rem",
                    paddingTop: "1rem",
                    paddingBottom: "1rem"
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center"
                    }}
                >
                    <Translate
                        component="h1"
                        content={
                            finishedCard != null
                                ? "showcases.borrow.now_ready"
                                : "showcases.borrow.title_long"
                        }
                    />
                </div>
                {started &&
                    (!tinyScreen ? (
                        <Steps progressDot current={current - 1}>
                            {steps.map((item, index) => {
                                if (index == 0) return null;
                                return (
                                    <Steps.Step
                                        key={item.key}
                                        title={counterpart.translate(
                                            "showcases.borrow.steps_" +
                                                item.key +
                                                ".title"
                                        )}
                                    />
                                );
                            })}
                        </Steps>
                    ) : current < STEPS.length ? (
                        <React.Fragment>
                            {current + ". "}
                            <Translate
                                content={
                                    "showcases.borrow.steps_" +
                                    steps[current].key +
                                    ".title"
                                }
                            />
                        </React.Fragment>
                    ) : null)}
                <div
                    style={{
                        paddingTop: "1rem",
                        paddingBottom: "1rem"
                    }}
                >
                    {finishedCard != null && finishedCard}
                    {finishedCard == null && (
                        <Card onKeyDown={onKeyDown}>
                            {!!steps[current].icon && (
                                <Icon name="steps[current].icon" />
                            )}
                            <Translate
                                component="h2"
                                content={
                                    "showcases.borrow.steps_" +
                                    steps[current].key +
                                    ".title_within"
                                }
                            />

                            <Translate
                                component="p"
                                content={
                                    "showcases.borrow.steps_" +
                                    steps[current].key +
                                    ".text"
                                }
                            />

                            {!!steps[current].has_legend && (
                                <React.Fragment>
                                    {legend.map((content: any, index: number) => {
                                        return (
                                            <p key={"borrow_subp_" + index}>
                                                <strong>{content[0]}</strong>:{" "}
                                                {content[1]}
                                            </p>
                                        );
                                    })}
                                </React.Fragment>
                            )}
                        </Card>
                    )}
                </div>
                <div className="steps-action">
                    {current < steps.length && (
                        <Tooltip
                            title={
                                current == 0
                                    ? counterpart.translate(
                                          "showcases.borrow.navigate_with_keys"
                                      )
                                    : null
                            }
                        >
                            <Button
                                type="primary"
                                onClick={() => next()}
                                tabIndex="0"
                                ref={nextRef}
                                onKeyDown={onKeyDown}
                            >
                                {current == 0 && (
                                    <Translate
                                        content={"showcases.borrow.get_started"}
                                    />
                                )}
                                {current > 0 && current < steps.length - 1 && (
                                    <Translate
                                        content={"showcases.borrow.next"}
                                    />
                                )}
                                {current === steps.length - 1 && (
                                    <Translate
                                        content={"showcases.borrow.do_it"}
                                    />
                                )}
                            </Button>
                        </Tooltip>
                    )}
                    {current > 0 && (
                        <Button
                            style={{marginLeft: 8}}
                            onClick={() => prev()}
                            ref={previousRef}
                            onKeyDown={onKeyDown}
                        >
                            <Translate content={"showcases.borrow.previous"} />
                        </Button>
                    )}
                </div>
            </Card>
            {accountLoaded && !!selectedAssetObject && (
                <BorrowModal
                    visible={state.isBorrowBaseModalVisible}
                    hideModal={hideBorrowModal}
                    quoteAssetObj={(selectedAssetObject as any).get("id")}
                    backingAssetObj={(selectedAssetObject as any).getIn([
                        "bitasset",
                        "options",
                        "short_backing_asset"
                    ])}
                    accountObj={currentAccount}
                />
            )}
        </div>
    );
}

const BorrowCoreDebounced: any = debounceRender(BorrowCore, 50, {
    leading: false
});

function BorrowContainer() {
    const accountState = useAltStore<any>(AccountStore);
    const currentAccount =
        accountState.currentAccount || accountState.passwordAccount;
    return <BorrowCoreDebounced currentAccount={currentAccount} />;
}

export default BorrowContainer;
