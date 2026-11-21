# ioxbank Instant-Gateway-Dienst
Der ioxbank-Instant-Gateway-Dienst verbindet Kryptowährungen zwischen BitShares und anderen Blockchains. Blockchain-Transaktionen werden sofort abgewickelt, sobald die Blöcke auf der jeweiligen Blockchain bestätigt sind. Die von ioxbank unterstützten Kryptowährungen erkennst du leicht daran, dass ihnen das Präfix **IOB.** vorangestellt ist. Du findest sie auf der Seite zur Asset-Suche.

### Informationen zur Gateway-Transparenz

## XRP
- [XRPL-Guthaben](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [Aktuelle Menge IOB.XRP](/asset/IOB.XRP)

## XLM
- [XLM-Guthaben](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [Aktuelle Menge IOB.XLM](/asset/IOB.XLM)

## Gateway-Funktionen

### Funktionen von IOB.XRP
- Instant-Gateway
- Mindestbetrag: 10 XRP
- Kein KYC
- Keine Limits
- 0 % Marktgebühr für Maker/Taker
- Niedrige Auszahlungsgebühr

### Funktionen von IOB.XLM
- Instant-Gateway
- Mindestbetrag: 50 XLM
- Kein KYC
- Keine Limits
- 0 % Marktgebühr für Maker/Taker
- Niedrige Auszahlungsgebühr

## Gateway-Methoden

### Ein- und Auszahlen mit der Referenz-Wallet-Oberfläche

- **Einzahlen:** Klicke im Burger-Menü auf *Einzahlen* und wähle XRP oder XLM; dir werden eine Adresse und (Tag oder Memo) angezeigt, die du extern für die Einzahlung verwenden musst; gib bei der Transaktion an das Gateway unbedingt den Tag oder das Memo an.
- **Auszahlen:** Klicke im Burger-Menü auf *Auszahlen* und wähle XRP oder XLM; gib deine Zieladresse und (Tag oder Memo) sorgfältig ein. Wenn du eine Börsenadresse statt deiner eigenen Adresse verwendest, nutze genau die Angaben, die dir die Börse genannt hat.

### XRP-Einzahlung, wenn du deine BitShares-**User-ID** bereits kennst
- **Zieladresse des XRP-Gateways:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **Ziel des XRP-Gateways (Tag oder Memo):** BitShares-User-ID (ohne 1.2.)

### XLM-Einzahlung, wenn du deine BitShares-**User-ID** bereits kennst
- **Zieladresse des XLM-Gateways:** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **Ziel des XLM-Gateways (Tag oder Memo):** BitShares-User-ID (ohne 1.2.)

### Manuell auszahlen mit **Senden** von Assets

### XRP von deiner BitShares-Wallet in deine XRP-Wallet auszahlen
Sende deine **IOB.XRP**-Assets an das BitShares-Blockchain-Konto [ioxbank-gateway](/account/ioxbank-gateway) und gib im BitShares-Memo deine XRP-Zieladresse und das Ziel (Tag oder Memo) wie in den folgenden Beispielen an. Ersetze *xrp-address* durch deine XRP-Zieladresse und **tag-or-memo-number** durch die Nummer deines Ziels (Tag oder Memo). Falls du keine Nummer (Tag oder Memo) brauchst, weil dir die Schlüssel der Zieladresse gehören, kannst du dein **IOB.XRP**-Asset einfach an [ioxbank-gateway](/account/ioxbank-gateway) senden und nur deine **xrp-destination-address** ohne Nummer (Tag oder Memo) angeben:

Format des BitShares-Memos
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

Beispiele für das BitShares-Memo
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### XLM von deiner BitShares-Wallet in deine XLM-Wallet auszahlen
Sende deine **IOB.XLM**-Assets an das BitShares-Blockchain-Konto [ioxbank-gateway](/account/ioxbank-gateway) und gib im BitShares-Memo deine XLM-Zieladresse und das Ziel (Tag oder Memo) wie in den folgenden Beispielen an. Ersetze *xlm-address* durch deine XLM-Zieladresse und **tag-or-memo-number** durch die Nummer deines Ziels (Tag oder Memo). Falls du keine Nummer (Tag oder Memo) brauchst, weil dir die Schlüssel der Zieladresse gehören, kannst du dein **IOB.XLM**-Asset einfach an [ioxbank-gateway](/account/ioxbank-gateway) senden und nur deine **xlm-destination-address** ohne Nummer (Tag oder Memo) angeben:

Format des BitShares-Memos
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

Beispiele für das BitShares-Memo
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## Technischer Support
- [Live-Support](https://t.me/ioxbank)
- [Ticket eröffnen](https://support.ioxbank.com)
