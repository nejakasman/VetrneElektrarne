# Utemeljitev izbire enot in testov

Testi so napisani z Jest. 
Baza, Electron in datotečni sistem so po potrebi nadomeščeni z mock objekti.
Za ustvarjanje testov je bil uporabljen Copilot -> agent GPT-6 Luna

## 1. Zgodovina izračunov
Zgodovina povezuje izračun z obstoječo turbino, zapisuje več vrst podatkov in obravnava napake baze. 
Ločeno branje zgodovine preverja tudi, ali se podatki klicatelju vrnejo oziroma ali se napaka pri branju pravilno posreduje.

Pričakovano delovanje:
- Shranjevanje mora poiskati turbino po imenu in zapisati ID lokacije, ID turbine, energijske vrednosti, podatke o vetru, ponudnika, višino ter čas izračuna.
- Polja z več vrednostmi morajo biti shranjena v obliki, ki ohrani njihove podatke.
- Če turbine ni ali poizvedba oziroma vstavljanje v bazo odpove, se mora operacija končati z napako.
- Branje mora vrniti zapise zgodovine; napaka baze se mora posredovati klicatelju.

## 2. Izvoz turbin v CSV
Izvoz pretvarja strukturirane podatke turbin v datotečni format. Posebej pomembni so robni primeri pri zapisovanju, kot so posebni znaki, decimalne vrednosti ali manjkajoča moč.

Pričakovano delovanje:
- Ustvari CSV z glavo in vrstico za vsako podatkovno točko turbine.
- Imena s posebnimi znaki ustrezno obdela, decimalke pa zapiše v dogovorjeni obliki.
- Za prazen seznam turbin ustvari veljaven CSV samo z glavo.
- Ob manjkajoči poti, napaki pri branju podatkov ali napaki pri pisanju vrne rezultat z napako.

## 3. Izvoz turbin v JSON
JSON-izvoz mora ohraniti strukturo podatkov turbin in poročati o napakah, ki nastanejo pred izvozom ali med pisanjem datoteke.

Pričakovano delovanje:
- Podatke turbin zapiše v izbrano datoteko kot veljaven, berljivo oblikovan JSON.
- Vrne uspeh in uporabljeno pot, če je zapis uspel.
- Ob manjkajoči poti, napaki pri branju turbin ali napaki pri pisanju vrne rezultat z napako.

## 4. Preverjanje internetne povezave in obvestilo
Preverjanje internetne povezave in prikaz obvestila sta uporabniku vidna vedenja, ki morata pravilno obravnavati tako neuspešen odgovor kot omrežno izjemo.

Pričakovano delovanje:
- `checkInternetConnection` vrne `true`, kadar zahteva uspe, in `false`, kadar strežnik vrne neuspešen odgovor ali zahteva odpove.
- `updateOnlineStatus` ob nedosegljivi povezavi prikaže eno obvestilo, ne glede na ponovljena preverjanja.
- Ko povezava znova deluje, obvestilo odstrani.
