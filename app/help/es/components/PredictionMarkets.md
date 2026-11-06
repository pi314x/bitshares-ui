# Activos de mercados de predicción

Un activo de mercado de predicción le permite estar de acuerdo o en desacuerdo
con la predicción (condición) del activo y respaldar su opinión con colateral.
Un mercado de predicción lo resuelve su emisor tras la fecha de resolución, para
reflejar en la cadena el resultado real de la predicción.

En la blockchain, un activo de mercado de predicción es un tipo especial de
SmartCoin que cualquiera puede tomar prestado. La deuda total y el colateral
total son siempre cantidades iguales (préstamo 1:1); las llamadas de margen y las
liquidaciones forzosas están desactivadas. Un activo de mercado de predicción
tiene el mercado activo de sí mismo con su colateral.
Estar de acuerdo con la predicción significa comprar el activo de mercado de
predicción, mientras que estar en desacuerdo significa tomarlo prestado y
venderlo.
La resolución de un activo de mercado de predicción se realiza forzando la
liquidación global (global settlement), con un precio de liquidación global dado
por el emisor.
Tras la resolución (liquidación global), y si la predicción resulta cierta (precio
de liquidación global 1), los poseedores del activo de mercado de predicción
pueden liquidarlo de inmediato de forma forzosa para obtener la misma cantidad del
colateral subyacente.
Si la predicción es incorrecta (precio de liquidación global 0), los propietarios
de posiciones con margen recuperarán automáticamente todo el colateral que estaba
bloqueado en la posición.
