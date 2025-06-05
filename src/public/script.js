const { ipcRenderer, remote } = require('electron');
const { dialog } = require('@electron/remote');
//Leaflet inicializacija
const map = L.map('map').setView([46.05, 14.5], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap prispevki'
}).addTo(map);

//ikona vetrnice
const windTurbineIcon = L.icon({
  iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAACiUlEQVR4nNWZO2sVQRSAP5OIIj7w1fhGxD8gqGBhpYJGkBRCQFBQURBFxdJCBUsVxcLCNzZCbMREsRAEYzQoEsQHYqr4SrAJNmq4rhw4F8Jl7+ycvXfvznxwmj2zc+e7u7N7ZhaKZS/wHfgG7CdSuoBkUvwDdhIZU4HhGpFEr850ImJ3ikQ1uomIJw6Rx0TCfGDCIVLRNsHT7ZCoxg4i4JKHyDki4KWHyACB0wH89hAZB6YQMKs8JKqxhIDZahDZRMAcMYgEXXudNYicIWCuGERuEDD3DCK9BMxTg8hzAuadQeQjATNqEBkjUDZmVL21MaHnBMNs4KKW54kxZPl7G5hXtsR24ItjoA+AxVqO9DnajQCdZQjM0veApZ5a6tH+KjCzVRLrgM+et45VJAE+AWuLljgM/DXMgT6VEYmHhvP+AIeKEJAtnGs5JnOjcQeY0SyJhcBgCRKJhqw4FzQqsVzfwEnJ8QFYlldiZcajtdUxAqywSswx1k1ZpchYk/p6qy9gL9qMT5h6IVfzqE5WiWPA1yb02+u7cbGnwR96DxwApqX0LccONmHe7fIReZWj44qWI5sn/Vtt+mnhtUaXHkPbbNH3TJ4abdBH5Jehwx+6ayjbQLWcSml/OqXdauCCcQkw7iNyP6MTmbjXdetHNuTqkVaL3cz4ptIJ3AJ+ZoxBxpjJXOA88EZrKlmS3gWOA+uBdp9O6jwwHnme2w5sAE4APcAL/XA0pGOTMbaMoRQRORYdoykiciwqOuo8jSo6F6JhkWOiSi4a1jhEJBcN2xwikouGfQ4RyUXDSYeI5KLhskNEctHQ4xCRXDT0O0QkFw3DDhHJlcpAjnVDo9FfhIjrdikqnvmO7j+Q3vJ1UQWy6QAAAABJRU5ErkJggg==',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

let currentMarker = null;

map.on('click', function (e) {
  const lat = e.latlng.lat.toFixed(6);
  const lon = e.latlng.lng.toFixed(6);

  if (currentMarker) {
    map.removeLayer(currentMarker);
  }

  currentMarker = L.marker([lat, lon], { icon: windTurbineIcon })
    .addTo(map)
    .bindPopup("Izbrana lokacija")
    .openPopup();

  document.getElementById('latitude').value = lat;
  document.getElementById('longitude').value = lon;
});

// Sidebar
document.getElementById("toggleForm").addEventListener("click", () => {
  document.getElementById("sidebar").style.transform = "translateX(0)";
});



document.addEventListener("DOMContentLoaded", () => {
  const { ipcRenderer } = require('electron');
  const turbineDropdown = document.getElementById("turbine-type");
  const compareTurbineDropdown = document.getElementById("compare-turbine-type");
  const resultsElem = document.getElementById("results");
  const resultSidebar = document.getElementById("result-sidebar");
  const toggleBtn = document.getElementById("toggle-result-sidebar");
  const historyList = document.getElementById("history-list");
  const loadHistoryBtn = document.getElementById("load-history-btn");

  let chartInstance = null;
  let firstTurbineData = null;
  let compareTurbineData = null;
  let windDataCache = null;
  let chartType = 'weekly';

  let comparedTurbines = []; // za več turbin za primerjavo


  //dropdown meni - turbine
  async function naloziDropdown() {
    try {
      const turbines = await ipcRenderer.invoke('turbine-read-all');
      turbineDropdown.innerHTML = '';
      compareTurbineDropdown.innerHTML = '<option value="">Izberi turbino</option>';

      turbines.forEach(t => {
        const option = document.createElement("option");
        option.value = t.name;
        option.textContent = t.name;
        turbineDropdown.appendChild(option.cloneNode(true));
        compareTurbineDropdown.appendChild(option);
      });
    } catch (error) {
      console.error("Napaka pri nalaganju turbin za dropdown:", error);
    }
  }

  naloziDropdown();

  //gumb za preklop med grafi
  const toggleButtonPlugin = {
    id: 'toggleButton',
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const isWeekly = chartType === 'weekly';
      const buttonText = isWeekly ? 'Pojdi na mesečni graf' : 'Pojdi na tedenski graf';
      const buttonWidth = 150;
      const buttonHeight = 20;
      const padding = 8;

      const x = chart.width - buttonWidth - padding;
      const y = padding;

      ctx.fillStyle = '#4BC0C0';
      ctx.fillRect(x, y, buttonWidth, buttonHeight);

      ctx.strokeStyle = '#2A6A6A';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, buttonWidth, buttonHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(buttonText, x + buttonWidth / 2, y + buttonHeight / 2);

      chart.toggleButton = { x, y, width: buttonWidth, height: buttonHeight };
    }
  };

  Chart.register(toggleButtonPlugin);

  //ustvarjanje ali posodabljanje grafa
  function updateChart(energyData1, turbineName1, energyData2 = null, turbineName2 = null) {
  const ctx = document.getElementById('energy-chart').getContext('2d');
  const isCollapsed = resultSidebar.classList.contains("collapsed");

  if (chartInstance) {
    chartInstance.destroy();
  }

  const isWeekly = chartType === 'weekly';
  const labels = isWeekly
    ? Array.from({ length: 52 }, (_, i) => `Teden ${i + 1}`)
    : ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

  const datasets = [
    {
      label: `${isWeekly ? 'Tedenska' : 'Mesečna'} proizvodnja (${turbineName1}) (kWh)`,
      data: energyData1,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderWidth: 2,
      tension: 0.3,
      fill: false,
    },
    ...comparedTurbines.map((turbine, index) => {
      const hue = (index * 60) % 360;
      const isYellow = hue === 60;
      const adjustedHue = isYellow ? 50 : hue;
      const adjustedLightness = isYellow ? 45 : 50;

      const color = `hsl(${adjustedHue}, 100%, ${adjustedLightness}%)`;
      const bgColor = `hsla(${adjustedHue}, 100%, ${adjustedLightness}%, 0.2)`;

      return {
        label: `${chartType === 'weekly' ? 'Tedenska' : 'Mesečna'} proizvodnja (${turbine.name}) (kWh)`,
        data: chartType === 'weekly' ? turbine.weeklyEnergy : turbine.monthlyEnergy,
        borderColor: color,
        backgroundColor: bgColor,
        borderWidth: 2,
        pointRadius: isCollapsed ? 0 : 2,
        pointHoverRadius: isCollapsed ? 0 : 4,
        tension: 0.3
  };
})
  ];

  if (energyData2 && turbineName2) {
    datasets.push({
      label: `${isWeekly ? 'Tedenska' : 'Mesečna'} proizvodnja (${turbineName2}) (kWh)`,
      data: energyData2,
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
      borderWidth: 2,
      tension: 0.3,
      fill: false,
    });
  }


  chartInstance = new Chart(ctx, {
    type: isWeekly ? 'line' : 'bar',
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        toggleButton: !isCollapsed,
      },
      scales: {
        x: {
          title: { display: true, text: isWeekly ? 'Tedni' : 'Meseci' },
        },
        y: {
          title: { display: true, text: 'Energija (kWh)' },
        },
      },
    },
  });

  ctx.canvas.removeEventListener('click', handleChartClick);
  ctx.canvas.addEventListener('click', handleChartClick);

  function handleChartClick(event) {
    const rect = ctx.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const button = chartInstance.toggleButton;

    if (button && x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height) {
      chartType = chartType === 'weekly' ? 'monthly' : 'weekly';
      const energyData1 = chartType === 'weekly' ? firstTurbineData.weeklyEnergy : firstTurbineData.monthlyEnergy;
      let energyData2 = null;
      let turbineName2 = null;
      if (compareTurbineData) {
        energyData2 = chartType === 'weekly' ? compareTurbineData.weeklyEnergy : compareTurbineData.monthlyEnergy;
        turbineName2 = compareTurbineData.name;
      }
      updateChart(energyData1, firstTurbineData.name, energyData2, turbineName2);
    }
  }
}


  //izračun prve turbine
  document.getElementById("calculate-energy").addEventListener("click", async (event) => {
    event.preventDefault();
    const comparisonSection = document.getElementById('comparison-section');
    comparisonSection.style.display = 'block';

    const lat = parseFloat(document.getElementById("latitude").value);
    const lon = parseFloat(document.getElementById("longitude").value);
    const selectedTurbineName = turbineDropdown.value;

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      resultsElem.textContent = "Prosim, vnesite veljavne koordinate.";
      return;
    }

    if (!selectedTurbineName) {
      resultsElem.textContent = "Prosim, izberite turbino.";
      return;
    }

    try {
      const windResult = await ipcRenderer.invoke("weather-fetch", { latitude: lat, longitude: lon });

      if (windResult.status === "success" && windResult.data.length > 0) {
        windDataCache = windResult.data;
        const energyResult = await ipcRenderer.invoke("calculate-annual-energy", {
          windData: windResult.data,
          turbineName: selectedTurbineName,
        });

        if (energyResult.status === "success") {
          firstTurbineData = {
            name: selectedTurbineName,
            totalEnergy: energyResult.totalEnergy,
            weeklyEnergy: energyResult.weeklyEnergy,
            monthlyEnergy: energyResult.monthlyEnergy
          };

          // Posodobitev prikaza
          document.getElementById("result-turbine-name").textContent = selectedTurbineName;
          document.getElementById("result-annual-energy").textContent = energyResult.totalEnergy.toFixed(2);

          // Odstranitev nepotrebnih elementov ali preverjanje njihovega obstoja
          const compareNameElem = document.getElementById("result-compare-turbine-name");
          const compareEnergyElem = document.getElementById("result-compare-annual-energy");

          if (compareNameElem && compareEnergyElem) {
            compareNameElem.textContent = "Ni izbrano";
            compareEnergyElem.textContent = "Ni izračunano";
          }

          document.getElementById("result-sidebar").style.display = "block";
          resultSidebar.classList.remove("collapsed");
          resultSidebar.classList.add("expanded");
          toggleBtn.textContent = "⮞ ⮜";

          compareTurbineData = null;

          const energyData = chartType === 'weekly' ? energyResult.weeklyEnergy : energyResult.monthlyEnergy;
          updateChart(energyData, selectedTurbineName);

          await ipcRenderer.invoke("save-calculation-history", {
            latitude: lat,
            longitude: lon,
            turbineName: selectedTurbineName,
            annualEnergy: energyResult.totalEnergy,
            weeklyEnergy: energyResult.weeklyEnergy,
            monthlyEnergy: energyResult.monthlyEnergy
          });
        } else {
          resultsElem.textContent = `Napaka pri izračunu energije: ${energyResult.message}`;
        }
      } else {
        resultsElem.textContent = "Ni vetrovnih podatkov za to lokacijo.";
      }
    } catch (error) {
      console.error("Napaka:", error);
      resultsElem.textContent = `Napaka: ${error.message}`;
    }
});

    //primerjava z drugimi turbinami
  document.getElementById("compare-energy").addEventListener("click", async () => {
  const compareTurbineName = document.getElementById("compare-turbine-type").value;

  if (!compareTurbineName) {
    resultsElem.textContent = "Prosim, izberite turbino za primerjavo.";
    return;
  }

  if (!windDataCache) {
    resultsElem.textContent = "Ni vetrovnih podatkov za primerjavo.";
    return;
  }

  if (comparedTurbines.some(t => t.name === compareTurbineName)) {
    resultsElem.textContent = "Ta turbina je že na grafu.";
    return;
  }

  try {
    const energyResult = await ipcRenderer.invoke("calculate-annual-energy", {
      windData: windDataCache,
      turbineName: compareTurbineName,
    });

    if (energyResult.status === "success") {
      comparedTurbines.push({
        name: compareTurbineName,
        weeklyEnergy: energyResult.weeklyEnergy,
        monthlyEnergy: energyResult.monthlyEnergy
      });

      // Posodobi prikaz
      const energyData = chartType === 'weekly' ? firstTurbineData.weeklyEnergy : firstTurbineData.monthlyEnergy;
      updateChart(energyData, firstTurbineData.name);

      renderComparedTurbinesList();
    } else {
      resultsElem.textContent = `Napaka pri izračunu energije za primerjavo: ${energyResult.message}`;
    }
  } catch (error) {
    console.error("Napaka pri primerjavi:", error);
    resultsElem.textContent = `Napaka: ${error.message}`;
  }
});

  toggleBtn.addEventListener("click", () => {
    if (resultSidebar.classList.contains("expanded")) {
      resultSidebar.classList.remove("expanded");
      resultSidebar.classList.add("collapsed");
      toggleBtn.textContent = "⮜ ⮞";
    } else {
      resultSidebar.classList.remove("collapsed");
      resultSidebar.classList.add("expanded");
      toggleBtn.textContent = "⮞ ⮜";
    }
    if (firstTurbineData) {
      const energyData1 = chartType === 'weekly' ? firstTurbineData.weeklyEnergy : firstTurbineData.monthlyEnergy;
      let energyData2 = null;
      let turbineName2 = null;
      if (compareTurbineData) {
        energyData2 = chartType === 'weekly' ? compareTurbineData.weeklyEnergy : compareTurbineData.monthlyEnergy;
        turbineName2 = compareTurbineData.name;
      }
      updateChart(energyData1, firstTurbineData.name, energyData2, turbineName2);
    }
  });

// izris seznama primerjanih turbin
function renderComparedTurbinesList() {
  const listContainer = document.getElementById("compared-turbines-list");
  listContainer.innerHTML = "";

  if (comparedTurbines.length === 0) {
    listContainer.innerHTML = '<div class="text-muted">Ni izbrano</div>';
    return;
  }

  comparedTurbines.forEach((turbine, index) => {
    const container = document.createElement("div");
    container.className = "d-flex justify-content-between align-items-center mb-2";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${turbine.name}</strong>: ${turbine.weeklyEnergy.reduce((a, b) => a + b, 0).toFixed(2)} kWh`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-sm btn-danger";
    removeBtn.textContent = "Odstrani";
    removeBtn.addEventListener("click", () => {
      comparedTurbines.splice(index, 1);
      const energyData = chartType === 'weekly' ? firstTurbineData.weeklyEnergy : firstTurbineData.monthlyEnergy;
      updateChart(energyData, firstTurbineData.name);
      renderComparedTurbinesList();
    });

    container.appendChild(info);
    container.appendChild(removeBtn);
    listContainer.appendChild(container);
  });
}

// fetch + populate dropdown z zgodovino
async function loadCalculationHistory() {
const history = await ipcRenderer.invoke('get-calculation-history');
historyList.innerHTML = '<option value="">Izberi prejšnji izračun...</option>';
history.forEach(item => {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = `${item.turbine_name} @ (${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}) - ${new Date(item.datum).toLocaleString()}`;
  option.dataset.data = JSON.stringify(item);
  historyList.appendChild(option);
});
}

loadHistoryBtn.addEventListener("click", () => {
  const selectedId = historyList.value;
  if (!selectedId) return;

  const selectedOption = historyList.options[historyList.selectedIndex];
  const item = JSON.parse(selectedOption.dataset.data);

  // posodobitev grafa
  updateChart(JSON.parse(item.tedenska_energija), item.turbine_name);

  // posodobitev v sidebaru
  document.getElementById("result-turbine-name").textContent = item.turbine_name;
  document.getElementById("result-annual-energy").textContent = Number(item.letna_energija).toFixed(2);

  // Pinpoint na zameljevidu
  if (window.currentMarker) {
    map.removeLayer(window.currentMarker);
  }
  window.currentMarker = L.marker([item.latitude, item.longitude], { icon: windTurbineIcon }).addTo(map).bindPopup("Prejšnja izračunana lokacija").openPopup();
  map.setView([item.latitude, item.longitude], 10);
  // opcijski prikaz rezultatov v side-baru
  document.getElementById("result-sidebar").style.display = "block";
  resultSidebar.classList.remove("collapsed");
  resultSidebar.classList.add("expanded");
  toggleBtn.textContent = "⮞ ⮜";
})

loadCalculationHistory();

// pridobivanje podatkov za PDF
document.getElementById('generate-pdf-btn').addEventListener('click', async () => {
  // dialog za shranjevanje PDF
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Shrani PDF poročilo',
    defaultPath: 'porocilo.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) return; // user je preklical

  const location = {
    latitude: document.getElementById('latitude').value,
    longitude: document.getElementById('longitude').value
  };

  const turbines = [firstTurbineData]; 
  const windData = windDataCache;
  const energyResults = [firstTurbineData]; 
  if (compareTurbineData) {
  turbines.push(compareTurbineData);
  energyResults.push(compareTurbineData);
}

  const result = await ipcRenderer.invoke('generate-pdf-report', {
    location,
    turbines,
    windData,
    energyResults,
    filePath
  });

  if (result.status === 'success') {
    alert('PDF poročilo je bilo ustvarjeno: ' + result.filePath);
    require('electron').shell.openPath(result.filePath);
  } else {
    alert('Napaka pri generiranju PDF: ' + result.message);
  }
});
});

