const express = require('express');
const router = express.Router();
const db = require('../config/db');

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
            // Asegura que la fecha es string
            let fechaStr = r.fecha;
            if (fechaStr instanceof Date) {
              fechaStr = fechaStr.toISOString().slice(0, 10);
            }
            reconexionesMap[String(fechaStr)] = r.reconexiones;
          });

          // Unir ambos resultados por fecha
          const result = (Array.isArray(cortesRows) ? cortesRows : []).map(c => {
            // Asegura que la fecha es string
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

          // Ordenar por fecha ascendente (convertir a string siempre)
          result.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

          res.json(result);
        }
      );
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