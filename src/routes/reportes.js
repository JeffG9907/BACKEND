const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET cortes y reconexiones por rango de fechas (YYYY-MM-DD) incluyendo detalle por día
router.get('/cortes-reconexiones', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.json([]);

  // Cortes por fecha (totales y detalles)
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

      // Detalle cortes por fecha
      db.query(
        `SELECT fecha, id_cuenta, id_medidor
         FROM cortes
         WHERE fecha BETWEEN ? AND ?
         ORDER BY fecha`,
        [start, end],
        (errDetCortes, detallesCortesRows) => {
          if (errDetCortes) {
            console.error('Error en detalles cortes:', errDetCortes);
            return res.status(500).json({ error: errDetCortes.message });
          }

          // Reconexiones por fecha (totales y detalles)
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

              db.query(
                `SELECT fecha, id_cuenta, id_medidor
                 FROM reconexiones
                 WHERE fecha BETWEEN ? AND ?
                 ORDER BY fecha`,
                [start, end],
                (errDetRecon, detallesReconexionesRows) => {
                  if (errDetRecon) {
                    console.error('Error en detalles reconexiones:', errDetRecon);
                    return res.status(500).json({ error: errDetRecon.message });
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

                  // Indexar detalles por fecha
                  const detallesCortesMap = {};
                  (Array.isArray(detallesCortesRows) ? detallesCortesRows : []).forEach(d => {
                    let fechaStr = d.fecha;
                    if (fechaStr instanceof Date) {
                      fechaStr = fechaStr.toISOString().slice(0, 10);
                    }
                    fechaStr = String(fechaStr);
                    if (!detallesCortesMap[fechaStr]) detallesCortesMap[fechaStr] = [];
                    detallesCortesMap[fechaStr].push({
                      id_cuenta: d.id_cuenta,
                      id_medidor: d.id_medidor
                    });
                  });

                  const detallesReconexionesMap = {};
                  (Array.isArray(detallesReconexionesRows) ? detallesReconexionesRows : []).forEach(d => {
                    let fechaStr = d.fecha;
                    if (fechaStr instanceof Date) {
                      fechaStr = fechaStr.toISOString().slice(0, 10);
                    }
                    fechaStr = String(fechaStr);
                    if (!detallesReconexionesMap[fechaStr]) detallesReconexionesMap[fechaStr] = [];
                    detallesReconexionesMap[fechaStr].push({
                      id_cuenta: d.id_cuenta,
                      id_medidor: d.id_medidor
                    });
                  });

                  // Unir ambos resultados por fecha
                  const result = (Array.isArray(cortesRows) ? cortesRows : []).map(c => {
                    let fechaStr = c.fecha;
                    if (fechaStr instanceof Date) {
                      fechaStr = fechaStr.toISOString().slice(0, 10);
                    }
                    fechaStr = String(fechaStr);
                    return {
                      fecha: fechaStr,
                      cortes: c.cortes,
                      reconexiones: reconexionesMap[fechaStr] || 0,
                      detallesCortes: detallesCortesMap[fechaStr] || [],
                      detallesReconexiones: detallesReconexionesMap[fechaStr] || []
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
                        reconexiones: r.reconexiones,
                        detallesCortes: [],
                        detallesReconexiones: detallesReconexionesMap[fechaStr] || []
                      });
                    }
                  });

                  // Ordenar por fecha ascendente
                  result.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

                  res.json(result);
                }
              );
            }
          );
        }
      );
    }
  );
});

module.exports = router;