# Popis stanja projekta

## Dokumentacija projekta
Navodila za namestitev in zagon aplikacije so primerno zapisana in omogočajo uspešni zagon aplikacije. 
Ob pregledu dokumentacije je bilo ugotovljeno, da je po večini zadostna, vendar pri sklopu Dodane vrednosti se ni upoštevalo čisto zadnja različica aplikacije. Ni navedeno, da je omogočena izbira več različnih ponudnikov vremenskih podatkov (API). 
- V sklopu Funkcionalnosti ni navedeno, da aplikacija omogoča uvoz in izvoz vremenskih poodatkov v .csv ali .json datoteki. 
- V sklopu Tehnološki sklad, niso navedeni vsi ponudniki vremenskih podatkov. Namreč je naveden samo en, ko v resnici aplikacija omogoča izbiro med tremi različnimi ponudniki.
- V sklopu Namestitev in zagon, so navodila za zagon aplikacija v načinu za razvijalce. Potrebno je še dodati navodila za izgradnjo (build) electron namizne aplikacije na različnih operacijskih sistemih.
- V sklopu zaslonskih posnetkov so slike starejše različice aplikacije. 


## Standarde kodiranja
Projekt upošteva standarde kodiranja. Uporabljena so razumljiva poimenovanja spremenljivk, funkcij in razredov. Koda ne vsebuje odvečnih komentarjev, so le tam kjer so potrebni. Izvorna koda je stilsko lepo urejena, ne vsebuje odvečnih presledkov, razmikov. Koda je pregledna in berljiva. Datoteke so primerno gnezdene v mape.

## Testiranje in zagotavljanje kakovsoti
Projekt vključuje samo 3 osnovne teste. Za pisanje testov je bilo uporabljeno orodje Jest Javascript. 
- Test calculateAnnualEnergy preveri funkcijo za poslovno logiko izračuna proizvedene energije na tedenski in mesečni ravni. Test prejme izmišljene podatke, ki preverijo ali funkcija deluje po pričakovanjih glede na podane vrednosti. Preveri se, ali funkcija vrne uspešni rezultat ob primernih podatkih in ali vrne neuspešno pri podatkih v spodnjih ekstremih. Manjka pa sicer test za vrednosti, ki so bistveno večje od pričakovanih. 

- Test getTurbineSpeeds testira pridobivanje moči in hitrosti turbine iz baze podatkov. Test preveri scenariji veljavne turbine, nenajdene turbine, neobstoječe turbine in ali baza bo vrgla napako. 

- Test turbine.test preveri osnovne uspešni scenariji CRUD operacij za turbine. Test preveri, ali je aplikacija zmožna ustvariti, posodobiti, zbrisati ali pridobiti podatke o turbini iz podatkovne baze.

Pri pisanju testov je prišlo v pomoč orodje Copilot, smiselnost in pravilnost testov pa je bilo preverjeno z ročnim pregledom kode in poslovne logike. 