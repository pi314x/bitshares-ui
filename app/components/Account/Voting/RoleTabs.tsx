import * as React from "react";
import {ModalAsPage} from "../../../design-system/Modal";
import JoinWitnessesModal from "../../Modal/JoinWitnessesModal";
import JoinCommitteeModal from "../../Modal/JoinCommitteeModal";

// Becoming a witness, updating the witness and becoming a committee member are
// tabs of the voting page, next to the lists - not popups over them. They are
// the same forms (and the same transactions) as the dialogs they replace,
// shown in the page; finishing or cancelling returns to the lists.

interface RoleTabProps {
    account: any;
    /** Back to the voting lists. */
    onDone: () => void;
}

export function JoinWitnessTab({account, onDone}: RoleTabProps) {
    return (
        <ModalAsPage>
            <JoinWitnessesModal
                visible={true}
                account={account}
                updateOrCreate={false}
                hideModal={onDone}
            />
        </ModalAsPage>
    );
}

export function UpdateWitnessTab({account, onDone}: RoleTabProps) {
    return (
        <ModalAsPage>
            <JoinWitnessesModal
                visible={true}
                account={account}
                updateOrCreate={true}
                hideModal={onDone}
            />
        </ModalAsPage>
    );
}

export function JoinCommitteeTab({account, onDone}: RoleTabProps) {
    return (
        <ModalAsPage>
            <JoinCommitteeModal
                visible={true}
                account={account}
                hideModal={onDone}
            />
        </ModalAsPage>
    );
}
