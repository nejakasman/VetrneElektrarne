@@ -0,0 +1,37 @@
// renderer.js
const { findOrFetchWeatherData } = require('./vnosVBazo');

document.getElementById("windData").addEventListener("click", async () => {
  const lat = parseFloat(document.getElementById("latitude").value);
  const lon = parseFloat(document.getElementById("longitude").value);
  const resultsElem = document.getElementById("results");
  const button = document.getElementById("windData");

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    resultsElem.textContent = "Prosim, vnesite veljavne koordinate (latitude: -90 do 90, longitude: -180 do 180).";
    return;
  }

  resultsElem.textContent = "Nalaganje podatkov...";
  button.disabled = true;

  try {
    const measurements = await findOrFetchWeatherData(lat, lon);

    if (measurements.length > 0) {
      resultsElem.textContent = measurements
        .map(
          m =>
            `Čas: ${m.datetime}, Hitrost vetra na 10m: ${m.wind_speed_10m} km/h, Hitrost vetra na 100m: ${m.wind_speed_100m} km/h`
        )
        .join("\n");
    } else {
      resultsElem.textContent = "Ni podatkov.";
    }
  } catch (error) {
    console.error('Error in button click handler:', error);
    resultsElem.textContent = `Napaka: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
