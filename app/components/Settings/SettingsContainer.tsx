// TypeScript port of the legacy SettingsContainer.jsx - was an
// AltContainer wired to SettingsStore (plus IntlStore/apiLatencies that
// Settings.jsx never actually read, see Settings.tsx's header comment),
// replaced with useAltStore.
import * as React from "react";
import SettingsStore from "stores/SettingsStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import Settings from "./Settings";

export interface SettingsContainerProps {
    deprecated?: boolean;
}

export default function SettingsContainer(props: SettingsContainerProps) {
    const settingsState = useAltStore<any>(SettingsStore);

    return (
        <Settings
            deprecated={props.deprecated}
            settings={settingsState.settings}
            viewSettings={settingsState.viewSettings}
            defaults={settingsState.defaults}
        />
    );
}
