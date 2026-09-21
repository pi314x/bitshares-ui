// HelpContent.jsx uses webpack's `require.context`, which Jest doesn't
// implement; mock it out rather than teach Jest webpack-specific APIs just
// to unit test FormattedAsset's own rendering logic.
jest.mock("../../../components/Utility/HelpContent", () => () => null);

import * as React from "react";
import {render} from "@testing-library/react";

const FormattedAsset = require("../../../components/Utility/FormattedAsset.jsx")
    .default;

describe("<FormattedAsset>", function() {
    it("can be imported and rendered without an asset (loading state)", function() {
        const {container} = render(<FormattedAsset amount={null} />);
        expect(container).toBeTruthy();
    });
});
