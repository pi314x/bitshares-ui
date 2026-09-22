// Regression test for a real bug this rewrite shipped: DashboardList.tsx
// passed the bare `ChainStore.getObject` method reference into
// aggregateOpenOrders/aggregateCollateralAndDebt/resolveAccountBalanceIds
// instead of `id => ChainStore.getObject(id)`. ChainStore's methods read
// `this.objects_by_id` internally, so calling the unbound reference as a
// plain function (exactly what those three functions' `.forEach` callback
// does) threw "Cannot read properties of undefined (reading
// 'objects_by_id')" for any account that actually has orders, call
// orders, or balances - i.e. every real, populated account. A pure unit
// test of balanceCalculations.ts (which takes `getObject` as a parameter
// and always calls it correctly) can't catch this - the bug was in how
// the caller passed the reference, so this test renders the real
// component tree against the real bitsharesjs ChainStore, the same way
// it's used in production, to catch that class of mistake again if it
// recurs.
//
// HelpContent.jsx (pulled in transitively via TotalBalanceValue ->
// FormattedAsset) uses webpack's `require.context`, which Jest doesn't
// implement - same mock as FormattedAsset-test.jsx uses for the same
// reason.
jest.mock("../../../components/Utility/HelpContent", () => () => null);

import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {IntlProvider} from "react-intl";
import {List} from "immutable";
import {ChainStore} from "bitsharesjs";
import DashboardList from "../../../components/Dashboard/DashboardList";

import fixture from "./__fixtures__/alt-org-account.json";

function seedChainStore() {
    const cs: any = ChainStore;
    Object.keys(fixture.objects).forEach(id => {
        cs._updateObject((fixture.objects as any)[id]);
    });

    const balancesObj: {[k: string]: string} = {};
    fixture.balanceEntries.forEach(e => {
        balancesObj[e.asset_type] = e.balanceId;
    });
    const dummyAuthority = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [],
        address_auths: []
    };
    cs.accounts_by_name.set(fixture.accountName, fixture.accountId);
    cs.get_full_accounts_subscriptions.set(fixture.accountId, true);
    cs.get_full_accounts_subscriptions.set(fixture.accountName, true);
    cs._updateObject({
        id: fixture.accountId,
        name: fixture.accountName,
        lifetime_referrer_name: fixture.accountName,
        owner: dummyAuthority,
        active: dummyAuthority,
        options: {memo_key: "BTS1111111111111111111111111111111114T1Anm"},
        whitelisting_accounts: [],
        blacklisting_accounts: [],
        whitelisted_accounts: [],
        blacklisted_accounts: [],
        // The real bug only surfaces when these are non-empty - an
        // account with no orders/call orders never calls the broken
        // reference, so the fixture (which has real orders/call orders)
        // is essential here, not incidental.
        orders: fixture.orderIds,
        call_orders: fixture.callOrderIds,
        balances: balancesObj
    });
}

describe("DashboardList (rendered against the real bitsharesjs ChainStore)", () => {
    it("renders an account with real orders/call_orders/balances without throwing", () => {
        seedChainStore();

        const {getByText} = render(
            <IntlProvider locale="en">
                <MemoryRouter>
                    <DashboardList
                        accounts={List([fixture.accountName])}
                        ignoredAccounts={List()}
                        width={1400}
                        showMyAccounts={false}
                        isContactsList={true}
                    />
                </MemoryRouter>
            </IntlProvider>
        );

        expect(getByText(fixture.accountName)).toBeTruthy();
        expect(getByText(fixture.accountId)).toBeTruthy();
    });
});
