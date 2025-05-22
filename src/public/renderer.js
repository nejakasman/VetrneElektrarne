const { ipcRenderer } = require('electron');

const testTurbina = {
  name: 'SG 6.6-170 Rev. 2, AM-1',
  speeds: ['3.0', '3.5', '4.0'],
  powers: ['46', '164', '325']
};

// DODAJ
ipcRenderer.invoke('turbine-create', testTurbina).then(response => {
  console.log('Dodano:', response);

  // PREBERI VSE
  ipcRenderer.invoke('turbine-read-all').then(turbines => {
    console.log('Turbine:', turbines);

    // POSODOBI (spremenimo power)
    const novaTurbina = {
      ...testTurbina,
      powers: ['999', '888', '777']
    };

    ipcRenderer.invoke('turbine-update', novaTurbina).then(updateRes => {
      console.log('Posodobljeno:', updateRes);

      // IZBRIŠI
      ipcRenderer.invoke('turbine-delete', testTurbina.name).then(delRes => {
        console.log('Izbrisano:', delRes);
      });
    });
  });
});
