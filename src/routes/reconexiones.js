const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET todas las reconexiones o filtrar por fecha o rango
router.get('/', (req, res) => {
  const { fecha, start, end } = req.query;
  let sql = 'SELECT * FROM reconexiones';
  let params = [];
  if (fecha) {
    sql += ' WHERE fecha = ?';
    params.push(fecha);
  } else if (start && end) {
    sql += ' WHERE fecha BETWEEN ? AND ? ORDER BY fecha ASC, id_cuenta ASC';
    params.push(start, end);
  } else {
    sql += ' ORDER BY fecha ASC, id_cuenta ASC';
  }
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET cortes y reconexiones por rango de fechas (YYYY-MM-DD)
router.get('/cortes-reconexiones', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.json([]);

  // Cortes por fecha
  db.query(
    `SELECT fecha, COUNT(*) AS cortes
     FROM cortes
     WHERE fecha BETWEEN ? AND ?
     GROUP BY fecha
     ORDER BY fecha`,
    [start, end],
    (err, cortesRows) => {
      if (err) {
        console.error('Error en GET cortes:', err);
        return res.status(500).json({ error: err.message });
      }

      // Reconexiones por fecha
      db.query(
        `SELECT fecha, COUNT(*) AS reconexiones
         FROM reconexiones
         WHERE fecha BETWEEN ? AND ?
         GROUP BY fecha
         ORDER BY fecha`,
        [start, end],
        (err2, reconexionesRows) => {
          if (err2) {
            console.error('Error en GET reconexiones:', err2);
            return res.status(500).json({ error: err2.message });
          }

          // Indexar reconexiones por fecha
          const reconexionesMap = {};
          (Array.isArray(reconexionesRows) ? reconexionesRows : []).forEach(r => {
            let fechaStr = r.fecha;
            if (fechaStr instanceof Date) {
              fechaStr = fechaStr.toISOString().slice(0, 10);
            }
            reconexionesMap[String(fechaStr)] = r.reconexiones;
          });

          // Unir ambos resultados por fecha
          const result = (Array.isArray(cortesRows) ? cortesRows : []).map(c => {
            let fechaStr = c.fecha;
            if (fechaStr instanceof Date) {
              fechaStr = fechaStr.toISOString().slice(0, 10);
            }
            return {
              fecha: String(fechaStr),
              cortes: c.cortes,
              reconexiones: reconexionesMap[String(fechaStr)] || 0
            };
          });

          // Agregar fechas donde solo hay reconexiones pero no cortes
          (Array.isArray(reconexionesRows) ? reconexionesRows : []).forEach(r => {
            let fechaStr = r.fecha;
            if (fechaStr instanceof Date) {
              fechaStr = fechaStr.toISOString().slice(0, 10);
            }
            fechaStr = String(fechaStr);
            if (!result.find(item => item.fecha === fechaStr)) {
              result.push({
                fecha: fechaStr,
                cortes: 0,
                reconexiones: r.reconexiones
              });
            }
          });

          // Ordenar por fecha ascendente
          result.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

          res.json(result);
        }
      );
    }
  );
});

// POST para insertar una reconexión
router.post('/', (req, res) => {
  const { id_cuenta, id_medidor, fecha } = req.body;
  if (!id_cuenta || !id_medidor || !fecha)
    return res.status(400).json({ error: 'Datos incompletos' });
  db.query(
    'INSERT INTO reconexiones (id_cuenta, id_medidor, fecha) VALUES (?, ?, ?)',
    [id_cuenta, id_medidor, fecha],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: result.insertId });
    }
  );
});

// PUT para editar una reconexión
router.put('/', (req, res) => {
  const {
    original_cuenta,
    original_medidor,
    original_fecha,
    id_cuenta,
    id_medidor,
    fecha
  } = req.body;

  if (!original_cuenta || !original_medidor || !original_fecha ||
      !id_cuenta || !id_medidor || !fecha) {
    return res.status(400).json({ error: 'Datos incompletos para editar' });
  }

  db.query(
    `UPDATE reconexiones
     SET id_cuenta = ?, id_medidor = ?, fecha = ?
     WHERE id_cuenta = ? AND id_medidor = ? AND fecha = ?`,
    [id_cuenta, id_medidor, fecha, original_cuenta, original_medidor, original_fecha],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, changedRows: result.changedRows });
    }
  );
});

// Elimina todas las reconexiones
router.delete('/reconexiones', (req, res) => {
  db.query('DELETE FROM reconexiones', (err, result) => {
    if (err) {
      console.error('Error al eliminar reconexiones:', err);
      return res.status(500).json({ error: 'Error al eliminar reconexiones', details: err.message });
    }
    res.json({ message: 'Todas las reconexiones han sido eliminadas', affectedRows: result.affectedRows });
  });
});

module.exports = router;