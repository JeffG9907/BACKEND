const axios = require('axios');

// El número de cuenta que quieres eliminar
const cuentaAEliminar = '50210';

// URL de tu backend para reconexiones
const API_URL = `https://backend-apiemail.up.railway.app/api/reconexiones/cuenta/${cuentaAEliminar}`;

(async () => {
  try {
    const resp = await axios.delete(API_URL);
    console.log(`Eliminadas reconexiones de cuenta ${cuentaAEliminar}:`, resp.data);
  } catch (err) {
    console.error(
      `Error al eliminar reconexiones de cuenta ${cuentaAEliminar}:`,
      err.response ? err.response.data : err.message
    );
  }
})();