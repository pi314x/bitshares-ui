# Pools de liquidité

Un pool de liquidité contient deux actifs et permet à chacun d'échanger l'un contre l'autre à un prix fixé par le rapport de ce que le pool contient. Personne n'a à passer un ordre et à attendre : vous échangez contre le pool, et la transaction est exécutée au prix affiché ou échoue.

## Échanger

Ouvrez **Pools de liquidité** dans le menu, choisissez un pool et appuyez sur **Échanger**. Saisissez ce que vous payez ou ce que vous voulez recevoir ; l'autre champ est calculé d'après l'état actuel du pool. La fenêtre indique

 * le **prix** obtenu et l'**impact sur le prix**, c'est-à-dire de combien votre opération déplace le prix du pool. Une grosse opération dans un petit pool coûte plus cher ;
 * les **frais** du pool, prélevés sur ce que vous recevez et conservés dans le pool pour ceux qui fournissent la liquidité ;
 * le **minimum reçu** : le montant moins le glissement que vous acceptez. Si le pool bouge plus que cela avant l'inclusion de votre transaction, l'échange échoue au lieu d'être exécuté à un moins bon prix.

La fenêtre compare aussi le même montant au carnet d'ordres de la paire et indique où le prix est meilleur. Sur la page de trading, une ligne sous l'en-tête du marché fait de même pour de petits montants.

## Fournir de la liquidité

**Ajouter / retirer** place les deux actifs dans un pool et vous donne des jetons de part. Sous **Votre liquidité**, vous voyez votre part de chaque pool et ce qu'elle vaut dans chacun des deux actifs. Le retrait rend votre part des deux actifs, moins les frais de retrait du pool.

Les frais gagnés par un pool restent dans le pool et augmentent la valeur de chaque part. Fournir de la liquidité comporte un risque de perte impermanente : si le prix d'un actif s'éloigne beaucoup de l'autre, votre part du pool peut valoir moins que les deux actifs si vous les aviez simplement conservés.

## Le graphe

La vue **Graphe** dessine chaque actif comme un point et chaque pool comme une ligne entre ses deux actifs, pour voir quels actifs peuvent être échangés directement et lesquels seulement via BTS ou un autre pivot.
