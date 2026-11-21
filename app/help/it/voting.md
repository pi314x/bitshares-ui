# Votazione

> Votare è importante in Bitshares come lo è per la comunità in cui vivi. Il peso del tuo voto è direttamente proporzionale al numero di BTS che possiedi. Se non sei molto coinvolto nella community, ti consigliamo di scegliere un proxy che rappresenti i tuoi interessi. Se vuoi essere più coinvolto, dai un'occhiata a questi [canali](/help/introduction/bitshares).

## Proxy

Puoi scegliere di **non** essere attivo nella governance di Bitshares. In questo caso è importante che tu scelga qualcuno della community di Bitshares in cui ti riconosci e lo imposti come tuo proxy. Questo gli dà il potere di votare per tuo conto, con le tue quote di BTS a sostegno del suo voto. È simile all'elezione di un rappresentante.

## Witness

I witness sono entità che lavorano per la blockchain costruendo nuovi blocchi. Il loro ruolo è simile a quello dei miner di Bitcoin e di altre blockchain. Ogni witness è approvato dagli azionisti, costruisce e firma blocchi a partire da transazioni convalidate. Ogni transazione effettuata nella rete deve essere convalidata da tutti i witness.

### Meccanismo di consenso

Chi può *produrre* un blocco e in quale momento è stabilito da un meccanismo di
consenso chiamato *Delegated Proof of Stake*. In sostanza, voi, gli azionisti di
BitShares, potete votare sulla blockchain i produttori di blocchi che preferite. Questi *witness* con il maggior numero di voti possono produrre blocchi.


## Comitato

Il comitato è un insieme di entità approvate dagli azionisti che stabiliscono la politica della blockchain Bitshares, tra cui:

* Commissioni di transazione e di trading
* Parametri della blockchain, come la dimensione e l'intervallo dei blocchi
* Parametri di referral e vesting, come la percentuale di cashback e i periodi di vesting

## Worker

I worker sono proposte per svolgere un servizio in cambio di uno stipendio pagato dalla blockchain. Una proposta di worker contiene almeno le seguenti informazioni:

* Una data di inizio e una di fine
* Un compenso giornaliero
* Un compenso totale massimo
* Un link a una pagina web in cui la proposta di worker è spiegata

### Ciclo di vita di un worker

#### Proposto
Queste proposte di worker sono state inviate alla blockchain e sono in corso di votazione. Per diventare attive, devono superare il worker refund400k nel totale dei voti.
#### Attivo
Queste proposte di worker hanno superato la soglia e vengono pagate. I worker attivi possono perdere il finanziamento se il loro numero di voti scende sotto il livello del worker refund400k.
#### Scaduto
Queste proposte di worker sono mostrate a scopo storico. Troverai le proposte terminate in base alla loro data di fine.

### Meccanismo del budget dei worker
I worker vengono pagati da un budget giornaliero fisso, in ordine di arrivo, finché i fondi non si esauriscono.

* Un budget giornaliero totale di 400k BTS per tutti i worker
* 5 proposte di worker con un totale di voti positivo, ciascuna con una richiesta di compenso giornaliero di 100k BTS

I quattro worker con più voti riceveranno ciascuno 100k BTS al giorno, ma una volta pagati il budget dei worker sarà esaurito. Il quinto worker non riceverà quindi nulla.
