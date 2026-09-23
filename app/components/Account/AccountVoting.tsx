// TypeScript/functional-component port of the legacy AccountVoting.jsx
// (Phase 3, docs/UI_MIGRATION_PLAN.md) - the last file in the Permissions/
// Voting family. The parent orchestrator for the Account Voting screen:
// proxy voting, witness/committee vote submission (`publish`, called by
// `onPublish`/`onRemoveProxy`), and the three tab panes ported in this
// phase's first slice (`Committee.tsx`/`Witnesses.tsx`/`Workers.tsx`, via
// `VotingAccountsList.tsx`). `publish` submits the real `account_update`
// operation via `ApplicationApi.updateAccount`, reused unchanged - same
// wallet-security-sensitive care as the rest of this family.
//
// Structural change (same substitution pattern used throughout this
// migration, not a one-off redesign): the original's `BindToChainState
// (AccountVoting)` wrap (resolving `initialBudget`/`globalObject`/`proxy`,
// all `ChainTypes...isRequired`, and gating render behind a `<span/>`
// placeholder until every required prop resolves - see
// `BindToChainState.jsx`'s own `render()`) is collapsed into an
// `AccountVotingContainer` + `AccountVoting` split (the same split used
// for `Asset.tsx`/`AssetContainer`): the container resolves all three via
// `ChainStore.getObject`/`getAccount` under `useChainStoreTick()` and
// renders the `<span/>` placeholder itself until they're non-null: this
// preserves the original guarantee that the actual component's
// state-seeding logic (the old constructor, now `useState`'s lazy
// initializer) never runs against an unresolved chain object. The
// `withRouter(FillMissingProps)` wrap is simplified to a plain
// `FillMissingProps` function - `history`/`location` are read with
// `useHistory()`/`useLocation()` directly inside `AccountVoting` instead,
// which is exactly what `withRouter` supplied.
//
// The legacy class kept ~20 related fields (proxy id/input, witness/
// committee/vote-id sets, a "prev_" shadow copy of several for change-
// detection, budget-object bookkeeping, UI toggles, and the static `tabs`
// array) as one flat `this.state` object. Replicated with the same single
// `useState<any>({})` + `mergeState` shallow-merge helper this family's
// other slices established (`AccountPermissions.tsx`).
//
// Two fields - `all_witnesses`/`all_committee` - are the exception: the
// legacy `_getVoteObjects` (here `getVoteObjects`) intentionally bypasses
// `setState` entirely, mutating `this.state.all_${type}` directly in
// place and then calling `this.forceUpdate()` to pick up the mutated
// value on next render (a real, deliberate anti-pattern in the original,
// not a bug this port should "fix" into a real `setState`). Replicated
// with `useRef` (the direct-mutation target) plus a small `useForceUpdate`
// helper (a dummy counter `useState` bumped to trigger a re-render) -
// preserving the exact mutate-then-force-rerender behavior rather than
// converting these two fields into normal state.
//
// `UNSAFE_componentWillMount` (fee-asset pre-warm, `fetchAllWorkers`,
// `getBudgetObject`) and `componentDidMount` (`updateAccountData`, the two
// `getVoteObjects` calls) never observably depended on an intervening
// render - both fire exactly once, before the user can interact with
// anything - so they're collapsed into a single mount-only `useEffect`,
// same collapsing this migration has applied elsewhere when a class split
// two mount-phase lifecycle methods with no synchronous distinction
// between them.
//
// `UNSAFE_componentWillReceiveProps(np)` did two separate things on every
// subsequent prop change: (a) if `np.account !== this.props.account`,
// reseed `proxy_account_id`/call `updateAccountData` with the new proxy;
// (b) unconditionally call `getBudgetObject()`, regardless of *which*
// prop changed. (a) maps cleanly to a `[account]`-keyed effect guarded to
// skip the first (mount) run. (b) has no exact hooks equivalent - "every
// single prop change" isn't an expressible dependency array. Approximated
// with an effect keyed on `[account, location.pathname]`, the only two
// props that actually change while this component stays mounted in
// practice (account switches, and tab switches via
// `/account/:name/voting/:tab`, which change `location.pathname` without
// remounting): `settings`/`viewSettings` can technically also change
// (SettingsStore updates propagated from `AccountPage.jsx`) without
// triggering this approximation, but `getBudgetObject` is a cheap,
// idempotent, display-only refresh of the budget figures shown on this
// tab - it never touches the vote-submission transaction - so a slightly
// narrower refresh trigger has no meaningful behavioral consequence.
//
// Wherever the original used `this.setState(partial, callback)` specifically
// so the callback's `updateAccountData(this.props)`/`this.getBudgetObject`
// call would see the just-applied value (`onReset`, `onProxyAccountFound`,
// `getBudgetObject`'s own recursive self-calls), replicated by passing
// that already-known value explicitly as a parameter/override instead of
// emulating `setState`'s callback timing with an effect - functionally
// identical, since in each case the callback only ever read the single
// field the preceding `setState` had just written (`updateAccountData`'s
// second argument only ever contributes its `proxy_account_id` field;
// `getBudgetObject` only ever reads `lastBudgetObject`).
//
// Confirmed dead, dropped:
// - The `if (this.refs.voting_proxy && ...)` guard at the top of
//   `onReset` - no `ref="voting_proxy"` exists anywhere in this file, so
//   `this.refs.voting_proxy` was always `undefined` and the guard never
//   fired.
// - `onCreateTicket` and `onClearProxy` - both defined, neither ever
//   called, bound, or passed as a prop anywhere in this file (grepped the
//   whole file; `CreateLockModal`, the only ticket-related child, isn't
//   given either as a prop).
// - `validateAccount(collection, account)` and the `validateAccountHandler`
//   closure built from it (`this.validateAccount.bind(this,
//   WITNESSES_KEY)` - itself only ever bound to `WITNESSES_KEY`, never
//   `COMMITTEE_KEY`, even though it's passed uniformly to every tab
//   including the committee one) - previously deferred exactly to this
//   slice by `VotingAccountsList.tsx`'s own header comment ("revisit when
//   AccountVoting.jsx itself gets ported"). With this file now ported,
//   the full chain is traceable end to end: `AccountVoting` ->
//   `Committee`/`Witnesses` (`validateAccountHandler` prop) ->
//   `VotingAccountsList` (`validateAccount` prop) - and confirmed dead at
//   every link (`VotingAccountsList.tsx` never reads its `validateAccount`
//   prop at all). Dropped here, and the now-fully-dead `validateAccountHandler`
//   prop removed from `Committee.tsx`/`Witnesses.tsx` and `validateAccount`/
//   `placeholder` (the latter never supplied by any caller either) removed
//   from `VotingAccountsList.tsx`'s prop interface in this same slice,
//   completing the cascade cleanup. `label`/`tabIndex` are left as-is on
//   `VotingAccountsList.tsx` - both are still actively supplied real
//   values by `Committee.tsx`/`Witnesses.tsx`, just never read internally,
//   same "accepted but unused" status as before.
//
// One pre-existing bug preserved exactly, not fixed: `onReset` restores
// `current_proxy_input: s.prev_proxy_input` - but no field named
// `prev_proxy_input` is ever set anywhere in this file (only
// `prev_proxy_account_id` is maintained); the correct-looking field name
// would have been `s.prev_current_proxy_input` or similar. In practice
// this always evaluates to `undefined`, so "reset" clears the proxy
// search box's text rather than restoring its previous contents - kept
// byte-for-byte identical rather than guessed at, since fixing it either
// way is a judgment call on intent this port isn't the place to make.
//
// The constructor's `typeof props.account === "string" ? props.account :
// props.account.get("name")` guard (used only for building the `tabs`
// array's link URLs) is preserved as-is even though every other method in
// this class assumes `account` is a resolved Immutable Map (e.g.
// `publish`'s `account.toJS()`) - in real usage (via `AccountPage.jsx`)
// `account` is always already resolved, and the string branch only
// matters for the tab links, so this is mechanically translated without
// investigating whether the string branch is ever actually reachable in
// practice.
import * as React from "react";
import {useHistory, useLocation, Link, LinkProps} from "react-router-dom";
import Immutable from "immutable";
import Translate from "react-translate-component";
import accountUtils from "common/account_utils";
import {ChainStore, FetchChainObjects} from "bitsharesjs";
import ApplicationApi from "api/ApplicationApi";
import AccountSelector from "./AccountSelector";
import Icon from "../Icon/Icon";
import counterpart from "counterpart";
import SettingsStore from "stores/SettingsStore";
import {Switch, Tooltip, Button, Tabs} from "bitshares-ui-style-guide";
import AccountStore from "stores/AccountStore";
import Witnesses from "./Voting/Witnesses";
import Committee from "./Voting/Committee";
import Workers from "./Voting/Workers";
import CreateLockModal from "../Modal/CreateLockModal";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const WITNESSES_KEY = "witnesses";
const COMMITTEE_KEY = "committee";
const TypedLink = Link as React.ComponentType<LinkProps>;

function useForceUpdate() {
    const [, setTick] = React.useState(0);
    return React.useCallback(() => setTick(t => t + 1), []);
}

interface AccountVotingProps {
    account: any;
    initialBudget: any;
    globalObject: any;
    proxy: any;
    settings: any;
    viewSettings: any;
    history?: any;
}

function AccountVoting({
    account,
    initialBudget,
    globalObject,
    proxy,
    settings,
    viewSettings
}: AccountVotingProps) {
    useChainStoreTick();
    const history = useHistory();
    const location = useLocation();
    const forceUpdate = useForceUpdate();

    const allWitnessesRef = React.useRef(Immutable.List());
    const allCommitteeRef = React.useRef(Immutable.List());

    const [state, setState] = React.useState<any>(() => {
        const proxyId = proxy.get("id");
        const proxyName = proxy.get("name");
        const accountName =
            typeof account === "string" ? account : account.get("name");
        return {
            proxy_account_id: proxyId === "1.2.5" ? "" : proxyId,
            prev_proxy_account_id: proxyId === "1.2.5" ? "" : proxyId,
            current_proxy_input: proxyId === "1.2.5" ? "" : proxyName,
            witnesses: null,
            committee: null,
            vote_ids: Immutable.Set(),
            proxy_vote_ids: Immutable.Set(),
            lastBudgetObject: initialBudget.get("id"),
            hideLegacyProposals: true,
            filterSearch: "",
            isCreateLockModalVisible: false,
            isCreateLockModalVisibleBefore: false,
            tabs: [
                {
                    name: "witnesses",
                    link: "/account/" + accountName + "/voting/witnesses",
                    translate: "explorer.witnesses.title",
                    content: Witnesses
                },
                {
                    name: "committee",
                    link: "/account/" + accountName + "/voting/committee",
                    translate: "explorer.committee_members.title",
                    content: Committee
                },
                {
                    name: "workers",
                    link: "/account/" + accountName + "/voting/workers",
                    translate: "account.votes.workers_short",
                    content: Workers
                }
            ]
        };
    });

    function mergeState(partial: any) {
        setState((prev: any) => ({...prev, ...partial}));
    }

    function updateAccountData(acct: any, stateOverride?: any) {
        const s = stateOverride || state;
        let {proxy_account_id} = s;
        const proxyAcc = (ChainStore as any).getAccount(proxy_account_id);
        const options = acct.get("options");
        const proxyOptions = proxyAcc ? proxyAcc.get("options") : null;
        let current_proxy_input = proxyAcc ? proxyAcc.get("name") : "";
        if (proxy_account_id === "1.2.5") {
            proxy_account_id = "";
            current_proxy_input = "";
        }

        const votes = options.get("votes");
        const vote_ids = votes.toArray();
        const vids = Immutable.Set(vote_ids);
        (ChainStore as any).getObjectsByVoteIds(vote_ids);

        let proxyPromise: any = null;
        let proxy_vids = Immutable.Set([]);
        const hasProxy = proxy_account_id !== "1.2.5";
        if (hasProxy && proxyOptions) {
            const proxy_votes = proxyOptions.get("votes");
            const proxy_vote_ids = proxy_votes.toArray();
            proxy_vids = Immutable.Set(proxy_vote_ids);
            (ChainStore as any).getObjectsByVoteIds(proxy_vote_ids);

            proxyPromise = (FetchChainObjects as any)(
                (ChainStore as any).getObjectByVoteID,
                proxy_vote_ids,
                10000
            );
        }

        Promise.all([
            (FetchChainObjects as any)(
                (ChainStore as any).getObjectByVoteID,
                vote_ids,
                10000
            ),
            proxyPromise
        ]).then((res: any) => {
            const [vote_objs, proxy_vote_objs] = res;
            function sortVoteObjects(objects: any) {
                let witnesses = Immutable.List();
                let committee = Immutable.List();
                const workers = Immutable.Set();
                objects.forEach((obj: any) => {
                    let account_id = obj.get("committee_member_account");
                    if (account_id) {
                        committee = committee.push(account_id);
                    } else if ((account_id = obj.get("worker_account"))) {
                        // console.log( "worker: ", obj );
                        //     workers = workers.add(obj.get("id"));
                    } else if ((account_id = obj.get("witness_account"))) {
                        witnesses = witnesses.push(account_id);
                    }
                });

                return {witnesses, committee, workers};
            }

            const {witnesses, committee, workers} = sortVoteObjects(
                vote_objs
            );
            const {
                witnesses: proxy_witnesses,
                committee: proxy_committee,
                workers: proxy_workers
            } = sortVoteObjects(proxy_vote_objs || []);

            mergeState({
                proxy_account_id,
                current_proxy_input,
                witnesses,
                committee,
                workers,
                proxy_witnesses,
                proxy_committee,
                proxy_workers,
                vote_ids: vids,
                proxy_vote_ids: proxy_vids,
                prev_witnesses: witnesses,
                prev_committee: committee,
                prev_workers: workers,
                prev_vote_ids: vids
            });
        });
    }

    const isFirstMount = React.useRef(true);
    React.useEffect(() => {
        (accountUtils as any).getFinalFeeAsset(account, "account_update");
        (ChainStore as any).fetchAllWorkers();
        getBudgetObject();
        updateAccountData(account);
        getVoteObjects();
        getVoteObjects(COMMITTEE_KEY);
        isFirstMount.current = false;
        // eslint-disable-next-line
    }, []);

    const isFirstAccountChange = React.useRef(true);
    React.useEffect(() => {
        if (isFirstAccountChange.current) {
            isFirstAccountChange.current = false;
            return;
        }
        const proxyId = proxy.get("id");
        const newProxyAccountId = proxyId === "1.2.5" ? "" : proxyId;
        mergeState({prev_proxy_account_id: newProxyAccountId});
        updateAccountData(account, {proxy_account_id: newProxyAccountId});
        // eslint-disable-next-line
    }, [account]);

    const isFirstBudgetEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstBudgetEffect.current) {
            isFirstBudgetEffect.current = false;
            return;
        }
        getBudgetObject();
        // eslint-disable-next-line
    }, [account, location.pathname]);

    function isChanged(s: any = state) {
        return (
            s.proxy_account_id !== s.prev_proxy_account_id ||
            s.witnesses !== s.prev_witnesses ||
            s.committee !== s.prev_committee ||
            !Immutable.is(s.vote_ids, s.prev_vote_ids)
        );
    }

    function getVoteObjects(type: string = WITNESSES_KEY, vote_ids?: any) {
        const isWitness = type === WITNESSES_KEY;
        const currentRef = isWitness ? allWitnessesRef : allCommitteeRef;
        const current = currentRef.current;
        let lastIdx: number;
        if (!vote_ids) {
            vote_ids = [];
            const active = globalObject
                .get(
                    isWitness ? "active_witnesses" : "active_committee_members"
                )
                .sort((a: string, b: string) => {
                    return (
                        parseInt(a.split(".")[2], 10) -
                        parseInt(b.split(".")[2], 10)
                    );
                });
            const lastActive = active.last() || `1.${isWitness ? "6" : "5"}.1`;
            lastIdx = parseInt(lastActive.split(".")[2], 10);
            for (let i = 1; i <= lastIdx + 10; i++) {
                vote_ids.push(`1.${isWitness ? "6" : "5"}.${i}`);
            }
        } else {
            lastIdx = parseInt(vote_ids[vote_ids.length - 1].split(".")[2], 10);
        }
        (FetchChainObjects as any)(
            (ChainStore as any).getObject,
            vote_ids,
            5000,
            {}
        ).then((vote_objs: any) => {
            currentRef.current = current.concat(
                Immutable.List(
                    vote_objs
                        .filter((a: any) => !!a)
                        .map((a: any) =>
                            a.get(
                                isWitness
                                    ? "witness_account"
                                    : "committee_member_account"
                            )
                        )
                )
            );
            if (!!vote_objs[vote_objs.length - 1]) {
                // there are more valid vote objs, fetch 10 more
                const nextVoteIds = [];
                for (let i = lastIdx + 11; i <= lastIdx + 20; i++) {
                    nextVoteIds.push(`1.${isWitness ? "6" : "5"}.${i}`);
                }
                return getVoteObjects(type, nextVoteIds);
            }
            forceUpdate();
        });
    }

    function onRemoveProxy() {
        publish(null);
    }

    function onPublish() {
        publish(state.proxy_account_id);
    }

    function publish(new_proxy_id: any) {
        const updated_account = account.toJS();
        const updateObject: any = {account: updated_account.id};
        const new_options: any = {memo_key: updated_account.options.memo_key};
        new_options.voting_account = new_proxy_id ? new_proxy_id : "1.2.5";
        new_options.num_witness = state.witnesses.size;
        new_options.num_committee = state.committee.size;

        updateObject.new_options = new_options;
        // Set fee asset
        updateObject.fee = {
            amount: 0,
            asset_id: (accountUtils as any).getFinalFeeAsset(
                updated_account.id,
                "account_update"
            )
        };

        // Remove votes for expired workers
        let {vote_ids} = state;
        const workers = getWorkerArray();
        const now = new Date();

        function removeVote(list: any, vote: any) {
            if (list.includes(vote)) {
                list = list.delete(vote);
            }
            return list;
        }

        workers.forEach((worker: any) => {
            if (worker) {
                if (
                    new Date(worker.get("work_end_date")).getTime() <=
                    now.getTime()
                ) {
                    vote_ids = removeVote(vote_ids, worker.get("vote_for"));
                }

                // TEMP Remove vote_against since they're no longer used
                vote_ids = removeVote(vote_ids, worker.get("vote_against"));
            }
        });

        // Submit votes
        (FetchChainObjects as any)(
            (ChainStore as any).getWitnessById,
            state.witnesses.toArray(),
            4000
        )
            .then((res: any) => {
                const witnesses_vote_ids = res.map((o: any) =>
                    o.get("vote_id")
                );
                return Promise.all([
                    Promise.resolve(witnesses_vote_ids),
                    (FetchChainObjects as any)(
                        (ChainStore as any).getCommitteeMemberById,
                        state.committee.toArray(),
                        4000
                    )
                ]);
            })
            .then((res: any) => {
                updateObject.new_options.votes = res[0]
                    .concat(res[1].map((o: any) => o.get("vote_id")))
                    .concat(
                        vote_ids
                            .filter((id: any) => {
                                return id.split(":")[0] === "2";
                            })
                            .toArray()
                    )
                    .sort((a: any, b: any) => {
                        const a_split = a.split(":");
                        const b_split = b.split(":");

                        return (
                            parseInt(a_split[1], 10) - parseInt(b_split[1], 10)
                        );
                    });
                (ApplicationApi as any).updateAccount(updateObject);
            });
    }

    function getWorkerArray() {
        const workerArray: any[] = [];

        (ChainStore as any).workers.forEach((workerId: any) => {
            const worker = (ChainStore as any).getObject(
                workerId,
                false,
                false
            );
            if (worker) workerArray.push(worker);
        });

        return workerArray;
    }

    function onReset() {
        const s = state;
        mergeState({
            proxy_account_id: s.prev_proxy_account_id,
            current_proxy_input: s.prev_proxy_input,
            witnesses: s.prev_witnesses,
            committee: s.prev_committee,
            workers: s.prev_workers,
            vote_ids: s.prev_vote_ids
        });
        updateAccountData(account, {
            proxy_account_id: s.prev_proxy_account_id
        });
    }

    function onAddItem(collection: string, item_id: any) {
        mergeState({[collection]: state[collection].push(item_id)});
    }

    function onRemoveItem(collection: string, item_id: any) {
        mergeState({
            [collection]: state[collection].filter(
                (i: any) => i !== item_id
            )
        });
    }

    function onChangeVotes(addVotes: any[], removeVotes: any[]) {
        let vote_ids = state.vote_ids;
        if (addVotes.length) {
            addVotes.forEach(vote => {
                vote_ids = vote_ids.add(vote);
            });
        }
        if (removeVotes) {
            removeVotes.forEach((vote: any) => {
                vote_ids = vote_ids.delete(vote);
            });
        }

        mergeState({vote_ids});
    }

    function onProxyChange(current_proxy_input: string) {
        const proxyAccount = (ChainStore as any).getAccount(
            current_proxy_input
        );
        if (
            !proxyAccount ||
            (proxyAccount &&
                proxyAccount.get("id") !== state.proxy_account_id)
        ) {
            mergeState({
                proxy_account_id: "",
                proxy_witnesses: Immutable.Set(),
                proxy_committee: Immutable.Set(),
                proxy_workers: Immutable.Set()
            });
        }
        mergeState({current_proxy_input});
    }

    function onProxyAccountFound(proxy_account: any) {
        const proxy_account_id = proxy_account ? proxy_account.get("id") : "";
        if (state.proxy_account_id !== proxy_account_id) {
            mergeState({proxy_account_id});
            updateAccountData(account, {proxy_account_id});
        }
    }

    function getBudgetObject(lastBudgetObjectOverride?: string) {
        const lastBudgetObject =
            lastBudgetObjectOverride || state.lastBudgetObject;
        const budgetObject = (ChainStore as any).getObject(lastBudgetObject);
        const idIndex = parseInt(lastBudgetObject.split(".")[2], 10);
        if (budgetObject) {
            let timestamp = budgetObject.get("time");
            if (!/Z$/.test(timestamp)) {
                timestamp += "Z";
            }
            const now = new Date();

            /* Use the last valid budget object to estimate the current budget object id.
             ** Budget objects are created once per hour
             */
            const currentID =
                idIndex +
                Math.floor(
                    ((now as any) - (new Date(timestamp) as any)) /
                        1000 /
                        60 /
                        60
                ) -
                1;
            if (idIndex >= currentID) return;
            const newID = "2.13." + Math.max(idIndex, currentID);
            const newIDInt = parseInt(newID.split(".")[2], 10);
            (FetchChainObjects as any)(
                (ChainStore as any).getObject,
                [newID],
                undefined,
                {}
            ).then((res: any) => {
                const [lbo] = res;
                if (lbo === null) {
                    // The object does not exist, the id was too high
                    const lastId = `2.13.${newIDInt - 1}`;
                    if (lastId != lastBudgetObject) {
                        mergeState({lastBudgetObject: lastId});
                        getBudgetObject(lastId);
                    }
                } else {
                    (SettingsStore as any).setLastBudgetObject(newID);
                    mergeState({lastBudgetObject: newID});
                }
            });
        } else {
            // The object does not exist, decrement the ID
            const newID = `2.13.${idIndex - 1}`;
            (FetchChainObjects as any)(
                (ChainStore as any).getObject,
                [newID],
                undefined,
                {}
            ).then((res: any) => {
                const [lbo] = res;
                if (lbo === null) {
                    // The object does not exist, the id was too high
                    const lastId = `2.13.${idIndex - 2}`;
                    mergeState({lastBudgetObject: lastId});
                    getBudgetObject(lastId);
                } else {
                    (SettingsStore as any).setLastBudgetObject(newID);
                    mergeState({lastBudgetObject: newID});
                }
            });
        }
    }

    function handleFilterChange(e: any) {
        mergeState({filterSearch: e.target.value || ""});
    }

    function showCreateLockModal() {
        mergeState({
            isCreateLockModalVisible: true,
            isCreateLockModalVisibleBefore: true
        });
    }

    function hideCreateLockModal() {
        mergeState({isCreateLockModalVisible: false});
    }

    function getBudgets(globalObj: any) {
        let budgetObject;
        if (state.lastBudgetObject) {
            budgetObject = (ChainStore as any).getObject(
                state.lastBudgetObject
            );
        }
        let totalBudget = 0;
        let workerBudget = globalObj
            ? parseInt(
                  globalObj.getIn(["parameters", "worker_budget_per_day"]),
                  10
              )
            : 0;
        if (budgetObject) {
            workerBudget = Math.min(
                24 * budgetObject.getIn(["record", "worker_budget"]),
                workerBudget
            );
            totalBudget = Math.min(
                24 * budgetObject.getIn(["record", "worker_budget"]),
                workerBudget
            );
        }
        return {totalBudget, workerBudget};
    }

    function getProxyInput(accountHasProxy: boolean) {
        return (
            <React.Fragment>
                <AccountSelector
                    label="account.votes.proxy_short"
                    style={{
                        width: "50%",
                        maxWidth: 250,
                        display: "inline-block"
                    }}
                    account={state.current_proxy_input}
                    accountName={state.current_proxy_input}
                    onChange={onProxyChange}
                    onAccountChanged={onProxyAccountFound}
                    tabIndex={1}
                    placeholder={counterpart.translate(
                        "account.votes.set_proxy"
                    )}
                    tooltip={counterpart.translate(
                        !state.proxy_account_id
                            ? "tooltip.proxy_search"
                            : "tooltip.proxy_remove"
                    )}
                    hideImage
                >
                    <span
                        style={{
                            paddingLeft: 5,
                            position: "relative",
                            top: 9
                        }}
                    >
                        <TypedLink to="/help/voting">
                            <Icon
                                name="question-circle"
                                title="icons.question_circle"
                                size="1x"
                            />
                        </TypedLink>
                    </span>
                </AccountSelector>
                {accountHasProxy && (
                    <Button
                        style={{marginLeft: "1rem"}}
                        onClick={onRemoveProxy}
                        tabIndex={9}
                    >
                        <Translate content="account.perm.remove_proxy" />
                    </Button>
                )}
            </React.Fragment>
        );
    }

    function getHideLegacyOptions() {
        return (
            <div
                className="inline-block"
                style={{marginLeft: "0.5em"}}
                onClick={() => {
                    mergeState({
                        hideLegacyProposals: !state.hideLegacyProposals
                    });
                }}
            >
                <Tooltip
                    title={counterpart.translate("tooltip.legacy_explanation")}
                >
                    <Switch
                        style={{marginRight: 6, marginTop: -3}}
                        checked={state.hideLegacyProposals}
                    />
                    <Translate content="account.votes.hide_legacy_proposals" />
                </Tooltip>
            </div>
        );
    }

    function getActionButtons() {
        return (
            <Tooltip
                title={counterpart.translate(
                    "account.votes.cast_votes_through_one_operation"
                )}
                mouseEnterDelay={0.5}
            >
                <div
                    style={{
                        float: "right"
                    }}
                >
                    <Button
                        type="primary"
                        onClick={onPublish}
                        tabIndex={4}
                        disabled={!isChanged() ? true : undefined}
                    >
                        <Translate content="account.votes.publish" />
                    </Button>
                    <Button
                        style={{marginLeft: "8px"}}
                        onClick={onReset}
                        tabIndex={8}
                    >
                        <Translate content="account.perm.reset" />
                    </Button>
                </div>
            </Tooltip>
        );
    }

    const {
        prev_proxy_account_id,
        hideLegacyProposals,
        filterSearch,
        proxy_witnesses,
        witnesses,
        proxy_committee,
        committee,
        vote_ids,
        proxy_vote_ids,
        proxy_account_id
    } = state;
    const accountHasProxy = !!prev_proxy_account_id;
    const preferredUnit = settings.get("unit") || "1.3.0";
    const hasProxy = !!proxy_account_id;
    const {totalBudget, workerBudget} = getBudgets(globalObject);

    const actionButtons = getActionButtons();
    const proxyInput = getProxyInput(accountHasProxy);
    const hideLegacy = getHideLegacyOptions();

    const onTabChange = (value: string) => {
        history.push(value);
    };

    const increase_voting_power = (
        <Tooltip
            title={counterpart.translate(
                "account.votes.cast_votes_through_one_operation"
            )}
            mouseEnterDelay={0.5}
        >
            <div
                style={{
                    float: "right"
                }}
            >
                <Button type="primary" onClick={showCreateLockModal}>
                    <Translate content="voting.increase_voting_power" />
                </Button>
            </div>
        </Tooltip>
    );

    return (
        <div className="main-content grid-content">
            <div className="voting">
                <div className="padding">
                    <div>
                        <Translate content="voting.title" component="h1" />
                        <Translate content="voting.description" component="p" />
                    </div>
                    <div className="ticket-row">
                        {increase_voting_power}
                        <Translate
                            content="voting.ticket_explanation"
                            component="p"
                        />
                    </div>
                    <div className="proxy-row">
                        {proxyInput}
                        {actionButtons}
                    </div>
                </div>

                <Tabs
                    activeKey={location.pathname}
                    animated={false}
                    style={{
                        display: "table",
                        height: "100%",
                        width: "100%"
                    }}
                    onChange={onTabChange}
                >
                    {state.tabs.map((tab: any) => {
                        const TabContent = tab.content;

                        return (
                            <Tabs.TabPane
                                key={tab.link}
                                tab={counterpart.translate(tab.translate)}
                            >
                                <TabContent
                                    all_witnesses={allWitnessesRef.current}
                                    proxy_witnesses={proxy_witnesses}
                                    witnesses={witnesses}
                                    proxy_account_id={proxy_account_id}
                                    onFilterChange={handleFilterChange}
                                    addWitnessHandler={(item_id: any) =>
                                        onAddItem(WITNESSES_KEY, item_id)
                                    }
                                    removeWitnessHandler={(item_id: any) =>
                                        onRemoveItem(WITNESSES_KEY, item_id)
                                    }
                                    hasProxy={hasProxy}
                                    globalObject={globalObject}
                                    filterSearch={filterSearch}
                                    account={account}
                                    all_committee={allCommitteeRef.current}
                                    proxy_committee={proxy_committee}
                                    committee={committee}
                                    addCommitteeHandler={(item_id: any) =>
                                        onAddItem(COMMITTEE_KEY, item_id)
                                    }
                                    removeCommitteeHandler={(item_id: any) =>
                                        onRemoveItem(COMMITTEE_KEY, item_id)
                                    }
                                    vote_ids={vote_ids}
                                    proxy_vote_ids={proxy_vote_ids}
                                    hideLegacy={hideLegacy}
                                    preferredUnit={preferredUnit}
                                    totalBudget={totalBudget}
                                    workerBudget={workerBudget}
                                    hideLegacyProposals={hideLegacyProposals}
                                    onChangeVotes={onChangeVotes}
                                    getWorkerArray={getWorkerArray}
                                    viewSettings={viewSettings}
                                />
                            </Tabs.TabPane>
                        );
                    })}
                </Tabs>
            </div>
            {/* CreateLock Modal */}
            {(state.isCreateLockModalVisible ||
                state.isCreateLockModalVisibleBefore) && (
                <CreateLockModal
                    visible={state.isCreateLockModalVisible}
                    hideModal={hideCreateLockModal}
                    asset={"1.3.0"}
                    account={account}
                />
            )}
        </div>
    );
}

function AccountVotingContainer(props: any) {
    useChainStoreTick();

    const initialBudget = (ChainStore as any).getObject(props.initialBudget);
    const globalObject = (ChainStore as any).getObject(props.globalObject);
    const proxy = (ChainStore as any).getAccount(props.proxy);

    if (!initialBudget || !globalObject || !proxy) {
        return <span />;
    }

    return (
        <AccountVoting
            {...props}
            initialBudget={initialBudget}
            globalObject={globalObject}
            proxy={proxy}
        />
    );
}

function FillMissingProps(props: any) {
    const missingProps: any = {};
    if (!props.initialBudget) {
        missingProps.initialBudget = (SettingsStore as any).getLastBudgetObject();
    }
    if (!props.account) {
        // don't use store listener, user might be looking at different account. this is for reasonable default
        let accountName =
            (AccountStore as any).getState().currentAccount ||
            (AccountStore as any).getState().passwordAccount;
        accountName =
            accountName && accountName !== "null"
                ? accountName
                : "committee-account";
        missingProps.account = accountName;
    }
    if (!props.proxy) {
        const account = (ChainStore as any).getAccount(props.account);
        let proxy = null;
        if (account) {
            proxy = account.getIn(["options", "voting_account"]);
        } else {
            throw "Account must be loaded";
        }
        missingProps.proxy = proxy;
    }

    return <AccountVotingContainer {...props} {...missingProps} />;
}

export default FillMissingProps;
