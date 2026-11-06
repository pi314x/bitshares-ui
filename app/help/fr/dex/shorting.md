# Vente à découvert de BitAssets

Pour augmenter votre exposition au BTS et offrir de la liquidité aux BitAssets
comme USD, EUR, GOLD, etc., vous pouvez *emprunter* ce BitAsset au réseau et le
*vendre à découvert*. Nous décrivons ici brièvement la procédure.

## Emprunter

Le réseau BitShares est capable d'émettre n'importe quelle quantité de
n'importe quel BitAsset et de le prêter aux participants, pourvu qu'ils fournissent
assez de collatéral.

 * *prix de règlement* (settlement price) : le prix d'1 BTS tel qu'il est échangé sur les bourses externes.
 * *ratio de collatéral de maintenance* (MCR) : un ratio défini par les witnesses comme ratio de collatéral minimal requis
 * *ratio maximal de short squeeze* (MSQR) : un ratio défini par les witnesses qui indique jusqu'où les positions short sont protégées contre les short squeezes
 * *protection contre le short squeeze* (SQP) : définit le maximum qu'une position sur marge sera jamais forcée de payer pour se couvrir
 * *prix d'appel* (CP) : le prix auquel les positions short/d'emprunt reçoivent un appel de marge

### Appel de marge

Le réseau BitShares est capable d'appeler en marge les positions qui n'ont pas
assez de collatéral pour couvrir les BitAssets empruntés. Un appel de marge a lieu
chaque fois que l'offre d'achat la plus haute est inférieure au *prix d'appel* et
supérieure à la *SQP*.
La position sur marge est forcée de vendre son collatéral chaque fois que la
meilleure offre d'achat du collatéral est inférieure au prix d'appel (x/BTS).

```
SQP = settlement price / MSQR
call price = DEBT / COLLATERAL * MCR
```

L'appel de marge prend le collatéral, rachète des parts du BitAsset emprunté aux
taux du marché jusqu'à la SQP et clôt la position. Les BTS restants du collatéral
sont restitués au client.

### Règlement (settlement)

Les détenteurs de n'importe quel BitAsset peuvent demander à tout moment un
règlement à un *prix équitable*. Le règlement clôt les positions d'emprunt/short
au ratio de collatéral le plus bas et vend le collatéral pour le règlement.

## Vendre

Après avoir emprunté des BitAssets, on peut les vendre librement sur n'importe
lequel des marchés correspondants, au prix que l'acheteur est prêt à payer. Avec
cette étape, la vente à découvert est terminée et vous êtes short sur ce BitAsset.

## Ajuster le ratio de collatéral

À tout moment, le détenteur d'une position d'emprunt/short peut modifier le ratio
de collatéral pour s'adapter avec souplesse au comportement du marché. Si le ratio
de collatéral augmente, un montant supplémentaire de BTS est immobilisé en
collatéral ; si on le réduit, un montant du BitAsset correspondant doit être
remboursé au réseau.

## Couvrir

Pour clore une position d'emprunt/short, il faut détenir la quantité empruntée de
ce BitAsset pour la remettre au réseau BitShares. Ensuite, les BitAssets sont
retirés de l'offre correspondante, et le collatéral est libéré et restitué à son
propriétaire.
