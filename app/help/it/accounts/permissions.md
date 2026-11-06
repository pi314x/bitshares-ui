# Permessi

In BitShares ogni account è diviso in

* **Permesso attivo**: controllo sui fondi e
* **Permesso owner**: controllo sull'account.

Entrambi si definiscono nella scheda `Permessi` del tuo account usando le
cosiddette *autorità* (vedi sotto) insieme a una cosiddetta *soglia* che deve
essere superata affinché una transazione sia valida.

## Autorità

In BitShares un'*autorità* è composta da una o più entità che autorizzano
un'azione, come trasferimenti o trade.

Un'autorità è composta da una o più coppie formate da un nome account e da un
*peso*.

Perché una transazione sia valida, la somma dei pesi delle parti che firmano deve
superare la soglia definita nei permessi.

# Esempi

Vediamo alcuni esempi per chiarire la terminologia e i casi d'uso. Supponiamo che
venga creato un nuovo account con i permessi attivi impostati come descritto
sotto. Nota che lo stesso schema funziona anche per i permessi owner!

## Multi-firma (piatta)

Uno schema di multi-firma piatta è composto da `M` entità, delle quali `N` devono
firmare perché la transazione sia valida. In BitShares abbiamo *pesi* e una
*soglia* al posto di `M` e `N`. Possiamo comunque ottenere la stessa cosa con
ancora più flessibilità, come vedremo ora.

Supponiamo che Alice, Bob, Charlie e Dennis abbiano fondi in comune. Vogliamo poter
costruire una transazione valida se solo due di loro sono d'accordo. Uno schema
**2-su-4** (N-su-M) può quindi essere fatto così:

| Account    | Peso   |
| ---------- | ------ |
| Alice      | 33%    |
| Bob        | 33%    |
| Charlie    | 33%    |
| Dennis     | 33%    |
| ---------- | ------ |
| Soglia:    | 51%    |

Tutti e quattro i partecipanti hanno un peso del 33%, ma la soglia è fissata al 51%.
Quindi bastano due su quattro per convalidare la transazione.

In alternativa, per costruire uno schema 3-su-4 si possono ridurre i pesi a 17
oppure aumentare la soglia al 99%.

## Multi-firma flessibile (piatta)

Con soglia e pesi abbiamo più flessibilità sui nostri fondi o, più precisamente,
più *controllo*. Possiamo per esempio dare pesi diversi a persone diverse.
Supponiamo che Alice voglia proteggere i suoi fondi dai furti con uno schema di
multi-firma, ma senza cedere troppo controllo ai suoi amici. Creiamo quindi
un'autorità simile a:

| Account    | Peso   |
| ---------- | ------ |
| Alice      | 49%    |
| Bob        | 25%    |
| Charlie    | 25%    |
| Dennis     | 10%    |
| ---------- | ------ |
| Soglia:    | 51%    |

Ora ai fondi possono accedere Alice insieme a un solo amico oppure tutti e tre gli
amici insieme.

## Multi-firma flessibile multi-gerarchica

Vediamo una semplice configurazione di account aziendale multi-gerarchico. Si
tratta di una società con un direttore finanziario (CFO) e alcuni reparti che
lavorano per lui, come tesoreria, controllo di gestione, fisco, contabilità e così
via. La società ha anche un CEO che vuole avere privilegi di spesa. Costruiamo
quindi per i fondi un'autorità di questo tipo:

| Account     | Peso   |
| ----------- | ------ |
| CEO.COMPANY | 51%    |
| CFO.COMPANY | 51%    |
| ----------- | ------ |
| Soglia:     | 51%    |

dove CEO.COMPANY e CFO.COMPANY hanno le proprie autorità. Ad esempio, l'account
CFO.COMPANY potrebbe essere fatto così:

| CFO.COMPANY         | Peso   |
| ------------------- | ------ |
| Chief.COMPANY       | 51%    |
| Treasurer.COMPANY   | 33%    |
| Controller.COMPANY  | 33%    |
| Tax Manager.COMPANY | 10%    |
| Accounting.COMPANY  | 10%    |
| ------------------- | ------ |
| Soglia:             | 51%    |

Questo schema permette:

* al CEO di spendere fondi
* al direttore finanziario di spendere fondi
* al tesoriere insieme al controller di spendere fondi
* al controller o al tesoriere insieme al responsabile fiscale e alla contabilità
  di spendere fondi.

Si può quindi costruire un albero di profondità arbitraria per ottenere
un'autorità flessibile che rifletta praticamente qualsiasi caso d'uso aziendale.
