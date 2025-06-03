const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function getTurbinePower(windSpeed, turbineData) {
  const { speeds, powers } = turbineData;

  //preveri če je hitrost med najnižjo in najvišjo vrednostjo
  const minSpeed = speeds[0];
  const maxSpeed = speeds[speeds.length - 1];

  if (windSpeed < minSpeed || windSpeed > maxSpeed) {
    return 0;
  }

  let closestIndex = 0;
  let smallestDifference = Math.abs(windSpeed - speeds[0]);

  for (let i = 1; i < speeds.length; i++) {
    const difference = Math.abs(windSpeed - speeds[i]);
    if (difference < smallestDifference) {
      closestIndex = i;
      smallestDifference = difference;
    }
  }

  return powers[closestIndex];
}


const calculateAnnualEnergy = (windData, turbineData) => {
  let totalEnergy = 0;
  const weeklyEnergy = new Array(52).fill(0);
  const monthlyEnergy = new Array(12).fill(0);

  let currentMonth = 0;
  let dayOfMonth = 0;

  for (let i = 0; i < windData.length; i++) {
    const windSpeed = Number(windData[i].wind_speed_100m);
    const power = getTurbinePower(windSpeed, turbineData);

    // console.log(`Hour ${i + 1}: Wind Speed = ${windSpeed} m/s, Turbine Power = ${power} kW`);

    totalEnergy += power;

    //teden
    const weekIndex = Math.floor(i / (24 * 7));
    if (weekIndex < 52) {
      weeklyEnergy[weekIndex] += power;
    }

    //mesec
    monthlyEnergy[currentMonth] += power;

    if ((i + 1) % 24 === 0) {
      dayOfMonth++;
      if (dayOfMonth >= daysInMonth[currentMonth]) {
        currentMonth++;
        dayOfMonth = 0;
      }
    }
  }

  return { totalEnergy, weeklyEnergy, monthlyEnergy };
};

module.exports = { calculateAnnualEnergy };
