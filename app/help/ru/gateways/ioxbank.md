# Мгновенный шлюз ioxbank
Сервис мгновенного шлюза ioxbank соединяет криптовалюты между BitShares и другими блокчейнами. Блокчейн-транзакции проводятся сразу после подтверждения блоков в соответствующем блокчейне. Криптовалюты, поддерживаемые ioxbank, легко узнать: у них префикс **IOB.**, и их можно найти на странице обзора активов.

### Информация о прозрачности шлюза

## XRP
- [Баланс XRPL](https://livenet.xrpl.org/accounts/rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y)
- [Текущее предложение IOB.XRP](/asset/IOB.XRP)

## XLM
- [Баланс XLM](https://stellarchain.io/accounts/GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH)
- [Текущее предложение IOB.XLM](/asset/IOB.XLM)

## Возможности шлюза

### Возможности IOB.XRP
- Мгновенный шлюз
- Мин. сумма: 10 XRP
- Без KYC
- Без лимитов
- 0% рыночной комиссии для мейкера/тейкера
- Низкая комиссия за вывод

### Возможности IOB.XLM
- Мгновенный шлюз
- Мин. сумма: 50 XLM
- Без KYC
- Без лимитов
- 0% рыночной комиссии для мейкера/тейкера
- Низкая комиссия за вывод

## Способы работы со шлюзом

### Ввод/вывод через интерфейс эталонного кошелька

- **Ввод:** нажмите *Ввод* в меню-гамбургере, затем выберите XRP или XLM; Вам будут показаны адрес и (тег или мемо), которые нужно использовать снаружи для ввода средств; обязательно укажите тег или мемо в исходной транзакции на шлюз.
- **Вывод:** нажмите *Вывод* в меню-гамбургере, затем выберите XRP или XLM; внимательно введите адрес назначения и (тег или мемо). Если Вы используете адрес биржи, а не свой собственный, используйте именно то, что предоставила биржа.

### Ввод XRP, если Вы уже знаете свой **user-id** в BitShares
- **Адрес назначения XRP-шлюза:** rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y
- **Назначение XRP-шлюза (тег или мемо):** user-id в BitShares (без 1.2.)

### Ввод XLM, если Вы уже знаете свой **user-id** в BitShares
- **Адрес назначения XLM-шлюза:** GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH
- **Назначение XLM-шлюза (тег или мемо):** user-id в BitShares (без 1.2.)

### Ручной вывод через **отправку** активов

### Вывод XRP из кошелька BitShares в кошелек XRP
Отправьте свои активы **IOB.XRP** на аккаунт блокчейна BitShares [ioxbank-gateway](/account/ioxbank-gateway) и укажите в мемо BitShares свой адрес назначения XRP и назначение (тег или мемо), как в примерах ниже: замените *xrp-address* на Ваш адрес назначения XRP, а **tag-or-memo-number** - на номер Вашего назначения (тег или мемо). Если номер (тег или мемо) Вам НЕ нужен, например потому что Вы владеете ключами адреса назначения, Вы можете просто отправить актив **IOB.XRP** на [ioxbank-gateway](/account/ioxbank-gateway) и указать только свой **xrp-destination-address** без номера (тег или мемо):

Формат мемо BitShares
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**
- xrp:**xrp-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xrp:**xrp-destination-address**

Примеры мемо BitShares
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**:tag:**485738**:thanks ioxbank
- xrp:**rDce39TBzszQJx2sshLy5jPXV3F9nEaQ9Y**

### Вывод XLM из кошелька BitShares в кошелек XLM
Отправьте свои активы **IOB.XLM** на аккаунт блокчейна BitShares [ioxbank-gateway](/account/ioxbank-gateway) и укажите в мемо BitShares свой адрес назначения XLM и назначение (тег или мемо), как в примерах ниже: замените *xlm-address* на Ваш адрес назначения XLM, а **tag-or-memo-number** - на номер Вашего назначения (тег или мемо). Если номер (тег или мемо) Вам НЕ нужен, например потому что Вы владеете ключами адреса назначения, Вы можете просто отправить актив **IOB.XLM** на [ioxbank-gateway](/account/ioxbank-gateway) и указать только свой **xlm-destination-address** без номера (тег или мемо):

Формат мемо BitShares
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**
- xlm:**xlm-destination-address**:tag:**tag-or-memo-number**:**any notes**
- xlm:**xlm-destination-address**

Примеры мемо BitShares
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**:tag:**485738**:thanks ioxbank
- xlm:**GCYDZS45X25IKBOOV7PJNYKH5RNGVGSDUH4TTYGXHFBBQMVHG7GVUHMH**

## Техническая поддержка
- [Поддержка в реальном времени](https://t.me/ioxbank)
- [Создать заявку](https://support.ioxbank.com)
