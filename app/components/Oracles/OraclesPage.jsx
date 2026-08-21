import React from "react";
import {connect} from "alt-react";
import Translate from "react-translate-component";
import AccountStore from "stores/AccountStore";
import OracleList from "./OracleList";
import {OracleCreateForm} from "./OracleForms";
import withAccountId from "lib/common/withAccountId";

class OraclesPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {reload: 0};
    }

    _refresh = () => this.setState(s => ({reload: s.reload + 1}));

    render() {
        const {accountId} = this.props;
        return (
            <div className="grid-content">
                <div className="grid-wrapper padding">
                    <Translate component="h3" content="oracles.title" />
                    <Translate
                        component="p"
                        className="oracle-intro"
                        content="oracles.intro"
                    />
                    <OracleList key={this.state.reload} account={accountId} />
                    <OracleCreateForm
                        account={accountId}
                        onChanged={this._refresh}
                    />
                </div>
            </div>
        );
    }
}

export default connect(withAccountId(OraclesPage), {
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
