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

function calculateMonthlyWindStats(windData) {
  const monthlyData = Array(12).fill().map(() => ({ speeds: [] }));

  windData.forEach(data => {
    const date = new Date(data.datetime);
    const month = date.getMonth();
    monthlyData[month].speeds.push(data.wind_speed_100m);
  });

  return monthlyData.map((monthData, index) => {
    const speeds = monthData.speeds;
    if (speeds.length === 0) {
      return { month: index + 1, max: 0, min: 0, avg: 0 };
    }
    const max = Math.max(...speeds);
    const min = Math.min(...speeds);
    const avg = speeds.reduce((sum, val) => sum + val, 0) / speeds.length;
    return { month: index + 1, max, min, avg };
  });
}

ipcMain.handle('generate-pdf-report', async (event, { location, turbines, windData, energyResults, filePath }) => {
  try {
    const savePath = filePath || path.join(__dirname, '../pdf-porocilo.pdf');
    const doc = new PDFDocument({ autoFirstPage: false, margin: 40 });
    const stream = fs.createWriteStream(savePath);
    doc.pipe(stream);

    const fontPath = path.join(__dirname, '../backend/fonts/Roboto-Regular.ttf');
    const fontBoldPath = path.join(__dirname, '../backend/fonts/Roboto-Bold.ttf');
    const fallbackFont = 'Helvetica';

    if (fs.existsSync(fontPath) && fs.existsSync(fontBoldPath)) {
      doc.registerFont('Roboto', fontPath);
      doc.registerFont('Roboto-Bold', fontBoldPath);
    } else {
      console.warn('Pisave Roboto niso najdene, uporaba privzete pisave Helvetica.');
      doc.font(fallbackFont);
    }
    //Prva stran: naslov, uvod, podatki o lokaciji in zemljevid
    doc.addPage({ size: 'A4' });
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('white');
    doc.fillColor('#2E2E2E').fontSize(24).font('Roboto-Bold')
      .text('Poročilo o potencialu vetrne elektrarne', 40, 70, { align: 'center', width: doc.page.width - 80 });
      doc.moveTo(40, 100).lineTo(doc.page.width - 40, 100).lineWidth(1).stroke('#000000');
    doc.moveDown();
    doc.fontSize(14).text(`Datum: ${new Date().toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    doc.moveDown();
    doc.fontSize(12).font('Roboto')
    doc.text('Ta dokument predstavlja informativni izračun letne proizvodnje električne energije iz vetra za izbrano lokacijo in tip vetrne turbine. Pri izračunu so uporabljeni javno dostopni meteorološki podatki o hitrosti vetra za leto 2024, zbrani na višini 100 metrov. Na podlagi urnih vrednosti vetra in tehničnih karakteristik izbrane turbine je izvedena preliminarna ocena energetskega izplena. Dokument vključuje podatke o lokaciji, vetrovne razmere, lastnosti turbine ter izračunano proizvodnjo, s čimer nudi celovit vpogled v vetrni potencial konkretne mikrolokacije.', 40, doc.y, { align: 'left', width: doc.page.width - 80 });
    doc.moveDown(5);

    doc.text(`Koordinate: ${location.latitude}, ${location.longitude}`, 40, doc.y);
    doc.moveDown();
    doc.text(`Naslov: ${await getLocationName(location.latitude, location.longitude)}`, 40, doc.y);
    doc.moveDown(3);

    let mapImage;
    try {
      mapImage = await getLeafletMapImage(location.latitude, location.longitude);
    } catch (e) {
      mapImage = null;
    }
    if (mapImage) {
      doc.image(mapImage, 100, doc.y, { width: 400, height: 200 });
      fs.unlink(mapImage, () => {});
    } else {
      doc.text('Zemljevid ni na voljo.', 40, doc.y, { align: 'center' });
    }



    //druga stran: hitrosti vetra + tabela in graf
    doc.addPage({ size: 'A4' });
    doc.fillColor('black').fontSize(16).font(fs.existsSync(fontBoldPath) ? 'Roboto-Bold' : 'Helvetica-Bold')
      .text('Analiza hitrosti vetra', 40, 50);
    doc.moveTo(40, 70).lineTo(doc.page.width - 40, 70).lineWidth(1).stroke('#000000');
    doc.fontSize(12).font(fs.existsSync(fontPath) ? 'Roboto' : 'Helvetica')
      .text('Spodnja tabela in graf prikazujeta povprečne, maksimalne in minimalne mesečne vrednosti hitrosti vetra na višini 100 metrov.', 40, 80, { width: doc.page.width - 80 });

    const monthlyWindStats = calculateMonthlyWindStats(windData);
    const tableX = 100;
    const tableY = doc.y + 20;
    const cellWidth = 80;
    const cellHeight = 20;
    const headerHeight = cellHeight * 2;
    const rowHeight = cellHeight;

    const windTableData = [
      ['Mesec', 'Povprečna hitrost (m/s)', 'Maksimalna hitrost (m/s)', 'Minimalna hitrost (m/s)'],
      ...monthlyWindStats.map(stat => [
        `${stat.month}-2024`,
        stat.avg.toFixed(2),
        stat.max.toFixed(2),
        stat.min.toFixed(2)
      ])
    ];

    //tabela povprečne, maksimalne in minimalne hitrosti vetra
    function drawWindTable(doc, data, startX, startY, cellWidth, headerHeight, rowHeight) {

      // Calculate table dimensions
   const tableWidth = data[0].length * cellWidth;
   const tableHeight = headerHeight + (data.length - 1) * rowHeight;

   // Center the table horizontally
   const pageWidth = doc.page.width;
   const centeredX = (pageWidth - tableWidth) / 2;
   const finalX = startX !== undefined ? startX : centeredX;

      data.forEach((row, rowIndex) => {
        const currentHeight = rowIndex === 0 ? headerHeight : rowHeight;
        row.forEach((cell, colIndex) => {
          const x = finalX + colIndex * cellWidth;
          const y = startY + (rowIndex === 0
            ? 0
            : headerHeight + (rowIndex - 1) * rowHeight);
          doc.rect(x, y, cellWidth, currentHeight)
             .fill(rowIndex === 0 ? '#E0E0E0' : 'white')
             .stroke('#000000');

             if (colIndex > 0) {
                doc.moveTo(x, y)
                   .lineTo(x, y + currentHeight)
                   .stroke('#000000');
            }

            // Add horizontal lines between rows
            if (rowIndex > 0) {
                doc.moveTo(finalX, y)
                   .lineTo(finalX + tableWidth, y)
                   .stroke('#000000');
            }

          doc.fillColor('black')
            .fontSize(10)
            .font(fs.existsSync(fontPath) ? 'Roboto' : 'Helvetica')
            .text(cell, x, y + (currentHeight / 2 - 5), {
                    width: cellWidth,
                    align: 'center',
                    baseline: 'top'
                });
        });
      });

      doc.rect(finalX, startY, tableWidth, tableHeight).stroke('#000000');
    }

    drawWindTable(doc, windTableData, undefined, tableY, cellWidth, headerHeight, cellHeight);

    //graf hitrosti vetra
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 600 });
    const windChart = await chartJSNodeCanvas.renderToBuffer({
      type: 'line',
      data: {
        labels: monthlyWindStats.map(stat => `${stat.month}-2024`),
        datasets: [
          {
            label: 'Povprečna hitrost vetra',
            data: monthlyWindStats.map(stat => stat.avg),
            borderColor: '#0D47A1',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointStyle: 'circle',
            pointRadius: 4,
            pointBackgroundColor: '#0D47A1'
          },
          {
            label: 'Maksimalna hitrost vetra',
            data: monthlyWindStats.map(stat => stat.max),
            borderColor: '#D81B60',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointStyle: 'circle',
            pointRadius: 4,
            pointBackgroundColor: '#D81B60'
          },
          {
            label: 'Minimalna hitrost vetra',
            data: monthlyWindStats.map(stat => stat.min),
            borderColor: '#757575',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointStyle: 'circle',
            pointRadius: 4,
            pointBackgroundColor: '#757575'
          }
        ]
      },
      options: {
        responsive: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 12, family: 'Roboto' } } } },
        scales: {
          x: {
            title: { display: true, text: 'Mesec', color: '#2E2E2E', font: { size: 12, family: 'Roboto' } },
            ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 10, family: 'Roboto' } }
          },
          y: {
            title: { display: true, text: 'Hitrost vetra (m/s)', color: '#2E2E2E', font: { size: 12, family: 'Roboto' } },
            beginAtZero: true
          }
        }
      }
    });

    let chartY = tableY + (windTableData.length * cellHeight) + 40;
    if (chartY + 250 > doc.page.height - 40) {
      doc.addPage();
      chartY = 80;
    }
    doc.image(windChart, 100, chartY, { width: 400, height: 250 });



     //tretja stran: Karakteristike turbine
    doc.addPage({ size: 'A4' });
    doc.fillColor('black').fontSize(16).font(fs.existsSync(fontBoldPath) ? 'Roboto-Bold' : 'Helvetica-Bold')
      .text('Karakteristike izbrane turbine', 40, 50);
    doc.moveTo(40, 70).lineTo(doc.page.width - 40, 70).lineWidth(1).stroke('#000000');
    doc.fontSize(12).font(fs.existsSync(fontPath) ? 'Roboto' : 'Helvetica')
      .text('Spodnja tabela in graf prikazujeta moč turbine v odvisnosti od hitrosti vetra.', 40, 80, { width: doc.page.width - 80 });

    const turbineList = Array.isArray(turbines) ? turbines : [turbines];
    const turbine = turbineList[0] || { name: 'Neznano', speeds: [], powers: [] };

    doc.fontSize(14).text(`Turbina: ${turbine.name}`, 40, doc.y + 20);

    if (!turbine.name || !Array.isArray(turbine.speeds) || !Array.isArray(turbine.powers) || turbine.speeds.length === 0 || turbine.powers.length === 0) {
      doc.fontSize(12).text('Podatki o turbini niso na voljo. Preverite format podatkov turbine.', 40, doc.y);
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
      //izris tabele moči turbine
      const tableY = doc.y + 20;
  const cellWidth = 60;
  const cellHeight = 16;
  const columnGap = 60;
  const totalTableWidth = column1[0].length * cellWidth + column2[0].length * cellWidth + columnGap;
  const tableX = (doc.page.width - totalTableWidth) / 2;

  function drawColumn(doc, data, startX, startY, cellWidth, cellHeight) {
      const tableWidth = data[0].length * cellWidth;
      const tableHeight = data.length * cellHeight;

      data.forEach((row, rowIndex) => {
          const currentHeight = cellHeight; // Consistent height for all rows

          row.forEach((cell, colIndex) => {
              const x = startX + colIndex * cellWidth;
              const y = startY + rowIndex * cellHeight;

              // Draw cell background and border
              doc.rect(x, y, cellWidth, currentHeight)
                 .fill(rowIndex === 0 ? '#E0E0E0' : 'white')
                 .stroke('#000000');

              // Add vertical lines between columns
              if (colIndex > 0) {
                  doc.moveTo(x, y)
                     .lineTo(x, y + currentHeight)
                     .stroke('#000000');
              }

              // Add horizontal lines between rows
              if (rowIndex > 0) {
                  doc.moveTo(startX, y)
                     .lineTo(startX + tableWidth, y)
                     .stroke('#000000');
              }

              // Add cell content
              doc.fillColor('black')
                 .fontSize(9)
                 .font(fs.existsSync(fontPath) ? 'Roboto' : 'Helvetica')
                 .text(cell, x, y + (currentHeight / 2 - 3), {
                     width: cellWidth,
                     align: 'center',
                     baseline: 'top'
                 });
          });
      });

      // Draw outer table border
      doc.rect(startX, startY, tableWidth, tableHeight)
         .stroke('#000000');

      // Draw header separator
      doc.moveTo(startX, startY + cellHeight)
         .lineTo(startX + tableWidth, startY + cellHeight)
         .lineWidth(1)
         .stroke('#000000');

      // Draw column separator if multiple columns
      if (data[0].length > 1) {
          doc.moveTo(startX + cellWidth, startY)
             .lineTo(startX + cellWidth, startY + tableHeight)
             .lineWidth(1)
             .stroke('#000000');
      }
  }

  // Draw both columns
  drawColumn(doc, column1, tableX, tableY, cellWidth, cellHeight);
  drawColumn(doc, column2, tableX + column1[0].length * cellWidth + columnGap, tableY, cellWidth, cellHeight);

    // Graf moči turbine
    let graphY = tableY + (Math.max(column1.length, column2.length)) * cellHeight + 20;
    const curveImg = await chartJSNodeCanvas.renderToBuffer({
    type: 'line',
    data: {
        labels: sortedSpeeds,
        datasets: [{
        label: `Moč (${turbine.name})`,
        data: sortedPowers,
        borderColor: '#0D47A1',
        backgroundColor: 'rgba(13, 71, 161, 0.1)',
        fill: true,
        tension: 0.4,
        pointStyle: 'circle',
        pointRadius: 3,
        pointBackgroundColor: '#0D47A1'
        }]
    },
    options: {
        responsive: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10, family: 'Roboto' } } } },
        scales: {
        x: { title: { display: true, text: 'Hitrost vetra (m/s)', font: { size: 10, family: 'Roboto' } } },
        y: { title: { display: true, text: 'Moč (kW)', font: { size: 10, family: 'Roboto' } } }
        }
    }
    });

    const graphWidth = 350;
    const graphX = (doc.page.width - graphWidth) / 2;
    doc.image(curveImg, graphX, graphY, { width: graphWidth, height: 200 });
    }



    //četrta stran: Mesečni in tedenski grafi energijske proizvodnje
    for (const result of energyResults) {
      doc.addPage({ size: 'A4' });
      doc.fillColor('black').fontSize(16).font(fs.existsSync(fontBoldPath) ? 'Roboto-Bold' : 'Helvetica-Bold')
        .text(`Energijska proizvodnja za ${result.name}`, 40, 50);
      doc.moveTo(40, 70).lineTo(doc.page.width - 40, 70).lineWidth(1).stroke('#000000');
      doc.fontSize(12).font(fs.existsSync(fontPath) ? 'Roboto' : 'Helvetica')
        .text(`Spodnji grafi prikazujejo mesečno in tedensko proizvodnjo električne energije za turbino ${result.name} na lokaciji: ${location.latitude}, ${location.longitude}.`, 40, 80, { width: doc.page.width - 80 });
      doc.moveDown();
      doc.text(`Letna proizvodnja: ${(result.totalEnergy / 1000000).toFixed(2)} GWh`, 40, doc.y);

      const monthlyChart = await chartJSNodeCanvas.renderToBuffer({
        type: 'bar',
        data: {
          labels: monthlyWindStats.map(stat => `${stat.month}-2024`),
          datasets: [{
            label: `Mesečna proizvodnja (${result.name})`,
            data: result.monthlyEnergy,
            backgroundColor: '#0D47A1',
            borderWidth: 1,
            borderColor: '#0B3D91'
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 12, family: 'Roboto' } } } },
          scales: {
            x: {
              ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 10, family: 'Roboto' } }
            },
            y: { title: { display: true, text: 'Energija (MWh)', font: { size: 12, family: 'Roboto' } },
                  ticks: {
                    callback: function(value) {
                      return (value / 1000);
                    }
                  }
                }
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
            borderColor: '#0D47A1',
            backgroundColor: 'rgba(13, 71, 161, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointStyle: 'circle',
            pointRadius: 4,
            pointBackgroundColor: '#0D47A1'
          }]
        },
        options: {
          responsive: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 12, family: 'Roboto' } } } },
          scales: {
            x: { ticks: { font: { size: 10, family: 'Roboto' } } },
            y: { title: { display: true, text: 'Energija (MWh)', font: { size: 12, family: 'Roboto' } },
                  ticks: {
                    callback: function(value) {
                      return (value / 1000);
                    }
                  }
                }
          }
        }
      });

      doc.image(monthlyChart, 100, doc.y + 20, { width: 350, height: 250 });
      doc.moveDown(3);
      doc.image(weeklyChart, 100, doc.y + 270, { width: 350, height: 250 });
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
