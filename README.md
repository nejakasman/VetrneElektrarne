# Praktikum 2

## Naziv projekta
Kalkulator proizvodnje vetrne elektrarne

## Opis projekta

Namizna aplikacija za oceno letne proizvodnje električne energije vetrnih turbin na podlagi:

- geografske lokacije stojišča,
- tipa in karakteristik izbrane turbine,
- podatkov o vetrovnih razmerah iz vremenskih virov.

Projekt je namenjen kot pomoč pri načrtovanju mikrolokacij za vetrne elektrarne, še posebej v zgodnjih fazah analiz.


## Dodana vrednost

- **Enostavna uporaba:** intuitiven vmesnik z zemljevidom in možnostjo hitrega vnosa lastnih turbin.
- **Primerjava več turbin:** omogoča primerjavo različnih tipov turbin na isti lokaciji.
- **PDF poročilo:** generiranje profesionalnega poročila z grafi, tabelami in zemljevidom.
- **Lokalno shranjevanje:** vsi podatki in rezultati so shranjeni lokalno, brez potrebe po registraciji.
- **Zgodovina izračunov:** možnost ponovnega ogleda in primerjave preteklih izračunov.


## Funkcionalnosti

- Izbira lokacije stojišča na zemljevidu ali ročni vnos koordinat
- Dodajanje in urejanje podatkov o turbini (moč, krivulja moči)
- Samodejno pridobivanje zgodovinskih podatkov o hitrosti vetra za izbrano lokacijo
- Izračun letne proizvodnje električne energije na podlagi vnesenih podatkov in vremenskih razmer
- Grafični prikaz rezultatov in možnost primerjave več turbin
- Izvoz rezultatov in analiz v PDF poročilo
- Shranjevanje in pregled zgodovine izračunov za kasnejšo primerjavo


## Tehnološki sklad

- **Frontend:** HTML, CSS (Bootstrap, ročni stil), JavaScript
- **Zemljevid:** Leaflet.js
- **Grafi:** Chart.js
- **Backend:** Node.js, Electron
- **Baza:** SQLite
- **PDF generacija:** pdfkit, chartjs-node-canvas, puppeteer
- **Vremenski podatki:** Open-Meteo API


## Namestitev in zagon

1. Kloniraj repozitorij:
   ```sh
   git clone https://github.com/nejakasman/VetrneElektrarne.git
   cd VetrneElektrarne
   ```
2. Namesti odvisnosti:
   ```sh
   npm install
   ```
3. Zaženi aplikacijo:
   ```sh
   npm start
   ```
Več informacij v [package.json](package.json).


## Nadaljnji razvoj

- Dodajanje večih lokacij in izvoz primerjav
- Podpora za dodatne vremenske vire
- Večjezičnost
- Naprednejši izračuni (upoštevanje višine osi, turbulence, ...)


## Izsek kode (API primer)

````js
 const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${params.latitude}&longitude=${params.longitude}&start_date=${params.start_date}&end_date=${params.end_date}&hourly=${params.hourly}&wind_speed_unit=${params.wind_speed_unit}`;
````

## Zaslonske slike

![Primer zaslona](src/assets/screenshots/Screenshot%202025-06-10%20at%2014.53.41.png)
![Primer zaslona](src/assets/screenshots/Screenshot%202025-06-10%20at%2014.53.32.png)
![Primer zaslona](src/assets/screenshots/Screenshot%202025-06-10%20at%2014.53.49.png)
![Primer zaslona](src/assets/screenshots/Screenshot%202025-06-10%20at%2014.53.58.png)


## Avtorji

- Anastasiya Stepanyan
- Stanislav Shevnin
- Neja Kašman
