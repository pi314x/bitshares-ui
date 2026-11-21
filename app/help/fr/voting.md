# Vote

> Voter est important dans Bitshares, comme cela l'est dans la communauté où vous vivez. Le poids de votre vote est directement proportionnel au nombre de BTS que vous possédez. Si vous ne vous impliquez pas beaucoup dans la communauté, nous vous encourageons à choisir un proxy qui représente vos intérêts. Si vous souhaitez vous impliquer davantage, découvrez ces [canaux](/help/introduction/bitshares).

## Proxy

Vous pouvez choisir de **ne pas** participer activement à la gouvernance de Bitshares. Dans ce cas, il est important de choisir quelqu'un de la communauté Bitshares avec qui vous vous identifiez et de désigner cette entité comme votre proxy. Elle obtient ainsi le pouvoir de voter en votre nom, avec vos parts de BTS derrière son vote. C'est comparable à l'élection d'un représentant.

## Witnesses

Les witnesses (témoins) sont des entités qui travaillent pour la blockchain en construisant de nouveaux blocs. Leur rôle ressemble à celui des mineurs de Bitcoin et d'autres blockchains. Chaque witness est approuvé par les actionnaires, construit des blocs à partir de transactions validées et les signe. Chaque transaction effectuée sur le réseau doit être validée par tous les witnesses.

### Mécanisme de consensus

Qui a le droit de *produire* un bloc à quel moment est défini par un mécanisme de
consensus appelé *Delegated Proof of Stake*. En substance, vous, les actionnaires de
BitShares, pouvez voter sur la blockchain pour les producteurs de blocs que vous préférez. Ces *witnesses* qui ont le plus de voix sont autorisés à produire des blocs.


## Comité

Le comité est un ensemble d'entités approuvées par les actionnaires, qui fixent la politique de la blockchain Bitshares, notamment :

* Les frais de transaction et de trading
* Les paramètres de la blockchain, comme la taille et l'intervalle des blocs
* Les paramètres de parrainage et de vesting, comme le pourcentage de cashback et les durées de vesting

## Workers

Les workers sont des propositions visant à fournir un service en échange d'un salaire versé par la blockchain. Une proposition de worker contient au minimum les informations suivantes :

* Une date de début et une date de fin
* Une rémunération quotidienne
* Une rémunération totale maximale
* Un lien vers une page web qui explique la proposition de worker

### Cycle de vie d'un worker

#### Proposé
Ces propositions de workers ont été soumises à la blockchain et font l'objet d'un vote actif. Pour devenir actives, elles doivent dépasser le worker refund400k en nombre total de voix.
#### Actif
Ces propositions de workers ont dépassé le seuil et sont rémunérées. Les workers actifs peuvent perdre leur financement si leur nombre de voix retombe sous le niveau du worker refund400k.
#### Expiré
Ces propositions de workers sont affichées à titre d'historique. Vous y trouverez les propositions dont la date de fin est passée.

### Fonctionnement du budget des workers
Les workers sont rémunérés sur un budget quotidien fixe, selon le principe du premier arrivé, premier servi, jusqu'à épuisement des fonds.

* Un budget quotidien total de 400k BTS pour tous les workers
* 5 propositions de workers avec un total de voix positif, demandant chacune 100k BTS par jour

Les quatre workers qui ont le plus de voix reçoivent chacun 100k BTS par jour, mais une fois qu'ils sont payés, le budget des workers est épuisé. Le cinquième worker ne reçoit donc rien.
