"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignerRole = exports.UserRole = exports.DocumentStatus = void 0;
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["PENDING"] = "PENDING";
    DocumentStatus["ONCHAIN_CONFIRMED"] = "ONCHAIN_CONFIRMED";
    DocumentStatus["NOTARY_SIGNED"] = "NOTARY_SIGNED";
    DocumentStatus["FULLY_EXECUTED"] = "FULLY_EXECUTED";
    DocumentStatus["DISPUTED"] = "DISPUTED";
    DocumentStatus["REVOKED"] = "REVOKED";
})(DocumentStatus || (exports.DocumentStatus = DocumentStatus = {}));
var UserRole;
(function (UserRole) {
    UserRole["CITIZEN"] = "CITIZEN";
    UserRole["NOTARY"] = "NOTARY";
    UserRole["BANK_OFFICER"] = "BANK_OFFICER";
    UserRole["COURT_CLERK"] = "COURT_CLERK";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var SignerRole;
(function (SignerRole) {
    SignerRole["NOTARY"] = "NOTARY";
    SignerRole["BUYER"] = "BUYER";
    SignerRole["SELLER"] = "SELLER";
    SignerRole["OTHER"] = "OTHER";
})(SignerRole || (exports.SignerRole = SignerRole = {}));
