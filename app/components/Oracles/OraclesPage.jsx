import React from "react";
import Translate from "react-translate-component";
import OracleList from "./OracleList";

class OraclesPage extends React.Component {
    render() {
        return (
            <div className="grid-content">
                <div className="grid-wrapper padding">
                    <Translate component="h3" content="oracles.title" />
                    <Translate
                        component="p"
                        className="oracle-intro"
                        content="oracles.intro"
                    />
                    <OracleList />
                </div>
            </div>
        );
    }
}

export default OraclesPage;
