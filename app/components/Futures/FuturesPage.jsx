import React from "react";
import {connect} from "alt-react";
import Translate from "react-translate-component";
import {Apis} from "bitsharesjs-ws";
import AccountStore from "stores/AccountStore";
import FuturesMarkets from "./FuturesMarkets";
import FuturesPositions from "./FuturesPositions";
import FuturesOrders from "./FuturesOrders";
import FuturesOrderForm from "./FuturesOrderForm";
import withAccountId from "lib/common/withAccountId";

/**
 * The futures page: markets, an order ticket, the account's resting orders and its open
 * positions.
 *
 * The market list is fetched once here rather than separately in every child, so the order
 * form prices against exactly the same markets the table is showing. Two independent fetches
 * would eventually disagree, and the moment they did it would be the order form that was
 * wrong -- which is the one place it matters.
 */
class FuturesPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {markets: [], reload: 0};
    }

    componentDidMount() {
        this._fetchMarkets();
    }

    _fetchMarkets = () => {
        Apis.instance()
            .db_api()
            .exec("list_futures_markets", [100, "1.24.0"])
            .then(markets => this.setState({markets: markets || []}))
            .catch(() => this.setState({markets: []}));
    };

    /// Bump a counter the children watch, so a fill or a cancel refreshes every view of it
    /// rather than leaving one stale table contradicting another.
    _refresh = () => {
        this._fetchMarkets();
        this.setState(state => ({reload: state.reload + 1}));
    };

    render() {
        const {currentAccount, accountId} = this.props;
        const {markets, reload} = this.state;

        return (
            <div className="grid-content">
                <div className="grid-wrapper padding">
                    <Translate component="h3" content="futures.title" />
                    <Translate
                        component="p"
                        className="oracle-intro"
                        content="futures.intro"
                    />
                    <FuturesMarkets key={"m" + reload} />

                    <div className="futures-trade-row">
                        <FuturesOrderForm
                            markets={markets}
                            account={accountId}
                            onPlaced={this._refresh}
                        />
                    </div>

                    <FuturesOrders key={"o" + reload} account={accountId} />

                    <Translate
                        component="h4"
                        className="futures-subhead"
                        content="futures.your_positions"
                    />
                    <FuturesPositions key={"p" + reload} account={accountId} />
                </div>
            </div>
        );
    }
}

export default connect(withAccountId(FuturesPage), {
    listenTo() {
        return [AccountStore];
    },
    getProps() {
        return {
            currentAccount:
                AccountStore.getState().currentAccount ||
                AccountStore.getState().passwordAccount
        };
    }
});
