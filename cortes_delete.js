const axios = require('axios');

const API_URL = 'https://backend-apiemail.up.railway.app/api/cortes';

(async () => {
  try {
    const resp = await axios.delete(API_URL);
    console.log('Todos los cortes eliminados:', resp.data);
  } catch (err) {
    console.error('Error al eliminar todos los cortes:', err.response ? err.response.data : err.message);
  }
})();