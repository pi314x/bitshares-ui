# Permisos

En BitShares, cada cuenta se divide en

* **Permiso activo**: control sobre sus fondos y
* **Permiso de propietario (owner)**: control sobre la cuenta.

Ambos pueden definirse en la pestaña `Permisos` de su cuenta mediante las
llamadas *autoridades* (véase más abajo) junto con un llamado *umbral* que debe
superarse para que una transacción sea válida.

## Autoridades

En BitShares, una *autoridad* consta de una o varias entidades que autorizan una
acción, como transferencias u operaciones.

Una autoridad consta de uno o varios pares formados por un nombre de cuenta y un
*peso*.

Para obtener una transacción válida, la suma de los pesos de las partes que firman
debe superar el umbral definido en los permisos.

# Ejemplos

Veamos algunos ejemplos para aclarar la terminología y los casos de uso. Suponemos
que se crea una cuenta nueva con sus permisos activos configurados como se
describe a continuación. ¡Tenga en cuenta que el mismo esquema también funciona
para los permisos de propietario!

## Multifirma (plana)

Un esquema de multifirma plana se compone de `M` entidades, de las cuales `N`
deben firmar para que la transacción sea válida. En BitShares tenemos *pesos* y un
*umbral* en lugar de `M` y `N`. Aun así, podemos lograr exactamente lo mismo con
más flexibilidad, como veremos ahora.

Supongamos que Alice, Bob, Charlie y Dennis tienen fondos comunes. Queremos poder
construir una transacción válida si solo dos de ellos están de acuerdo. Un
esquema **2 de 4** (N de M) puede tener este aspecto:

| Cuenta     | Peso   |
| ---------- | ------ |
| Alice      | 33%    |
| Bob        | 33%    |
| Charlie    | 33%    |
| Dennis     | 33%    |
| ---------- | ------ |
| Umbral:    | 51%    |

Los cuatro participantes tienen un peso del 33 %, pero el umbral se fija en el 51 %.
Por tanto, solo hace falta que dos de los cuatro estén de acuerdo para validar la
transacción.

Como alternativa, para construir un esquema 3 de 4 podemos reducir los pesos a 17
o aumentar el umbral al 99 %.

## Multifirma flexible (plana)

Con el umbral y los pesos tenemos ahora más flexibilidad sobre nuestros fondos, o
más precisamente, más *control*. Por ejemplo, podemos dar pesos distintos a
personas distintas. Supongamos que Alice quiere proteger sus fondos contra el
robo mediante un esquema de multifirma, pero no quiere ceder demasiado control a
sus amigos. Creamos entonces una autoridad similar a:

| Cuenta     | Peso   |
| ---------- | ------ |
| Alice      | 49%    |
| Bob        | 25%    |
| Charlie    | 25%    |
| Dennis     | 10%    |
| ---------- | ------ |
| Umbral:    | 51%    |

Ahora se puede acceder a los fondos con Alice y un solo amigo, o con los tres
amigos juntos.

## Multifirma flexible multijerárquica

Veamos una configuración sencilla de cuenta corporativa multijerárquica. Se trata
de una empresa con un director financiero (CFO) y varios departamentos que
trabajan para él, como Tesorería, Control, Impuestos, Contabilidad, etc. La
empresa también tiene un CEO que quiere tener privilegios de gasto. Construimos,
por tanto, una autoridad para los fondos según el esquema:

| Cuenta      | Peso   |
| ----------- | ------ |
| CEO.COMPANY | 51%    |
| CFO.COMPANY | 51%    |
| ----------- | ------ |
| Umbral:     | 51%    |

donde CEO.COMPANY y CFO.COMPANY tienen sus propias autoridades. Por ejemplo, la
cuenta CFO.COMPANY podría ser así:

| CFO.COMPANY         | Peso   |
| ------------------- | ------ |
| Chief.COMPANY       | 51%    |
| Treasurer.COMPANY   | 33%    |
| Controller.COMPANY  | 33%    |
| Tax Manager.COMPANY | 10%    |
| Accounting.COMPANY  | 10%    |
| ------------------- | ------ |
| Umbral:             | 51%    |

Este esquema permite:

* que el CEO gaste fondos
* que el director financiero gaste fondos
* que el Treasurer junto con el Controller gasten fondos
* que el Controller o el Treasurer junto con el Tax Manager y Accounting gasten
  fondos.

Así, puede construirse un árbol de profundidad arbitraria para crear una
autoridad flexible que refleje casi cualquier caso de uso empresarial.
