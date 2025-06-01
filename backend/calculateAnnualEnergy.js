const calculateAnnualEnergy = (windData, turbineData) => {
  let totalEnergy = 0;
  const weeklyEnergy = new Array(52).fill(0);
  const dailyEnergy = []; // shrani total energy za vsak dan

  // pretvori podatke za 24ur v 1 dan
  for (let i = 0; i < windData.length; i += 24) {
    let dailyTotal = 0;

    for (let h = 0; h < 24 && i + h < windData.length; h++) {
      const windSpeed = windData[i + h].wind_speed_100m;

      const turbinePower = turbineData.find(td => Number(td.speed) >= windSpeed)?.power || 0;
      dailyTotal += Number(turbinePower);
    }
    dailyEnergy.push(dailyTotal);
    totalEnergy += dailyTotal;
  }

  // sešteje dni po tednih v letu
  dailyEnergy.forEach((dailyValue, index) => {
    const weekIndex = Math.floor(index / 7);
    if (weekIndex < 52) {
      weeklyEnergy[weekIndex] += dailyValue;
    }
  });

  //mesečni izračun
  const calculateMonthlyEnergy = (dailyEnergy) => {
    const monthlyEnergy = new Array(12).fill(0);
    dailyEnergy.forEach((energy, index) => {
      const month = Math.floor(index / (365 / 12));
      if (month < 12) monthlyEnergy[month] += energy;
    });
    return monthlyEnergy;
  };

  const monthlyEnergy = calculateMonthlyEnergy(dailyEnergy);

  return { totalEnergy, weeklyEnergy, monthlyEnergy };
};

module.exports = { calculateAnnualEnergy };
