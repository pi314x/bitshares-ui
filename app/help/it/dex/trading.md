# Trading

Questa pagina offre una brevissima introduzione a come interpretare i termini
usati dal DEX e come vengono presentate le coppie di trading.

## Coppie

In BitShares quasi ogni asset può essere scambiato con tutti gli altri. Una volta
scelti due asset, si parla di solito di *coppia di mercato*. Ad esempio, possiamo
scambiare USD contro EUR nella coppia USD:EUR.

Per coerenza, useremo i termini generali *base* e *quote*, in modo che le coppie
siano rappresentate come

    *quote* : *base*

e per esempio, con *base* uguale a USD e *quote* uguale a EUR, si ottiene la
coppia EUR:USD.

## Libri degli ordini

Il libro degli ordini è composto da un lato *ask* e un lato *bid*. Poiché le
coppie di trading non hanno un orientamento preferito e possono essere
capovolte, la tabella seguente offre una panoramica di ask/bid e delle
corrispondenti operazioni di acquisto/vendita per ciascun lato:

| Lato       | Vendi   | Acquista |
| ---------- | ------- | -------- |
| Ask        | *quote* | *base*   |
| Bid        | *base*  | *quote*  |
| ---------- | ------- | -------- |

Ovviamente ciò che si trova sul lato bid della coppia USD:EUR si troverà sul lato
ask della coppia EUR:USD. I prezzi sono naturalmente rappresentati internamente
come frazioni, quindi le due coppie risultano identiche.

## Fare trading

Per inserire un ordine devi compilare il modulo sul lato *ask* o *bid*
(rispettivamente lato acquisto o vendita). Dovrai definire un *prezzo* e una
*quantità* da vendere/acquistare. Il costo dell'ordine viene calcolato
automaticamente. Nota che per inserire l'ordine è richiesta una commissione
aggiuntiva.

Quando l'ordine viene eseguito (cioè qualcuno ha venduto/acquistato la tua
offerta), il tuo account riceverà l'asset corrispondente.

Gli ordini non eseguiti possono essere annullati in qualsiasi momento.
