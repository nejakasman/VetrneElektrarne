const { ipcMain } = require('electron');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');

async function getLocationName(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'VetrneElektrarneApp' } });
    const data = await res.json();
    return data.display_name || 'Neznana lokacija';
  } catch (error) {
    console.error('Napaka pri pridobivanju imena lokacije:', error);
    return 'Napaka pri pridobivanju lokacije';
  }
}

//pridobivanje statične slike zemljevida za PDF

async function getLeafletMapImage(lat, lon) {
  const mapPath = path.join(__dirname, 'map.png');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Map</title>
    <style>
    #map { width: 600px; height: 300px; }
    html, body { margin: 0; padding: 0; }
    .leaflet-control-container, .leaflet-control-attribution { display: none !important; }
    </style>
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <script>
        var map = L.map('map').setView([${lat}, ${lon}], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
        var windTurbineIcon = L.icon({
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAACiUlEQVR4nNWZO2sVQRSAP5OIIj7w1fhGxD8gqGBhpYJGkBRCQFBQURBFxdJCBUsVxcLCNzZCbMREsRAEYzQoEsQHYqr4SrAJNmq4rhw4F8Jl7+ycvXfvznxwmj2zc+e7u7N7ZhaKZS/wHfgG7CdSuoBkUvwDdhIZU4HhGpFEr850ImJ3ikQ1uomIJw6Rx0TCfGDCIVLRNsHT7ZCoxg4i4JKHyDki4KWHyACB0wH89hAZB6YQMKs8JKqxhIDZahDZRMAcMYgEXXudNYicIWCuGERuEDD3DCK9BMxTg8hzAuadQeQjATNqEBkjUDZmVL21MaHnBMNs4KKW54kxZPl7G5hXtsR24ItjoA+AxVqO9DnajQCdZQjM0veApZ5a6tH+KjCzVRLrgM+et45VJAE+AWuLljgM/DXMgT6VEYmHhvP+AIeKEJAtnGs5JnOjcQeY0SyJhcBgCRKJhqw4FzQqsVzfwEnJ8QFYlldiZcajtdUxAqywSswx1k1ZpchYk/p6qy9gL9qMT5h6IVfzqE5WiWPA1yb02+u7cbGnwR96DxwApqX0LccONmHe7fIReZWj44qWI5sn/Vtt+mnhtUaXHkPbbNH3TJ4abdBH5Jehwx+6ayjbQLWcSml/OqXdauCCcQkw7iNyP6MTmbjXdetHNuTqkVaL3cz4ptIJ3AJ+ZoxBxpjJXOA88EZrKlmS3gWOA+uBdp9O6jwwHnme2w5sAE4APcAL/XA0pGOTMbaMoRQRORYdoykiciwqOuo8jSo6F6JhkWOiSi4a1jhEJBcN2xwikouGfQ4RyUXDSYeI5KLhskNEctHQ4xCRXDT0O0QkFw3DDhHJlcpAjnVDo9FfhIjrdikqnvmO7j+Q3vJ1UQWy6QAAAABJRU5ErkJggg==',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
        });
        L.marker([${lat}, ${lon}], {icon: windTurbineIcon}).addTo(map);
      </script>
    </body>
    </html>
  `;
  try {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    const mapElement = await page.$('#map');
    if (!mapElement) {
      await browser.close();
      throw new Error('Map element not found');
    }
    await mapElement.screenshot({ path: mapPath });
    await browser.close();
    return mapPath;
  } catch (err) {
    return null;
  }
}

ipcMain.handle('generate-pdf-report', async (event, { location, turbines, windData, energyResults, filePath }) => {
  try {
    const savePath = filePath || path.join(__dirname, '../pdf-porocilo.pdf');
    const doc = new PDFDocument({ autoFirstPage: false, margin: 50 });
    const stream = fs.createWriteStream(savePath);
    doc.pipe(stream);

    const fontPath = path.join(__dirname, '../backend/fonts/Roboto-Regular.ttf');
    const fontBoldPath = path.join(__dirname, '../backend/fonts/Roboto-Bold.ttf');
    const fallbackFont = 'Helvetica';

    if (fs.existsSync(fontPath) && fs.existsSync(fontBoldPath)) {
      doc.font(fontPath);
    } else {
      console.warn('Pisave Roboto niso najdene, uporaba privzete pisave Helvetica.');
      doc.font(fallbackFont);
    }

    //prva stran: Naslov, opis, lokacija, zemljevid
    console.log('Generiranje prve strani - Stanje location:', location);
    doc.addPage({ size: 'A4' });
    doc.rect(0, 0, doc.page.width, 50).fill('#4BC0C0');
    doc.fillColor('white').fontSize(24).font(fs.existsSync(fontBoldPath) ? fontBoldPath : 'Helvetica-Bold').text('Poročilo o potencialu vetrne elektrarne', 50, 20, { align: 'center' });
    doc.moveDown(2);
    doc.fillColor('black').font(fs.existsSync(fontPath) ? fontPath : fallbackFont).fontSize(14).moveDown(2);
    doc.text('To poročilo prikazuje izračunano letno proizvodnjo električne energije za izbrane turbine na določeni lokaciji.', { align: 'left' });
    doc.moveDown(2);
    doc.fontSize(12).text(`Lokacija: ${location.latitude}, ${location.longitude}`);
    doc.moveDown();
    doc.text(`Naslov/ime lokacije: ${await getLocationName(location.latitude, location.longitude)}`);
    doc.moveDown(3);
    doc.text(`Datum: ${new Date().toLocaleString('sl-SI')}`);
    doc.moveDown(2);

    
    let mapImage;
    try {
    mapImage = await getLeafletMapImage(location.latitude, location.longitude);
    } catch (e) {
    mapImage = null;
    }
    if (mapImage) {
    doc.image(mapImage, 100, doc.y, { width: 400 });
    fs.unlink(mapImage, () =>{});
    } else {
    doc.text('Zemljevid ni na voljo.', { align: 'center' });
    }

    //druga stran: Mesečni in tedenski grafi
    console.log('Generiranje druge strani - Stanje energyResults:', energyResults);
    for (const result of energyResults) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 50).fill('#D3D3D3');
      doc.fillColor('black').fontSize(18).font(fs.existsSync(fontBoldPath) ? fontBoldPath : 'Helvetica-Bold').text(`Energijska proizvodnja za ${result.name}`, 50, 20, { align: 'left' });

      doc.fillColor('black').font(fs.existsSync(fontPath) ? fontPath : fallbackFont).fontSize(14).moveDown(2);
      doc.text(`Letna proizvodnja: ${result.totalEnergy.toFixed(2)} kWh`, 50, doc.y);
      doc.moveDown();

      const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 400, height: 300 });

      const monthlyChart = await chartJSNodeCanvas.renderToBuffer({
        type: 'bar',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
          datasets: [{
            label: `Mesečna proizvodnja (${result.name})`,
            data: result.monthlyEnergy,
            backgroundColor: '#1a3c6d',
            borderWidth: 2,
            fill: true
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { title: { display: true, text: 'Energija (kWh)' } }
          }
        }
      });

      const weeklyChart = await chartJSNodeCanvas.renderToBuffer({
        type: 'line',
        data: {
          labels: Array.from({ length: 52 }, (_, i) => `Teden ${i + 1}`),
          datasets: [{
            label: `Tedenska proizvodnja (${result.name})`,
            data: result.weeklyEnergy,
            borderColor: '#1a3c6d',
            backgroundColor: 'rgba(26, 60, 109, 0.2)',
            borderWidth: 2,
            tension: 0.3,
            fill: false
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { position: 'top' } },
          scales: {
            y: { title: { display: true, text: 'Energija (kWh)' } }
          }
        }
      });

      const chartWidth = 400;
      const chartX = 100;
      const chartY = doc.y;

      doc.image(monthlyChart, chartX, chartY, { width: chartWidth });
      doc.image(weeklyChart, chartX, chartY + 330, { width: chartWidth });
    }

    // Tretja stran: Karakteristike turbine
    console.log('Generiranje tretje strani - Stanje turbines:', turbines);
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 50).fill('#D3D3D3');
    doc.fillColor('black').fontSize(18).font(fs.existsSync(fontBoldPath) ? fontBoldPath : 'Helvetica-Bold').text(`Karakteristike izbrane turbine`, 50, 20, { align: 'left' });

    const turbineList = Array.isArray(turbines) ? turbines : [turbines];
    const turbine = turbineList[0] || { name: 'Neznano', speeds: [], powers: [] };

    doc.fillColor('black')
      .fontSize(14)
      .font(fs.existsSync(fontPath) ? fontPath : fallbackFont)
      .text(`Turbina: ${turbine.name}`, 50, 60);


    console.log('Izbrana turbina:', turbine);

    if (!turbine.name || !Array.isArray(turbine.speeds) || !Array.isArray(turbine.powers) || turbine.speeds.length === 0 || turbine.powers.length === 0) {
      doc.fillColor('black')
        .font(fs.existsSync(fontPath) ? fontPath : fallbackFont)
        .fontSize(14)
        .text('Podatki o turbini niso na voljo. Preverite format podatkov turbine.', 50, 90);
      console.log('Napaka: Podatki turbine manjkajo ali so nepravilni:', turbine);
    } else {
      const turbineData = turbine.speeds.map((speed, i) => ({
        speed: speed,
        power: turbine.powers[i] || 0,
      })).sort((a, b) => a.speed - b.speed);

      const sortedSpeeds = turbineData.map(d => d.speed);
      const sortedPowers = turbineData.map(d => d.power);

      const half = Math.ceil(turbineData.length / 2);
      const column1 = [['Hitrost (m/s)', 'Moč (kW)'], ...turbineData.slice(0, half).map(d => [d.speed.toString(), d.power.toString()])];
      const column2 = [['Hitrost (m/s)', 'Moč (kW)'], ...turbineData.slice(half).map(d => [d.speed.toString(), d.power.toString()])];

      const tableX = 100;
      const tableY = 90;
      const cellWidth = 80;
      const cellHeight = 17;
      const columnGap = 80;

      function drawColumn(doc, data, startX, startY, cellWidth, cellHeight) {
        data.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            const x = startX + colIndex * cellWidth;
            const y = startY + rowIndex * cellHeight;
            doc.rect(x, y, cellWidth, cellHeight).fill(rowIndex === 0 ? '#D3D3D3' : 'white');
            doc.fillColor('black');
            doc.rect(x, y, cellWidth, cellHeight).stroke();
            doc.fontSize(10).text(cell, x + 5, y + 5, { width: cellWidth - 10, align: 'center' });
          });
        });
      }

      drawColumn(doc, column1, tableX, tableY, cellWidth, cellHeight);
      drawColumn(doc, column2, tableX + column1[0].length * cellWidth + columnGap, tableY, cellWidth, cellHeight);

      let graphX = tableX;
      let graphY = tableY + (half + 1) * cellHeight + 20;
      const availableHeight = doc.page.height - graphY - 50;
      const maxGraphWidth = doc.page.width - 2 * tableX;

      const graphWidth = Math.min(400, maxGraphWidth);
      const graphHeight = Math.min(availableHeight, 350); // naj bo višina min 350

      const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: graphWidth, height: graphHeight });

      const curveImg = await chartJSNodeCanvas.renderToBuffer({
        type: 'line',
        data: {
          labels: sortedSpeeds,
          datasets: [{
            label: `Moč (${turbine.name})`,
            data: sortedPowers,
            borderColor: '#1a3c6d',
            backgroundColor: 'rgba(26, 60, 109, 0.2)',
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: false,
          plugins: {
            legend: { position: 'top' },
          },
          scales: {
            x: { title: { display: true, text: 'Hitrost vetra (m/s)', color: '#1a3c6d' }},
            y: { title: { display: true, text: 'Moč (kW)', color: '#1a3c6d' }},
          }
        }
      });

      // Če ni dovolj prostora na trenutni strani, dodaj novo stran za graf
      if (graphY + graphHeight > doc.page.height) {
        doc.addPage();
        graphY = 50;
      }

      doc.image(curveImg, graphX, graphY, { width: graphWidth, height: graphHeight });
    }

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return { status: 'success', filePath: savePath };
  } catch (error) {
    console.error('Napaka pri generiranju PDF poročila:', error);
    return { status: 'error', message: error.message };
  }
});
