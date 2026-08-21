import React from "react";
import {ChainStore} from "bitsharesjs";

/**
 * Resolve the signed-in account NAME to its account ID.
 *
 * AccountStore gives a name ("nathan"); the chain speaks ids ("1.2.17"). Read APIs happen to
 * accept either -- get_futures_positions_by_owner runs the string through
 * get_account_from_string -- so a name works there and the difference stays invisible.
 *
 * It stops being invisible in two places, and both fail quietly rather than loudly:
 *
 *   - Ownership checks. `oracle.owner === "nathan"` is false against "1.2.17", so an action
 *     the account is entitled to simply never appears, with nothing to indicate why.
 *   - Operations. protocol_id_type serialises an id; handed a name it produces a
 *     transaction the chain rejects, and the wallet has no way to explain what went wrong.
 *
 * ChainStore may not hold the account on first render, so this subscribes and updates when
 * it arrives instead of resolving once and giving up.
 */
export default function withAccountId(WrappedComponent) {
    return class WithAccountId extends React.Component {
        constructor(props) {
            super(props);
            this.state = {accountId: this._lookup(props.currentAccount)};
        }

        componentDidMount() {
            ChainStore.subscribe(this._update);
        }

        componentWillUnmount() {
            ChainStore.unsubscribe(this._update);
        }

        componentDidUpdate(prevProps) {
            if (prevProps.currentAccount !== this.props.currentAccount)
                this._update();
        }

        _lookup(name) {
            if (!name) return null;
            // Already an id: nothing to resolve.
            if (/^1\.2\.\d+$/.test(name)) return name;
            const account = ChainStore.getAccount(name);
            return account ? account.get("id") : null;
        }

        _update = () => {
            const accountId = this._lookup(this.props.currentAccount);
            if (accountId !== this.state.accountId) this.setState({accountId});
        };

        render() {
            return (
                <WrappedComponent
                    {...this.props}
                    accountId={this.state.accountId}
                />
            );
        }
    };
}
