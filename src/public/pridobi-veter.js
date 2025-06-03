async function fetchWeatherData(latitude, longitude) {
  const params = {
    latitude,
    longitude,
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    hourly: ["wind_speed_10m", "wind_speed_100m"].join(","),
    wind_speed_unit: "ms"
  };

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${params.latitude}&longitude=${params.longitude}&start_date=${params.start_date}&end_date=${params.end_date}&hourly=${params.hourly}&wind_speed_unit=${params.wind_speed_unit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Napaka pri pridobivanju podatkov: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in fetchWeatherData:', error);
    throw error;
  }
}

module.exports = { fetchWeatherData };
