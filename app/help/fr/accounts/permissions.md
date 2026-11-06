# Permissions

Dans BitShares, chaque compte est séparé en

* **Permission active** : le contrôle des fonds, et
* **Permission owner** : le contrôle du compte.

Les deux se définissent dans l'onglet `Permissions` de votre compte à l'aide
d'*autorités* (voir ci-dessous) et d'un *seuil* qui doit être dépassé pour qu'une
transaction soit valide.

## Autorités

Dans BitShares, une *autorité* se compose d'une ou plusieurs entités qui
autorisent une action, comme des transferts ou des trades.

Une autorité se compose d'une ou plusieurs paires formées d'un nom de compte et
d'un *poids*.

Pour qu'une transaction soit valide, la somme des poids des parties qui signent
doit dépasser le seuil défini dans les permissions.

# Exemples

Quelques exemples éclairent la terminologie et les cas d'usage. Nous supposons
qu'un nouveau compte est créé avec des permissions actives définies comme
ci-dessous. Notez que le même schéma fonctionne aussi pour les permissions owner !

## Multisignature (simple)

Un schéma de multisignature simple se compose de `M` entités dont `N` doivent
signer pour que la transaction soit valide. Dans BitShares, nous avons des
*poids* et un *seuil* au lieu de `M` et `N`. On peut ainsi obtenir exactement la
même chose avec encore plus de souplesse, comme nous allons le voir.

Supposons qu'Alice, Bob, Charlie et Dennis possèdent des fonds communs. Nous
voulons qu'une transaction valide puisse être construite si deux d'entre eux
seulement sont d'accord. Un schéma **2-sur-4** (N-sur-M) peut donc ressembler à
ceci :

| Compte     | Poids  |
| ---------- | ------ |
| Alice      | 33%    |
| Bob        | 33%    |
| Charlie    | 33%    |
| Dennis     | 33%    |
| ---------- | ------ |
| Seuil :    | 51%    |

Les quatre participants ont un poids de 33 %, mais le seuil est fixé à 51 %.
Deux des quatre seulement doivent donc être d'accord pour valider la transaction.

Pour construire un schéma 3-sur-4, on peut soit réduire les poids à 17, soit
augmenter le seuil à 99 %.

## Multisignature flexible (simple)

Avec le seuil et les poids, nous avons plus de souplesse sur nos fonds, ou plus
précisément plus de *contrôle*. Nous pouvons par exemple donner des poids
différents à différentes personnes. Supposons qu'Alice veuille protéger ses fonds
contre le vol par un schéma de multisignature, sans pour autant donner trop de
contrôle à ses amis. Nous créons alors une autorité semblable à :

| Compte     | Poids  |
| ---------- | ------ |
| Alice      | 49%    |
| Bob        | 25%    |
| Charlie    | 25%    |
| Dennis     | 10%    |
| ---------- | ------ |
| Seuil :    | 51%    |

Les fonds sont désormais accessibles soit par Alice avec un seul ami, soit par les
trois amis ensemble.

## Multisignature flexible multi-hiérarchique

Prenons un exemple simple de compte d'entreprise multi-hiérarchique. Il s'agit
d'une société avec un directeur financier (CFO) et plusieurs services qui
travaillent pour lui : trésorerie, contrôle de gestion, fiscalité, comptabilité,
etc. La société a aussi un PDG (CEO) qui veut disposer de droits de dépense. Nous
construisons donc pour les fonds une autorité de ce type :

| Compte      | Poids  |
| ----------- | ------ |
| CEO.COMPANY | 51%    |
| CFO.COMPANY | 51%    |
| ----------- | ------ |
| Seuil :     | 51%    |

CEO.COMPANY et CFO.COMPANY ayant leurs propres autorités. Le compte CFO.COMPANY
pourrait par exemple ressembler à :

| CFO.COMPANY         | Poids  |
| ------------------- | ------ |
| Chief.COMPANY       | 51%    |
| Treasurer.COMPANY   | 33%    |
| Controller.COMPANY  | 33%    |
| Tax Manager.COMPANY | 10%    |
| Accounting.COMPANY  | 10%    |
| ------------------- | ------ |
| Seuil :             | 51%    |

Ce schéma permet :

* au PDG de dépenser des fonds
* au directeur financier de dépenser des fonds
* au trésorier avec le contrôleur de gestion de dépenser des fonds
* au contrôleur de gestion ou au trésorier avec le responsable fiscal et la
  comptabilité de dépenser des fonds.

On peut ainsi construire un arbre de profondeur arbitraire pour obtenir une
autorité flexible qui reflète à peu près n'importe quel cas d'usage en entreprise.
