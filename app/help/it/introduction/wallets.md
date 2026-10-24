# Portafoglio

Come avrai già notato, questa applicazione è un'applicazione web e funziona in un
browser. Viene stabilita una connessione con un nodo fidato della rete, che fa da
porta d'accesso al resto dell'ecosistema.

## Portafoglio cloud

Se ti sei registrato con nome utente e password, hai un portafoglio cloud. Anche
se tecnicamente nulla è memorizzato nel cloud, usiamo il termine portafoglio
cloud perché puoi usare queste credenziali (nome utente e password) da qualsiasi
browser web, in qualsiasi momento, per accedere al tuo account. Il portafoglio
cloud consente di accedere a un solo account alla volta. In genere è la scelta
giusta per i nuovi utenti. È possibile cambiare la password generata
automaticamente, ma al momento sconsigliamo di farlo. Il team sta lavorando a un
modo responsabile di gestire il cambio password che non richieda alcuna
conoscenza tecnica. Daremo un annuncio non appena sarà disponibile.

## Portafoglio locale

Il portafoglio locale crea un database nel tuo browser. Questo significa che
l'accesso ai tuoi fondi è legato **solo a quel browser**. Se provi ad accedere al
portafoglio locale da un altro computer o da un altro browser, non funzionerà,
a meno che tu non importi attivamente il file di backup del browser originale. Il
processo in realtà è semplice. Vedi la gestione dei [backup](/help/introduction/backups).

## Sicurezza

Puoi stare tranquillo: i nostri server non hanno accesso ai tuoi fondi, perché
nessuna delle tue chiavi private lascia mai il tuo browser. Sono invece cifrate
con la tua passphrase e memorizzate nel database del browser. Per questo devi
assicurarti di avere un [backup](/help/introduction/backups) adeguato, nel caso
succeda qualcosa al tuo computer o al tuo browser.

## Gestione

L'interfaccia utente è in grado di gestire più portafogli separati, ognuno dei
quali può contenere diversi account e i relativi fondi. Puoi creare, salvare e
cambiare i portafogli esistenti in `Impostazioni->Portafogli`.
