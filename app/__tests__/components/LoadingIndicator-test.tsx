import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import LoadingIndicator from "../../components/LoadingIndicator";

describe("LoadingIndicator", () => {
    it("draws three dots for three-bounce", () => {
        const html = renderToStaticMarkup(
            <LoadingIndicator type="three-bounce" />
        );
        expect((html.match(/<span><\/span>/g) || []).length).toBe(3);
        expect(html).toContain('role="status"');
    });

    it("draws a ring for circle and circle-small", () => {
        expect(
            renderToStaticMarkup(<LoadingIndicator type="circle" />)
        ).toContain("<svg");
        expect(
            renderToStaticMarkup(<LoadingIndicator type="circle-small" />)
        ).toContain("ringSmall");
    });

    it("shows the text and children in the default overlay", () => {
        const html = renderToStaticMarkup(
            <LoadingIndicator loadingText="Syncing">
                <b>x</b>
            </LoadingIndicator>
        );
        expect(html).toContain("Syncing");
        expect(html).toContain("<b>x</b>");
        expect(html).toContain("overlay");
    });
});
