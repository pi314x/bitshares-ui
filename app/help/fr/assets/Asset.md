[# summary]

### Actif {symbol}

{description}

Émis par : {issuer}

[# annual]

Si une adhésion à vie est trop chère, vous pouvez quand même obtenir {feesCashback} % de cashback pour l'année suivante en devenant
abonné annuel pour seulement {price} par an.
![GitHub Logo](/images/logo.png)

[# fee-division]
#### Répartition des frais
Chaque fois que {account} paie des frais de transaction, ces frais sont répartis entre plusieurs comptes. Le réseau prélève
{networkFee} %, et le membre à vie qui a parrainé {account} reçoit {lifetimeFee} %.

Le _registrar_ est le compte qui a payé les frais de transaction pour enregistrer {account} sur le réseau. Il décide comment répartir les
{referrerTotalFee} % restants entre lui et son propre programme d'_affilié parrain_.

Le registrar de {account} a choisi de partager {referrerFee} % des frais totaux avec l'_affilié parrain_ et de garder {registrarFee} % des frais totaux pour lui.


#### Frais en attente
Les frais payés par {account} ne sont répartis entre le réseau, les parrains et les registrars qu'une fois par intervalle de maintenance ({maintenanceInterval} secondes). La
prochaine maintenance aura lieu le {nextMaintenanceTime}.

#### Frais soumis au vesting

La plupart des frais sont disponibles immédiatement, mais les frais supérieurs à {vestingThreshold}
(comme ceux payés pour améliorer votre adhésion ou enregistrer un nom de compte premium) doivent être libérés progressivement (vesting) sur un total de {vestingPeriod} jours.
