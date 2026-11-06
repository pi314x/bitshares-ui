[# lifetime]
### Ücretlerde %{feesCashback} iade alın

BitShares ağındaki her işlem, ağ ile yönlendirenler arasında paylaştırılır. Ömür Boyu Üyeliğe kaydolan hesap, ödediği her işlem ücretinden %{feesCashback} iade alır. Bonus olarak, kaydını yaptığı veya ağa yönlendirdiği kullanıcılardan yönlendirme geliri elde etmeye de hak kazanır.

Ömür Boyu Üyelik fiyatı zamanla değişir, şu anda yalnızca {price}.

[# fee-division]
#### Ücret Paylaşımı
{account} her işlem ücreti ödediğinde bu ücret birkaç farklı hesap arasında paylaştırılır. Ağ %{networkFee} pay alır, {account} hesabını yönlendiren Ömür Boyu Üye ise %{lifetimeFee} pay alır.

Kayıtçı, {account} hesabını ağa kaydetmek için işlem ücretini ödeyen hesaptır. Kayıtçı, kalan %{referrerTotalFee} oranının kendisi ile kendi Bağlı Yönlendiren programı arasında nasıl bölüşüleceğine karar verir.

{account} hesabının kayıtçısı, toplam ücretin %{referrerFee} kadarını Bağlı Yönlendiren ile paylaşmayı ve toplam ücretin %{registrarFee} kadarını kendine bırakmayı seçti.


#### Bekleyen Ücretler
{account} tarafından ödenen ücretler, her bakım aralığında ({maintenanceInterval} saniye) bir kez ağ, yönlendirenler ve kayıtçılar arasında paylaştırılır. Bir sonraki bakım zamanı {nextMaintenanceTime}.

#### Vesting Ücretleri

Çoğu ücret hemen kullanıma sunulur, ancak {vestingThreshold} üzerindeki ücretler
(üyeliğinizi yükseltmek veya premium bir hesap adı kaydetmek için ödenenler gibi) toplam {vestingPeriod} gün boyunca kademeli olarak serbest bırakılır (vesting).

