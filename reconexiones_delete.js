const axios = require('axios');

const API_URL = 'https://backend-apiemail.up.railway.app/api/reconexiones';

(async () => {
  try {
    const resp = await axios.delete(API_URL);
    console.log('Todas las reconexiones eliminadas:', resp.data);
  } catch (err) {
    console.error('Error al eliminar todas las reconexiones:', err.response ? err.response.data : err.message);
  }
})();