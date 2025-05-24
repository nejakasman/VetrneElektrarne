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
  const resultsElem = document.getElementById("results");

  //dropdown meni - turbine
  async function naloziDropdown() {
    try {
      const turbines = await ipcRenderer.invoke('turbine-read-all');
      turbineDropdown.innerHTML = '';

      turbines.forEach(t => {
        const option = document.createElement("option");
        option.value = t.name;
        option.textContent = t.name;
        turbineDropdown.appendChild(option);
      });
    } catch (error) {
      console.error("Napaka pri nalaganju turbin za dropdown:", error);
    }
  }

  naloziDropdown();

  document.getElementById("calculate-energy").addEventListener("click", async (event) => {
    event.preventDefault();

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

    resultsElem.textContent = "Nalaganje podatkov...";

    try {
      const windResult = await ipcRenderer.invoke('weather-fetch', { latitude: lat, longitude: lon });

      const turbineData = await ipcRenderer.invoke('turbine-get-speeds', { turbineName: selectedTurbineName });

      if (windResult.status === 'success' && windResult.data.length > 0 && turbineData && turbineData.length > 0) {
        const windText = windResult.data
          .map(m =>
            `Čas: ${m.datetime}, Hitrost vetra na 10m: ${m.wind_speed_10m} km/h, Hitrost vetra na 100m: ${m.wind_speed_100m} km/h`
          )
          .join("\n");

        const turbineText = turbineData
          .map(td => `Hitrost: ${td.speed} m/s, Moč: ${td.power} W`)
          .join("\n");

        resultsElem.textContent = `Izbrana turbina: ${selectedTurbineName}\n\nPodatki o turbini:\n${turbineText}\n\nVetrovni podatki:\n${windText}`;
      } else if (windResult.status !== 'success' || windResult.data.length === 0) {
        resultsElem.textContent = "Ni vetrovnih podatkov za to lokacijo.";
      } else {
        resultsElem.textContent = "Ni podatkov o izbrani turbini.";
      }

    } catch (error) {
      console.error('Napaka:', error);
      resultsElem.textContent = `Napaka: ${error.message}`;
    }
  });
});
