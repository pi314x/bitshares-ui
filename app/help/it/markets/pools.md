# Pool di liquidità

Un pool di liquidità contiene due asset e permette a chiunque di scambiare l'uno con l'altro a un prezzo stabilito dal rapporto di ciò che il pool contiene. Nessuno deve piazzare un ordine e aspettare: scambi contro il pool e la transazione viene eseguita al prezzo mostrato oppure fallisce.

## Scambiare

Apri **Pool di liquidità** nel menu, scegli un pool e premi **Scambia**. Inserisci quanto paghi o quanto vuoi ricevere; l'altro campo viene calcolato dallo stato attuale del pool. La finestra mostra

 * il **prezzo** ottenuto e l'**impatto sul prezzo**, cioè di quanto la tua operazione sposta il prezzo del pool. Un'operazione grande in un pool piccolo costa di più;
 * la **commissione** del pool, prelevata da ciò che ricevi e trattenuta nel pool per chi fornisce la liquidità;
 * il **minimo che ricevi**: l'importo meno lo slippage che accetti. Se il pool si muove oltre prima che la tua transazione sia inclusa, lo scambio fallisce invece di essere eseguito a un prezzo peggiore.

La finestra confronta anche lo stesso importo con il libro degli ordini della coppia e ti dice dove il prezzo è migliore. Nella pagina di trading una riga sotto l'intestazione del mercato fa lo stesso per importi piccoli.

## Fornire liquidità

**Aggiungi / rimuovi** mette entrambi gli asset in un pool e ti dà i token di quota. In **La tua liquidità** vedi la tua parte di ogni pool e quanto vale in ciascuno dei due asset. La rimozione restituisce la tua parte di entrambi gli asset, meno la commissione di prelievo del pool.

Le commissioni guadagnate da un pool restano nel pool e aumentano il valore di ogni quota. Fornire liquidità comporta il rischio di perdita impermanente: se il prezzo di un asset si allontana molto dall'altro, la tua parte del pool può valere meno dei due asset se li avessi semplicemente tenuti.

## Il grafo

La vista **Grafo** disegna ogni asset come un punto e ogni pool come una linea tra i suoi due asset, così vedi quali asset si possono scambiare direttamente e quali solo tramite BTS o un altro nodo centrale.
