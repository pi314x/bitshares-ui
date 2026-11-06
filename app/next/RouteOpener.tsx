import * as React from "react";
import {useNavigate} from "react-router-dom";
import {setRouteOpener} from "../lib/common/openRoute";

/** Lets what is drawn outside the router (a toast) open a page of the app. Mount it once, inside the router. */
export default function RouteOpener(): null {
    const navigate = useNavigate();
    React.useEffect(() => setRouteOpener(to => navigate(to)), [navigate]);
    return null;
}
