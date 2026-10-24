// Local replacement for react-foundation-apps's
// `utils/foundation-api.js` (docs/UI_MIGRATION_PLAN.md, Phase 9
// dependency cleanup). That module's `subscribe`/`publish`/`unsubscribe`
// - the only 3 methods any real call site in this app ever used
// (grep-confirmed: `closeActiveElements`/`generateUuid`/`modifySettings`/
// `getSettings` have zero callers) - were themselves just direct aliases
// of the `pubsub-js` package:
//
//   module.exports = {
//       subscribe: PubSub.subscribe,
//       publish: PubSub.publish,
//       unsubscribe: PubSub.unsubscribe,
//       ...
//   };
//
// (`node_modules/react-foundation-apps/src/utils/foundation-api.js`,
// before that package was removed). So this is a pure dependency swap,
// not a behavior port: every call site's modal/notification open-close
// pub/sub channel keeps working exactly as before, now talking to
// `pubsub-js` directly instead of through react-foundation-apps's
// pass-through. `pubsub-js` itself was already in `node_modules`
// (a transitive dependency of react-foundation-apps) - promoted to a
// direct dependency in package.json since this file now imports it.
import PubSub from "pubsub-js";

export default {
    subscribe: PubSub.subscribe,
    publish: PubSub.publish,
    unsubscribe: PubSub.unsubscribe
};
