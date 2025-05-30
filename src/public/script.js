const { ipcRenderer } = require('electron');

//Leaflet inicializacija
const map = L.map('map').setView([46.05, 14.5], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap prispevki'
}).addTo(map);

const redIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

let currentMarker = null;
map.on('click', function(e) {
  const lat = e.latlng.lat.toFixed(6);
  const lon = e.latlng.lng.toFixed(6);

  if (currentMarker) {
    map.removeLayer(currentMarker);
  }
  currentMarker = L.marker([lat, lon], { icon: redIcon }).addTo(map).bindPopup("Izbrana lokacija").openPopup();

  document.getElementById('latitude').value = lat;
  document.getElementById('longitude').value = lon;
});



// Sidebar
document.getElementById("toggleForm").addEventListener("click", () => {
  document.getElementById("sidebar").style.transform = "translateX(0)";
});



//obrazec za lokacijo
document.getElementById("location-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("location-name").value;
  const lat = parseFloat(document.getElementById("latitude").value);
  const lon = parseFloat(document.getElementById("longitude").value);

  if (name && !isNaN(lat) && !isNaN(lon)) {
    if (currentMarker) {
      map.removeLayer(currentMarker);
    }
    currentMarker = L.marker([lat, lon], { icon: redIcon }).addTo(map).bindPopup(name).openPopup();
  }
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
  let windDataCache = null;

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

  //ustvarjanje ali posodabljanje grafa
  function updateChart(weeklyEnergy1, turbineName1, weeklyEnergy2 = null, turbineName2 = null) {
    const ctx = document.getElementById('energy-chart').getContext('2d');
    const isCollapsed = resultSidebar.classList.contains("collapsed");

    if (chartInstance) {
      chartInstance.destroy();
    }

    const datasets = [
      {
        label: `Tedenska proizvodnja (${turbineName1}) (kWh)`,
        data: weeklyEnergy1,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderWidth: 2,
        pointRadius: isCollapsed ? 0 : 2,
        pointHoverRadius: isCollapsed ? 0 : 4,
        tension: 0.3
      }
    ];

    if (weeklyEnergy2 && turbineName2) {
      datasets.push({
        label: `Tedenska proizvodnja (${turbineName2}) (kWh)`,
        data: weeklyEnergy2,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderWidth: 2,
        pointRadius: isCollapsed ? 0 : 2,
        pointHoverRadius: isCollapsed ? 0 : 4,
        tension: 0.3
      });
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({ length: 52 }, (_, i) => `Teden ${i + 1}`),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          x: {
            title: { display: true, text: 'Tedni' },
            ticks: {
              maxTicksLimit: isCollapsed ? 5 : 12
            }
          },
          y: {
            title: { display: true, text: 'Energija (kWh)' },
            ticks: {
              stepSize: 10000,
              callback: function(value) {
                return value.toLocaleString();
              }
            }
          }
        }
      }
    });
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
        windDataCache = windResult.data; // Shranimo vetrovne podatke
        const energyResult = await ipcRenderer.invoke("calculate-annual-energy", {
          windData: windResult.data,
          turbineName: selectedTurbineName,
        });

        if (energyResult.status === "success") {
          firstTurbineData = {
            name: selectedTurbineName,
            totalEnergy: energyResult.totalEnergy,
            weeklyEnergy: energyResult.weeklyEnergy
          };

          document.getElementById("result-turbine-name").textContent = selectedTurbineName;
          document.getElementById("result-annual-energy").textContent = energyResult.totalEnergy.toFixed(2);
          document.getElementById("result-compare-turbine-name").textContent = "Ni izbrano";
          document.getElementById("result-compare-annual-energy").textContent = "Ni izračunano";
          document.getElementById("result-sidebar").style.display = "block";
          resultSidebar.classList.remove("collapsed");
          resultSidebar.classList.add("expanded");
          toggleBtn.textContent = "⮞ ⮜";

          //graf za prvo turbino
          updateChart(energyResult.weeklyEnergy, selectedTurbineName);
            await ipcRenderer.invoke("save-calculation-history", {
              latitude: lat,
              longitude: lon,
              turbineName: selectedTurbineName,
              annualEnergy: energyResult.totalEnergy,
              weeklyEnergy: energyResult.weeklyEnergy
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


  //primerjava z drugo turbino
  document.getElementById("compare-energy").addEventListener("click", async () => {
    const compareTurbineName = compareTurbineDropdown.value;

    if (!compareTurbineName) {
      resultsElem.textContent = "Prosim, izberite turbino za primerjavo.";
      return;
    }

    if (!windDataCache) {
      resultsElem.textContent = "Ni vetrovnih podatkov za primerjavo.";
      return;
    }

    try {
      const energyResult = await ipcRenderer.invoke("calculate-annual-energy", {
        windData: windDataCache,
        turbineName: compareTurbineName,
      });

      if (energyResult.status === "success") {
        document.getElementById("result-compare-turbine-name").textContent = compareTurbineName;
        document.getElementById("result-compare-annual-energy").textContent = energyResult.totalEnergy.toFixed(2);

        updateChart(firstTurbineData.weeklyEnergy, firstTurbineData.name, energyResult.weeklyEnergy, compareTurbineName);
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
      const compareTurbineName = document.getElementById("result-compare-turbine-name").textContent;
      const weeklyEnergy2 = compareTurbineName !== "Ni izbrano" ? chartInstance?.data.datasets[1]?.data : null;
      const turbineName2 = compareTurbineName !== "Ni izbrano" ? compareTurbineName : null;
      updateChart(firstTurbineData.weeklyEnergy, firstTurbineData.name, weeklyEnergy2, turbineName2);
    }
  });

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
  window.currentMarker = L.marker([item.latitude, item.longitude], { icon: redIcon }).addTo(map).bindPopup("Prejšnja izračunana lokacija").openPopup();
  map.setView([item.latitude, item.longitude], 10);
  // opcijski prikaz rezultatov v side-baru
  document.getElementById("result-sidebar").style.display = "block";
  resultSidebar.classList.remove("collapsed");
  resultSidebar.classList.add("expanded");
  toggleBtn.textContent = "⮞ ⮜";
});


loadCalculationHistory();

});
