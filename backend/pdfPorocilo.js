const { ipcMain } = require('electron');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fetch = require('node-fetch');


async function getLocationName(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VetrneElektrarneApp' } });
  const data = await res.json();
  return data.display_name || '';
}

ipcMain.handle('generate-pdf-report', async (event, { location, turbines, windData, energyResults, filePath }) => {
  try {
    const savePath = filePath || path.join(__dirname, '../pdf-porocilo.pdf');
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(savePath);
    doc.pipe(stream);

    const fontPath = path.join(__dirname, '../backend/fonts/Fluent_Calibri.ttf');
    doc.font(fontPath);

    // pridobi naslov/mesto na podlagi koordinat

    const locationName = await getLocationName(location.latitude, location.longitude);

    // prva stran: naslov, opis, lokacija, naslov
    doc.addPage();
    doc.fontSize(22).text('Poročilo o potencialu vetrne elektrarne', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('To poročilo prikazuje izračunano letno proizvodnjo električne energije za izbrane turbine na določeni lokaciji.');
    doc.moveDown();
    doc.fontSize(12).text(`Lokacija: (${location.latitude}, ${location.longitude})`);
    doc.moveDown();
    doc.fontSize(12).text(`Naslov/ime lokacije: ${locationName}`);
    doc.moveDown();
    doc.text(`Datum: ${new Date().toLocaleString()}`);
    doc.moveDown();
   

    // druga stran: turbine in graf karakteristik
    doc.addPage();
    doc.fontSize(16).text('Izbrane turbine in njihove karakteristike', { align: 'left' });
    for (const turbine of turbines) {
      doc.moveDown();
      doc.fontSize(14).text(`Turbina: ${turbine.name}`);
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 600, height: 300 });
const curveImg = await chartJSNodeCanvas.renderToBuffer({
  type: 'line',
  data: {
    labels: turbine.speeds,
    datasets: [{
      label: `Energijska vrednost (${turbine.name})`,
      data: turbine.powers,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: true,
    }]
  },
  options: {
    responsive: false,
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      x: { title: { display: true, text: 'Hitrost vetra (m/s)' }},
      y: { title: { display: true, text: 'Energijska vrednost (kW)' }},
    }
  }
});
doc.image(curveImg, { width: 400 });

    // tretja stran: podatki o vetru + grafi
    doc.addPage();
    doc.fontSize(16).text('Podatki o vetru za izbrano lokacijo', { align: 'left' });
    doc.moveDown();
    doc.fontSize(12).text(`Povprečna hitrost vetra (100m): ${(
      windData.reduce((sum, d) => sum + Number(d.wind_speed_100m), 0) / windData.length
    ).toFixed(2)} m/s`);
    doc.moveDown();
  
  for (const result of energyResults) {
  doc.moveDown();
  doc.fontSize(14).text(`Letna proizvodnja za ${result.name}: ${result.totalEnergy.toFixed(2)} kWh`);
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 600, height: 300 });
  const outputImg = await chartJSNodeCanvas.renderToBuffer({
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
      datasets: [{
        label: `Mesečna proizvodnja (${result.name})`,
        data: result.monthlyEnergy,
        borderColor: 'rgba(255,99,132,1)',
        backgroundColor: 'rgba(255,99,132,0.2)',
        fill: true
      }]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { position: 'top' },
      },
      scales: {
        x: { title: { display: true, text: 'Mesec' }},
        y: { title: { display: true, text: 'Energija (kWh)' }},
      }
    }
  });
  doc.image(outputImg, { width: 400 });
}}

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