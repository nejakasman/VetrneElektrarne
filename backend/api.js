const { ipcMain } = require('electron');

// Seznam turbin (in-memory)
let turbines = [];

// CREATE – Dodaj novo turbino
ipcMain.handle('turbine-create', (event, turbine) => {
  turbines.push(turbine);
  return { status: 'success', message: 'Turbina dodana.' };
});

// READ – Vrni vse turbine
ipcMain.handle('turbine-read-all', () => {
  return turbines;
});

// UPDATE – Posodobi obstoječo turbino po imenu
ipcMain.handle('turbine-update', (event, updatedTurbine) => {
  const index = turbines.findIndex(t => t.name === updatedTurbine.name);
  if (index !== -1) {
    turbines[index] = updatedTurbine;
    return { status: 'success', message: 'Turbina posodobljena.' };
  }
  return { status: 'error', message: 'Turbina ni najdena.' };
});

// DELETE – Izbriši turbino po imenu
ipcMain.handle('turbine-delete', (event, name) => {
  const initialLength = turbines.length;
  turbines = turbines.filter(t => t.name !== name);
  if (turbines.length < initialLength) {
    return { status: 'success', message: 'Turbina izbrisana.' };
  }
  return { status: 'error', message: 'Turbina ni najdena.' };
});
