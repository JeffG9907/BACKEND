const xlsx = require('xlsx');
const axios = require('axios');

const PATH_EXCEL = './reconexiones.xlsx';
const API_URL = 'https://backend-apiemail.up.railway.app/api/reconexiones';

// Convierte fecha Excel (número o string) a formato YYYY-MM-DD
function normalizaFecha(fechaCell) {
  if (!fechaCell) return null;
  if (typeof fechaCell === 'string') {
    const partes = fechaCell.split('/');
    if (partes.length === 3) {
      const anio = partes[2].length === 2 ? '20' + partes[2] : partes[2];
      return `${anio}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
    return fechaCell;
  }
  if (typeof fechaCell === 'number') {
    const excelBaseDate = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const fechaDate = new Date(excelBaseDate.getTime() + fechaCell * msPerDay);
    const yyyy = fechaDate.getUTCFullYear();
    const mm = String(fechaDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(fechaDate.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// Leer archivo Excel
const workbook = xlsx.readFile(PATH_EXCEL);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

(async () => {
  for (const row of rows) {
    const id_cuenta = row.ID_CUENTA ?? row.CUENTA ?? null;
    const id_medidor = row.ID_MEDIDOR ?? row.MEDIDOR ?? null;
    const fecha = normalizaFecha(row.FECHA ?? null);

    if (!id_cuenta || !id_medidor || !fecha) {
      console.error('Fila omitida: datos faltantes', { id_cuenta, id_medidor, fecha });
      continue;
    }

    // Verificar existencia (Consulta por cuenta, filtrar en frontend por medidor y fecha)
    let existe = false;
    try {
      const consulta = await axios.get(`${API_URL}?fecha=${fecha}`);
      existe = (consulta.data || []).some(
        recon =>
          String(recon.id_cuenta) === String(id_cuenta) &&
          String(recon.id_medidor) === String(id_medidor) &&
          String(recon.fecha).slice(0,10) === String(fecha)
      );
    } catch (err) {
      console.error(
        `Error consultando duplicados para cuenta ${id_cuenta}:`,
        err.response ? err.response.data : err.message
      );
      continue;
    }

    if (existe) {
      console.log(
        `Ya existe reconexión para cuenta ${id_cuenta}, medidor ${id_medidor}, fecha ${fecha}. No se inserta.`
      );
      continue;
    }

    // Insertar reconexión
    const body = { id_cuenta, id_medidor, fecha };
    try {
      const resp = await axios.post(API_URL, body);
      console.log(`Insertado reconexión de cuenta ${id_cuenta}:`, resp.data);
    } catch (err) {
      console.error(
        `Error al insertar cuenta ${id_cuenta}:`,
        err.response ? err.response.data : err.message
      );
    }
  }
  console.log('Carga masiva finalizada.');
})();