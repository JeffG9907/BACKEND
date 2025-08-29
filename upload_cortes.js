const xlsx = require('xlsx');
const axios = require('axios');

// Cambia el path si tu archivo está en otra ubicación
const workbook = xlsx.readFile('./cortes.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

// URL de tu backend
const API_URL = 'https://backend-apiemail.up.railway.app/api/cortes';

// Convierte fecha Excel (número o string) a formato YYYY-MM-DD
function normalizaFecha(fechaCell) {
  if (!fechaCell) return null;

  // Si viene como string tipo '29/7/2025'
  if (typeof fechaCell === 'string') {
    const partes = fechaCell.split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
    return fechaCell;
  }

  // Si viene como número (serial Excel)
  if (typeof fechaCell === 'number') {
    // Excel base date is 1899-12-30
    const excelBaseDate = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const fechaDate = new Date(excelBaseDate.getTime() + fechaCell * msPerDay);

    // Formato YYYY-MM-DD
    const yyyy = fechaDate.getUTCFullYear();
    const mm = String(fechaDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(fechaDate.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

(async () => {
  for (const row of rows) {
    const cuenta = row.ID_CUENTA ?? null;
    const medidor = row.ID_MEDIDOR ?? null;
    const fecha = normalizaFecha(row.FECHA ?? null);
    const localizacion = row.LOCALIZACION ?? null;
    const imagen = row.IMAGEN ?? null;
    const herramienta = row.HERRAMIENTA ?? null;

    // Si falta cuenta, medidor o fecha, salta la fila
    if (!cuenta || !medidor || !fecha) {
      console.error(
        `Fila saltada por datos faltantes (cuenta, medidor, fecha):`,
        { cuenta, medidor, fecha }
      );
      continue;
    }

    // Verifica si ya existe
    let existe = false;
    try {
      const consulta = await axios.get(`${API_URL}/cuenta/${cuenta}`);
      existe = (consulta.data || []).some(
        corte =>
          String(corte.fecha).slice(0,10) === String(fecha).slice(0,10) &&
          String(corte.id_medidor) === String(medidor)
      );
    } catch (err) {
      console.error(
        `Error consultando duplicados para cuenta ${cuenta}:`,
        err.response ? err.response.data : err.message
      );
      continue;
    }

    if (existe) {
      console.log(
        `Ya existe corte para cuenta ${cuenta}, medidor ${medidor}, fecha ${fecha}. No se inserta.`
      );
      continue;
    }

    const body = {
      cuenta,
      medidor,
      fecha,
      herramienta: herramienta || null,
      localizacion: localizacion || null,
      imagen: imagen || null
    };

    try {
      const resp = await axios.post(API_URL, body);
      console.log(`Insertado corte de cuenta ${cuenta}:`, resp.data);
    } catch (err) {
      console.error(
        `Error al insertar cuenta ${cuenta}:`,
        err.response ? err.response.data : err.message
      );
    }
  }
  console.log('Carga masiva finalizada.');
})();