# Billetera

Como ya habrá notado, esta aplicación es una aplicación web y se ejecuta en un
navegador. Se establece una conexión con un nodo de confianza de la red que
sirve de puerta de acceso al resto del ecosistema.

## Billetera en la nube

Si se registró con un nombre de usuario y una contraseña, tiene una billetera en
la nube. Aunque técnicamente no se almacena nada en la nube, usamos el término
billetera en la nube porque puede utilizar estas credenciales (nombre de usuario
y contraseña) desde cualquier navegador web, en cualquier momento, para acceder
a su cuenta. La billetera en la nube solo permite acceder a una cuenta a la vez.
Por lo general es la opción correcta para los usuarios nuevos. Es posible
cambiar la contraseña generada automáticamente, pero por ahora no lo
recomendamos. El equipo trabaja en una forma responsable de gestionar el cambio
de contraseña que no requiera conocimientos técnicos. Lo anunciaremos en cuanto
esté disponible.

## Billetera local

La billetera local crea una base de datos dentro de su navegador. Esto significa
que el acceso a sus fondos está ligado **únicamente a ese navegador**. Si intenta
acceder a su billetera local desde otro ordenador o desde otro navegador, no
funcionará a menos que importe el archivo de backup del navegador original. El
proceso es en realidad sencillo. Consulte la gestión de [backups](/help/introduction/backups).

## Seguridad

Puede estar tranquilo: nuestros servidores no tienen acceso a sus fondos, porque
ninguna de sus claves privadas sale nunca de su navegador. En su lugar, se cifran
con su frase de contraseña y se almacenan en la base de datos de su navegador. Por
eso debe asegurarse de tener un [backup](/help/introduction/backups) adecuado por
si le ocurre algo a su ordenador o a su navegador.

## Gestión

La interfaz de usuario puede manejar y acceder a varias billeteras separadas,
cada una de las cuales puede contener varias cuentas y sus fondos
correspondientes. Puede crear, respaldar y cambiar las billeteras existentes en
`Ajustes->Billeteras`.
