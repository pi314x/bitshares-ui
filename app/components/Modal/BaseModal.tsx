// TypeScript/functional-component port of the legacy BaseModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// The original is already a stub component (its real implementation was
// removed per github.com/bitshares/bitshares-ui/issues/1942, leaving
// only a placeholder message) with several lines of commented-out
// imports/propTypes describing what it used to be - preserved verbatim
// as inert comments, exactly as in the original, rather than deleted.
import * as React from "react";
// import PropTypes from "prop-types";
// import ZfApi from "react-foundation-apps/src/utils/foundation-api";
// import Modal from "react-foundation-apps/src/modal";
// import Trigger from "react-foundation-apps/src/trigger";
// import Translate from "react-translate-component";

// import {getLogo} from "branding";
// var logo = getLogo();

function BaseModal() {
    return (
        <div>
            Base Modal was removed by task following below:
            <br />
            https://github.com/bitshares/bitshares-ui/issues/1942
        </div>
    );
}

// BaseModal.defaultProps = {
//     overlay: false
// };
//
// BaseModal.propTypes = {
//     id: PropTypes.string.isRequired,
//     onClose: PropTypes.func,
//     className: PropTypes.string,
//     overlay: PropTypes.bool,
//     overlayClose: PropTypes.bool,
//     noCloseBtn: PropTypes.bool
// };

export default BaseModal;
