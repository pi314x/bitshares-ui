// TypeScript/functional-component port of the legacy Connections.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import {Link} from "react-router-dom";
import Translate from "react-translate-component";

const LinkComponent = Link as React.ComponentType<any>;

interface ConnectionsProps {
    organizations?: any;
    blackList?: any;
    isMyAccount?: boolean;
}

function Connections({organizations, blackList, isMyAccount}: ConnectionsProps) {
    const knownBy = organizations
        ? organizations.map((account: any, i: number) => {
              if (i < 5) {
                  return (
                      <li key={account}>
                          X: <LinkComponent to={`/account/${account}`}>{account}</LinkComponent>
                      </li>
                  );
              }
          })
        : null;

    const unwanted = blackList
        ? blackList.map((account: any, i: number) => {
              if (i < 5) {
                  return (
                      <li key={account}>
                          X: <LinkComponent to={`/account/${account}`}>{account}</LinkComponent>
                      </li>
                  );
              }
          })
        : null;

    return (
        <div>
            <h5>
                <Translate component="span" content="account.connections.known" />
            </h5>
            <ul style={{listStyle: "none", marginLeft: "0.25rem"}}>{knownBy}</ul>
            <hr />
            <h5 className="inline-block">
                <Translate component="span" content="account.connections.black" />
            </h5>{" "}
            {isMyAccount ? (
                <button className="hollow button tiny">Claim</button>
            ) : null}
            <ul style={{listStyle: "none", marginLeft: "0.25rem"}}>{unwanted}</ul>
        </div>
    );
}

export default Connections;
