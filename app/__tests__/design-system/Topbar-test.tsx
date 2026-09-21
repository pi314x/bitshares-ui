import * as React from "react";
import {render} from "@testing-library/react";
import {Topbar} from "../../design-system/Topbar";

describe("design-system/Topbar", () => {
    it("shows Connected when rpc_connection_status is open", () => {
        const {getByText} = render(
            <Topbar
                crumb="Dashboard"
                connectionStatus="open"
                accountName="init0"
            />
        );
        expect(getByText("Connected")).toBeTruthy();
        expect(getByText("init0")).toBeTruthy();
    });

    it("surfaces the raw status when not connected, instead of hiding it", () => {
        const {getByText} = render(
            <Topbar
                crumb="Dashboard"
                connectionStatus="closed"
                accountName={null}
            />
        );
        expect(getByText("closed")).toBeTruthy();
    });

    it("falls back to a connecting label when status is null", () => {
        const {getByText} = render(
            <Topbar crumb="Dashboard" connectionStatus={null} accountName={null} />
        );
        expect(getByText("Connecting…")).toBeTruthy();
    });
});
