# Oy Kullanma

> BitShares'te oy kullanmak, yaşadığınız topluluk için önemli olduğu kadar önemlidir. Oyunuzun ağırlığı doğrudan sahip olduğunuz BTS miktarıyla orantılıdır. Toplulukta çok aktif değilseniz, çıkarlarınızı temsil eden bir vekil seçmeniz önerilir. Toplulukta daha fazla yer almak isterseniz bu [kanallara](/help/introduction/bitshares) göz atın.

## Vekil

BitShares yönetiminde aktif **olmamayı** seçebilirsiniz. Bu durumda BitShares topluluğunda kendinizi yakın hissettiğiniz birini seçip onu vekiliniz olarak belirlemeniz önemlidir. Bu, ona BTS paylarınızın desteğiyle sizin adınıza oy kullanma yetkisi verir. Bir temsilci seçmeye benzer.

## Tanıklar

Tanıklar, yeni bloklar inşa ederek blokzincirine çalışan kimselerdir. Rolleri Bitcoin ve diğer blokzincirlerindeki madencilere benzer. Her tanık hissedarlar tarafından onaylanır, doğrulanmış işlemlerden bloklar inşa eder ve imzalar. Ağda gerçekleşen her işlemin tüm tanıklar tarafından doğrulanması gerekir.

### Mutabakat Mekanizması

Kimin tam olarak hangi anda blok *üretebileceği* *Delegated Proof of Stake* (Yetkilendirilmiş Pay İspatı) denilen mutabakat mekanizmasıyla belirlenir. Esasında, siz BitShares hissedarları tercih ettiğiniz blok üreticilerine blokzincirinde oy verebilirsiniz. En çok oyu alan *tanıkların* blok üretmesine izin verilir.


## Kurul

Kurul, hissedarlar tarafından onaylanan ve BitShares blokzincirinin politikasını belirleyen kişilerden oluşan bir gruptur. Belirledikleri şunlardır:

* İşlem ve alım-satım ücretleri
* Blok boyutu ve blok aralığı gibi blokzinciri parametreleri
* Nakit iade oranı ve vesting süreleri gibi yönlendirme ve vesting parametreleri

## Emekçiler

Emekçiler, blokzincirinden maaş karşılığında hizmet vermeyi öneren tekliflerdir. Bir emekçi teklifi en azından şu bilgileri içerir:

* Bir başlangıç ve bir bitiş tarihi
* Günlük bir ücret
* Maksimum bir toplam ücret
* Emekçi teklifinin anlatıldığı bir web sayfasının bağlantısı

### Emekçinin Yaşam Döngüsü

#### Önerilen
Bu emekçi teklifleri blokzincirine sunulmuştur ve aktif olarak oylanmaktadır. Aktif hale gelebilmeleri için toplam oy sayısında refund400k emekçisini geçmeleri gerekir.
#### Aktif
Bu emekçi teklifleri eşiği geçmiştir ve ücretleri ödenmektedir. Oy sayısı refund400k emekçisinin seviyesinin altına düşerse aktif emekçilerin fonu kesilebilir.
#### Süresi Dolmuş
Bu emekçi teklifleri tarihsel kayıt amacıyla gösterilir. Bitiş tarihi geçerek sona ermiş teklifleri burada bulursunuz.

### Emekçi bütçesinin işleyişi
Emekçilere ücretleri, günlük sabit bir bütçeden ilk gelen ilk çalışır prensibiyle, para tükenene kadar ödenir.

* Tüm emekçiler için günlük toplam bütçe 400k BTS
* Oyların toplamı pozitif olan, her biri günlük 100k BTS talep eden 5 emekçi teklifi

En çok oyu olan dört emekçinin her birine günlük 100k BTS ödenir, ama ödemeler yapıldığında emekçi bütçesi tükenmiş olur. Bu yüzden beşinci emekçi hiçbir şey almaz.
