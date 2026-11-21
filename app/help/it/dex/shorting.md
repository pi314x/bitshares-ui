# Vendita allo scoperto di BitAsset

Per aumentare la tua esposizione a BTS e offrire liquidità ai BitAsset come USD,
EUR, GOLD e così via, puoi prendere *in prestito* questo bitAsset dalla rete e
*venderlo allo scoperto*. Qui descriviamo brevemente la procedura.

## Prendere in prestito

La rete BitShares è in grado di emettere qualsiasi quantità di qualsiasi BitAsset
e di darla in prestito ai partecipanti, purché ci sia abbastanza collaterale.

 * *prezzo di settlement* (settlement price): il prezzo di 1 BTS come viene scambiato sugli exchange esterni.
 * *rapporto di collaterale di mantenimento* (MCR): un rapporto definito dai witness come rapporto di collaterale minimo richiesto
 * *rapporto massimo di short squeeze* (MSQR): un rapporto definito dai witness che stabilisce fino a che punto gli short sono protetti dagli short squeeze
 * *protezione dallo short squeeze* (SQP): definisce il massimo che una posizione a margine sarà mai costretta a pagare per coprirsi
 * *prezzo di call* (CP): il prezzo al quale le posizioni short/di prestito ricevono una margin call

### Margin call

La rete BitShares è in grado di eseguire una margin call sulle posizioni che non
hanno abbastanza collaterale per garantire i bitAsset presi in prestito. Una
margin call avviene ogni volta che l'offerta di acquisto più alta è inferiore al
*prezzo di call* e superiore alla *SQP*.
La posizione a margine è costretta a vendere il proprio collaterale ogni volta che
la migliore offerta di acquisto del collaterale è inferiore al prezzo di call
(x/BTS).

```
SQP = settlement price / MSQR
call price = DEBT / COLLATERAL * MCR
```

La margin call prende il collaterale, acquista quote del bitAsset preso in
prestito ai tassi di mercato fino alla SQP e chiude la posizione. I BTS restanti
del collaterale vengono restituiti al cliente.

### Settlement

I detentori di qualsiasi bitAsset possono richiedere in ogni momento un settlement
a un *prezzo equo*. Il settlement chiude le posizioni di prestito/short con il
rapporto di collaterale più basso e vende il collaterale per il settlement.

## Vendere

Dopo aver preso in prestito i bitAsset, si possono vendere liberamente su uno
qualsiasi dei mercati corrispondenti, al prezzo che un acquirente è disposto a
pagare. Con questo passaggio la vendita allo scoperto è completa e sei short su
quel particolare bitAsset.

## Aggiornare il rapporto di collaterale

In qualsiasi momento il titolare di una posizione di prestito/short può modificare
il rapporto di collaterale per adattarsi con flessibilità all'andamento del
mercato. Se il rapporto di collaterale viene aumentato, un ulteriore importo di
BTS viene bloccato come collaterale, mentre ridurlo richiede di restituire alla
rete un importo del BitAsset corrispondente.

## Coprire

Per chiudere una posizione di prestito/short bisogna detenere la quantità presa in
prestito di quel particolare bitAsset per consegnarla alla rete BitShares. Dopo di
che i BitAsset vengono tolti dalla relativa offerta e il collaterale viene
rilasciato e restituito al suo proprietario.
