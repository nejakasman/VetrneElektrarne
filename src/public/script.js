const { ipcRenderer } = require('electron');

//Leaflet inicializacija
const map = L.map('map').setView([46.05, 14.5], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap prispevki'
}).addTo(map);

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
    L.marker([lat, lon]).addTo(map).bindPopup(name).openPopup();
  }
});

//pridobivanje vetrovnih podatkov
document.getElementById("windData").addEventListener("click", async () => {
  const lat = parseFloat(document.getElementById("latitude").value);
  const lon = parseFloat(document.getElementById("longitude").value);
  const resultsElem = document.getElementById("results");
  const button = document.getElementById("windData");

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    resultsElem.textContent = "Prosim, vnesite veljavne koordinate.";
    return;
  }

  resultsElem.textContent = "Nalaganje podatkov...";
  button.disabled = true;

  try {
    const result = await ipcRenderer.invoke('weather-fetch', { latitude: lat, longitude: lon });

    if (result.status === 'success' && result.data.length > 0) {
      resultsElem.textContent = result.data
        .map(
          m =>
            `Čas: ${m.datetime}, Hitrost vetra na 10m: ${m.wind_speed_10m} km/h, Hitrost vetra na 100m: ${m.wind_speed_100m} km/h`
        )
        .join("\n");
    } else {
      resultsElem.textContent = "Ni podatkov.";
    }
  } catch (error) {
    console.error('Error:', error);
    resultsElem.textContent = `Napaka: ${error.message}`;
  }

  button.disabled = false;
});
