async function fetchWeatherData(latitude, longitude) {
  const params = {
    latitude,
    longitude,
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    hourly: ["wind_speed_10m", "wind_speed_100m"].join(",")
  };

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${params.latitude}&longitude=${params.longitude}&start_date=${params.start_date}&end_date=${params.end_date}&hourly=${params.hourly}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Napaka pri pridobivanju podatkov: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}

document.getElementById("windData").addEventListener("click", async () => {
  const lat = parseFloat(document.getElementById("latitude").value);
  const lon = parseFloat(document.getElementById("longitude").value);
  const resultsElem = document.getElementById("results");
  const button = document.getElementById("windData");

  if (isNaN(lat) || isNaN(lon)) {
    resultsElem.textContent = "Prosim, vnesite veljavne koordinate.";
    return;
  }

  resultsElem.textContent = "Nalaganje podatkov...";
  button.disabled = true;

  try {
    const data = await fetchWeatherData(lat, lon);
    let output = `Prvi čas: ${data.hourly.time[0]}\n`;
    output += `Hitrost vetra na 10m: ${data.hourly.wind_speed_10m[0]} km/h\n`;
    output += `Hitrost vetra na 100m: ${data.hourly.wind_speed_100m[0]} km/h\n`;
    output += `Skupno podatkovnih točk: ${data.hourly.time.length}\n`;
    resultsElem.textContent = output;
  } catch (error) {
    resultsElem.textContent = `Napaka: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
