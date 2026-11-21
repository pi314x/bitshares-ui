# Portefeuille

Comme vous l'avez peut-être déjà remarqué, cette application est une application
web qui s'exécute dans un navigateur. Une connexion est établie avec un nœud de
confiance du réseau, qui sert de passerelle vers le reste de l'écosystème.

## Portefeuille cloud

Si vous vous êtes inscrit avec un nom d'utilisateur et un mot de passe, vous avez
un portefeuille cloud. Techniquement, rien n'est stocké dans le cloud, mais nous
parlons de portefeuille cloud parce que vous pouvez utiliser ces identifiants
(nom d'utilisateur et mot de passe) depuis n'importe quel navigateur web, à tout
moment, pour accéder à votre compte. Le portefeuille cloud ne donne accès qu'à un
seul compte à la fois. C'est en général le bon choix pour les nouveaux
utilisateurs. Il est possible de modifier le mot de passe généré
automatiquement, mais nous le déconseillons pour le moment. L'équipe travaille à
une méthode responsable de changement de mot de passe qui ne demande aucune
connaissance technique. Nous l'annoncerons dès qu'elle sera disponible.

## Portefeuille local

Le portefeuille local crée une base de données dans votre navigateur. L'accès à
vos fonds est donc lié à **ce navigateur uniquement**. Si vous essayez d'accéder à
votre portefeuille local depuis un autre ordinateur ou un autre navigateur,
cela échouera, sauf si vous importez le fichier de sauvegarde du navigateur
d'origine. Le processus est en réalité simple. Voir la gestion des
[sauvegardes](/help/introduction/backups).

## Sécurité

Soyez assuré que nos serveurs n'ont pas accès à vos fonds, car aucune de vos clés
privées ne quitte jamais votre navigateur. Elles sont chiffrées avec votre phrase
secrète et stockées dans la base de données de votre navigateur. Veillez donc à
faire une [sauvegarde](/help/introduction/backups) en bonne et due forme au cas
où il arriverait quelque chose à votre ordinateur ou à votre navigateur.

## Gestion

L'interface peut gérer plusieurs portefeuilles distincts, chacun pouvant contenir
plusieurs comptes et les fonds correspondants. Vous pouvez créer, sauvegarder et
changer de portefeuille dans `Paramètres->Portefeuilles`.
