// Turns off immer's auto-freeze for every Redux Toolkit slice.
//
// Why (docs/UI_MIGRATION_PLAN.md, section 7.4): the Alt.js stores this
// state replaced handed out plain, mutable objects, and legacy call sites
// - `routerTransition.js` most prominently - mutate what `getState()`
// returns in place (`apiLatencies[url] = ...`, `node.hidden = ...`). With
// Redux Toolkit's default deep freeze those writes throw a TypeError in
// strict mode, and the very first one aborted the connection step, so the
// app never got past "Application initialization issues". Unit tests did
// not catch it; booting the built bundle did.
//
// Turning the freeze off restores the pre-migration semantics exactly. The
// sites found so far also copy before writing now, which is the correct
// pattern; this switch covers the ones nobody has found yet. Re-enable it
// once the `getState()` consumers are audited and cleaned up.
//
// Import-order matters: `createSlice` freezes each slice's initial state at
// definition time, so this module must be evaluated before any slice
// module. Import it first in `app/index.js` and in `reduxStore.ts`.
import {enableMapSet, setAutoFreeze} from "immer";

setAutoFreeze(false);

// Slices hold native `Map`s (the blockchain slice's `blockHeaders`). Reading
// one inside a reducer makes immer draft it, which throws "[Immer] The plugin
// for 'MapSet' has not been loaded" without this - and every block header
// fetched for a timestamp (BlockDate, the recent-activity lists) was lost.
enableMapSet();
