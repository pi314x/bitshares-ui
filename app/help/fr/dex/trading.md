# Trading

Cette page donne une introduction très rapide à l'interprétation des termes
utilisés par la DEX et à la présentation des paires de trading.

## Paires

Dans BitShares, presque tous les actifs peuvent être échangés contre tous les
autres. Une fois deux actifs choisis, on parle généralement de *paire de marché*.
On peut par exemple échanger des USD contre des EUR dans la paire USD:EUR.

Par souci de cohérence, nous utilisons les termes généraux *base* et *quote*, de
sorte que les paires se présentent ainsi :

    *quote* : *base*

Avec par exemple *base* égale à USD et *quote* égale à EUR, on obtient la paire
EUR:USD.

## Carnets d'ordres

Le carnet d'ordres se compose d'un côté *ask* (offre) et d'un côté *bid*
(demande). Comme les paires de trading n'ont pas d'orientation privilégiée et
peuvent être inversées, le tableau suivant donne un aperçu de l'ask/bid et des
opérations d'achat/vente correspondantes de chaque côté :

| Côté       | Vendre  | Acheter |
| ---------- | ------- | ------- |
| Ask        | *quote* | *base*  |
| Bid        | *base*  | *quote* |
| ---------- | ------- | ------- |

Évidemment, ce qui se trouve côté bid de la paire USD:EUR se trouve côté ask de la
paire EUR:USD. Les prix sont bien sûr représentés en interne sous forme de
fractions, de sorte que les deux paires sont identiques.

## Trader

Pour passer un ordre, il faut remplir le formulaire du côté *ask* ou du côté *bid*
(respectivement achat ou vente). Vous devez définir un *prix* et une *quantité* à
vendre/acheter. Le coût de cet ordre est calculé automatiquement. Notez que des
frais supplémentaires sont nécessaires pour passer l'ordre.

Une fois l'ordre exécuté (c'est-à-dire que quelqu'un a vendu/acheté votre offre),
votre compte est crédité de l'actif correspondant.

Les ordres non exécutés peuvent être annulés à tout moment.
