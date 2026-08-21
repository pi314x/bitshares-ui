import React from "react";
import {connect} from "alt-react";
import Translate from "react-translate-component";
import AccountStore from "stores/AccountStore";
import FuturesMarkets from "./FuturesMarkets";
import FuturesPositions from "./FuturesPositions";

class FuturesPage extends React.Component {
    render() {
        return (
            <div className="grid-content">
                <div className="grid-wrapper padding">
                    <Translate component="h3" content="futures.title" />
                    <Translate
                        component="p"
                        className="oracle-intro"
                        content="futures.intro"
                    />
                    <FuturesMarkets />

                    <Translate
                        component="h4"
                        className="futures-subhead"
                        content="futures.your_positions"
                    />
                    <FuturesPositions account={this.props.currentAccount} />
                </div>
            </div>
        );
    }
}

export default connect(FuturesPage, {
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
