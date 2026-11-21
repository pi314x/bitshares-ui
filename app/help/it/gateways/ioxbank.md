# Servizio gateway istantaneo ioxbank
Il servizio gateway istantaneo ioxbank collega criptovalute tra BitShares e altre blockchain. Le transazioni blockchain vengono regolate immediatamente non appena i blocchi sono confermati sulla blockchain. Le criptovalute supportate da ioxbank si riconoscono facilmente: hanno il prefisso **IOB.** e si trovano nella pagina di esplorazione degli asset.

### Informazioni sulla trasparenza del gateway

## XRP
- [Saldo XRPL](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [Offerta attuale di IOB.XRP](/asset/IOB.XRP)

## XLM
- [Saldo XLM](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [Offerta attuale di IOB.XLM](/asset/IOB.XLM)

## Funzioni del gateway

### Funzioni di IOB.XRP
- Gateway istantaneo
- Importo min.: 10 XRP
- Nessun KYC
- Nessun limite
- 0% di commissione di mercato per maker/taker
- Commissione di prelievo bassa

### Funzioni di IOB.XLM
- Gateway istantaneo
- Importo min.: 50 XLM
- Nessun KYC
- Nessun limite
- 0% di commissione di mercato per maker/taker
- Commissione di prelievo bassa

## Metodi del gateway

### Deposito/prelievo con l'interfaccia del portafoglio di riferimento

- **Deposito:** clicca su *Deposito* nel menu a hamburger, quindi scegli XRP o XLM; ti verranno mostrati un indirizzo e (un tag o un memo) da usare all'esterno per effettuare il deposito; assicurati di indicare il tag o il memo nella transazione verso il gateway.
- **Prelievo:** clicca su *Prelievo* nel menu a hamburger, quindi scegli XRP o XLM; scrivi con attenzione il tuo indirizzo di destinazione e (il tag o il memo). Se usi l'indirizzo di un exchange e non il tuo, usa esattamente ciò che l'exchange ti ha fornito.

### Deposito XRP se conosci già il tuo **user-id** BitShares
- **Indirizzo di destinazione del gateway XRP:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **Destinazione del gateway XRP (tag o memo):** user-id BitShares (senza 1.2.)

### Deposito XLM se conosci già il tuo **user-id** BitShares
- **Indirizzo di destinazione del gateway XLM:** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **Destinazione del gateway XLM (tag o memo):** user-id BitShares (senza 1.2.)

### Prelievo manuale con l'**invio** di asset

### Prelievo XRP dal tuo portafoglio BitShares al tuo portafoglio XRP
Invia i tuoi asset **IOB.XRP** all'account della blockchain BitShares [ioxbank-gateway](/account/ioxbank-gateway) e indica nel memo BitShares il tuo indirizzo di destinazione XRP e la destinazione (tag o memo) come negli esempi seguenti: sostituisci *xrp-address* con il tuo indirizzo di destinazione XRP e **tag-or-memo-number** con il numero della tua destinazione (tag o memo). Se NON ti serve un numero (tag o memo), per esempio perché possiedi le chiavi dell'indirizzo di destinazione, puoi semplicemente inviare il tuo asset **IOB.XRP** a [ioxbank-gateway](/account/ioxbank-gateway) indicando solo il tuo **xrp-destination-address**, senza alcun numero (tag o memo):

Formato del memo BitShares
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

Esempi di memo BitShares
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### Prelievo XLM dal tuo portafoglio BitShares al tuo portafoglio XLM
Invia i tuoi asset **IOB.XLM** all'account della blockchain BitShares [ioxbank-gateway](/account/ioxbank-gateway) e indica nel memo BitShares il tuo indirizzo di destinazione XLM e la destinazione (tag o memo) come negli esempi seguenti: sostituisci *xlm-address* con il tuo indirizzo di destinazione XLM e **tag-or-memo-number** con il numero della tua destinazione (tag o memo). Se NON ti serve un numero (tag o memo), per esempio perché possiedi le chiavi dell'indirizzo di destinazione, puoi semplicemente inviare il tuo asset **IOB.XLM** a [ioxbank-gateway](/account/ioxbank-gateway) indicando solo il tuo **xlm-destination-address**, senza alcun numero (tag o memo):

Formato del memo BitShares
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

Esempi di memo BitShares
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## Supporto tecnico
- [Supporto in tempo reale](https://t.me/ioxbank)
- [Apri un ticket](https://support.ioxbank.com)
