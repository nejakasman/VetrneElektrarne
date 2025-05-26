const calculateAnnualEnergy = (windData, turbineData) => {
  let totalEnergy = 0;
  const weeklyEnergy = new Array(52).fill(0);

  windData.forEach((wind, index) => {
    const windSpeed = wind.wind_speed_100m;//zaenkrat uporabljamo višino 100 metrov
    const turbinePower = turbineData.find(td => Number(td.speed) >= windSpeed)?.power || 0;

    //letna energija
    totalEnergy += Number(turbinePower);

    //tedenska energija
    const weekIndex = Math.floor(index / 7);
    if (weekIndex < 52) {
      weeklyEnergy[weekIndex] += Number(turbinePower);
    }
  });

  return { totalEnergy, weeklyEnergy };
};

module.exports = { calculateAnnualEnergy };
