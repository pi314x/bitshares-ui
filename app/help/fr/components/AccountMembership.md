[# lifetime]
### Obtenez {feesCashback} % de cashback sur les frais

Chaque transaction du réseau BitShares est répartie entre le réseau et les parrains. En souscrivant une adhésion à vie, le compte reçoit {feesCashback} % de cashback sur chaque frais de transaction payé. En bonus, il pourra aussi percevoir des revenus de parrainage sur les utilisateurs inscrits grâce à lui ou recommandés au réseau.

Le prix d'une adhésion à vie évolue avec le temps ; il est actuellement de {price} seulement.

[# fee-division]
#### Répartition des frais
Chaque fois que {account} paie des frais de transaction, ces frais sont répartis entre plusieurs comptes. Le réseau prélève
{networkFee} %, et le membre à vie qui a parrainé {account} reçoit {lifetimeFee} %.

Le registrar est le compte qui a payé les frais de transaction pour enregistrer {account} sur le réseau. Il décide comment répartir les {referrerTotalFee} % restants entre lui et son propre programme d'affilié parrain.

Le registrar de {account} a choisi de partager {referrerFee} % des frais totaux avec l'affilié parrain et de garder {registrarFee} % des frais totaux pour lui.


#### Frais en attente
Les frais payés par {account} sont répartis entre le réseau, les parrains et les registrars une fois par intervalle de maintenance ({maintenanceInterval} secondes). La
prochaine maintenance aura lieu le {nextMaintenanceTime}.

#### Frais soumis au vesting

La plupart des frais sont disponibles immédiatement, mais les frais supérieurs à {vestingThreshold}
(comme ceux payés pour améliorer votre adhésion ou enregistrer un nom de compte premium) doivent être libérés progressivement (vesting) sur un total de {vestingPeriod} jours.

