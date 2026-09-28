// TypeScript/functional-component port of the legacy Identicon.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// The legacy string ref (`ref="canvas"`, `this.refs.canvas`) is replaced
// by a `useRef<HTMLCanvasElement>`. `repaint()` (called from both
// `componentDidMount` and `componentDidUpdate`) is replicated with a
// `useEffect` keyed on exactly the values `shouldComponentUpdate` used to
// gate re-renders (`size.height`, `size.width`, `account`) - since
// `shouldComponentUpdate` returning `false` here would also have skipped
// `componentDidUpdate`'s `repaint()` call, this dependency array
// reproduces the same "repaint exactly when these change" behavior
// directly, rather than needing to separately replicate
// `shouldComponentUpdate`'s render-blocking.
//
// `canvas_id_count` (a module-scope mutable counter, incremented once per
// mounted instance to build a unique canvas `id`) is kept as a module-
// scope counter; the per-instance increment is replicated with a
// `useState` lazy initializer (runs exactly once per instance, matching
// the original constructor).
import * as React from "react";
import sha256 from "js-sha256";
import jdenticon from "jdenticon";

let canvas_id_count = 0;

interface IdenticonProps {
    size: {height: number; width: number};
    account?: string;
    id?: string;
}

function Identicon({account, size}: IdenticonProps) {
    const [canvas_id] = React.useState(
        () => "identicon_" + (account || "") + ++canvas_id_count
    );
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

    const {height, width} = size;
    const hash = account ? sha256(account) : null;

    const repaint = () => {
        if (account) {
            jdenticon.updateById(canvas_id);
        } else if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
            const canvasSize = ctx.canvas.width;
            ctx.clearRect(0, 0, canvasSize, canvasSize);
            ctx.fillRect(0, 0, canvasSize, canvasSize);
            ctx.clearRect(0 + 1, 0 + 1, canvasSize - 2, canvasSize - 2);
            ctx.font = `${canvasSize}px sans-serif`;
            ctx.fillText("?", canvasSize / 4, canvasSize - canvasSize / 6);
        }
    };

    React.useEffect(() => {
        repaint();
    }, [size.height, size.width, account]);

    return (
        <canvas
            id={canvas_id}
            ref={canvasRef}
            style={{height, width}}
            width={width * 2}
            height={height * 2}
            data-jdenticon-hash={hash}
        />
    );
}

export default Identicon;
