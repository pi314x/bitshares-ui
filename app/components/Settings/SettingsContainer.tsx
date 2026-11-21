// TypeScript port of the legacy SettingsContainer.jsx - was an
// AltContainer wired to SettingsStore (plus IntlStore/apiLatencies that
// Settings.jsx never actually read, see Settings.tsx's header comment),
// replaced with useReduxState.
import * as React from "react";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectSettingsState} from "../../store/slices/settingsSlice";
import Settings from "./Settings";

export interface SettingsContainerProps {
    deprecated?: boolean;
}

export default function SettingsContainer(props: SettingsContainerProps) {
    const settingsState = useReduxState<any>(selectSettingsState);

    return (
        <Settings
            deprecated={props.deprecated}
            settings={settingsState.settings}
            viewSettings={settingsState.viewSettings}
            defaults={settingsState.defaults}
        />
    );
}
