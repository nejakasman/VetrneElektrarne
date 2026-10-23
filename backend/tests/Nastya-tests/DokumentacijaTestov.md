Za teste je uporabljeno ogrodje Jest. Za ustvarjanje testov je bil izbran Copilot in ChatGPT

## 1. nasaPower() – backend/api/suppliers/nasaPower.js
Utemeljitev izbire: Funkcija pretvarja podatke ponudnika NASA POWER v obliko, ki jo uporablja aplikacija. Pomembna je, ker morajo biti meritve pravilno pretvorjene in urejene.

Pričakovano delovanje: Funkcija mora podatke o vetru pretvoriti v enotno strukturo, ki vsebuje čas meritve v formatu ISO in hitrost vetra. Meritve morajo biti urejene kronološko. Številčne vrednosti mora pretvoriti v števila, manjkajoče meritve pa ustrezno obravnavati. Podpirati mora tudi alternativna imena parametrov ter prazne ali neveljavne vhodne podatke.
## 2. fetchWeatherData() – backend/api/api.js
Utemeljitev izbire: Funkcija pridobiva vremenske podatke iz zunanjih API-jev in jih pretvori v obliko, ki jo uporablja aplikacija. Pomembna je zaradi pravilne komunikacije z različnimi ponudniki podatkov.

Pričakovano delovanje: Funkcija mora glede na izbranega ponudnika pridobiti vremenske podatke in jih ustrezno normalizirati. Pri ponudniku Open-Meteo mora izbrati pravilni parameter glede na zahtevano višino meritve, pri ponudniku NASA POWER pa mora uporabiti ustrezno pretvorbo podatkov. Ob neuspešni zahtevi, manjkajočih podatkih ali neznanem ponudniku mora ustrezno javiti napako.
## 3. findOrFetchWeatherData() – backend/api/weatherData.js
Utemeljitev izbire: Funkcija povezuje pridobivanje vremenskih podatkov z njihovo shrambo v podatkovni bazi. Pomembna je, ker omogoča ponovno uporabo že shranjenih meritev in zmanjšuje nepotrebne klice zunanjih API-jev.

Pričakovano delovanje: Funkcija mora najprej preveriti, ali so za izbrano lokacijo in višino na voljo ustrezne meritve v podatkovni bazi. Če so podatki na voljo za dovolj bližnjo lokacijo, jih mora vrniti brez novega klica API-ja. Sicer mora pridobiti nove podatke, jih pravilno shraniti v podatkovno bazo in jih vrniti. Pri tem mora ohraniti pravilno višino meritve in vrednosti hitrosti vetra ter ustrezno obravnavati primere, ko podatki niso na voljo.