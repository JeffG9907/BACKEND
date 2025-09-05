const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET todas las reconexiones (con filtros opcionales)
router.get('/', (req, res) => {
  const { fecha, start, end } = req.query;
  let sql = 'SELECT id_reconexion, id_cuenta, id_medidor, fecha FROM reconexiones';
  let params = [];
  if (fecha) {
    sql += ' WHERE fecha = ? ORDER BY id_cuenta';
    params = [fecha];
  } else if (start && end) {
    sql += ' WHERE fecha BETWEEN ? AND ? ORDER BY fecha, id_cuenta';
    params = [start, end];
  }
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error en GET /reconexiones:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

// GET /api/reconexiones/cuenta/:id
router.get('/cuenta/:id', (req, res) => {
  const { id } = req.params;
  db.query(
    'SELECT id_reconexion, id_cuenta, id_medidor, fecha FROM reconexiones WHERE id_cuenta = ? ORDER BY fecha DESC',
    [id],
    (err, results) => {
      if (err) {
        console.error('Error en GET /reconexiones/cuenta/:id:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

// POST nueva reconexión (permite varios por mes, pero valida duplicado y permite confirmar)
router.post('/', (req, res) => {
  const { id_cuenta, id_medidor, fecha, forzar } = req.body;

  if (!id_cuenta || !id_medidor || !fecha) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  // Validar si ya existe reconexión para la cuenta y medidor en el mismo mes
  db.query(
    `SELECT COUNT(*) AS total FROM reconexiones
     WHERE id_cuenta = ? AND id_medidor = ?
     AND YEAR(fecha) = YEAR(?) AND MONTH(fecha) = MONTH(?)`,
    [id_cuenta, id_medidor, fecha, fecha],
    (err, result) => {
      if (err) {
        console.error('Error en validación de mes:', err);
        return res.status(500).json({ error: err.message });
      }
      const total = result[0].total;
      if (total >= 1 && !forzar) {
        // Ya hay una reconexión, pedir confirmación
        return res.status(202).json({
          confirm: true,
          message: 'Ya existe una reconexión en el mes para esta cuenta y medidor. ¿Desea registrar otra reconexión este mes?'
        });
      }
      db.query(
        'INSERT INTO reconexiones (id_cuenta, id_medidor, fecha) VALUES (?, ?, ?)',
        [id_cuenta, id_medidor, fecha],
        (err2, result2) => {
          if (err2) {
            console.error('Error en POST /reconexiones:', err2);
            return res.status(500).json({ error: err2.message });
          }
          res.status(201).json({ ok: true });
        }
      );
    }
  );
});

// PUT editar reconexión
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { id_medidor, fecha } = req.body;

  db.query(
    'UPDATE reconexiones SET id_medidor=?, fecha=? WHERE id_reconexion=?',
    [id_medidor, fecha, id],
    (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    }
  );
});

// DELETE eliminar reconexión por id_reconexion
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM reconexiones WHERE id_reconexion=?', [id], (err2, result2) => {
    if (err2) return res.status(500).json({ error: err2.message });
    res.json({ ok: true });
  });
});

// DELETE eliminar TODOS las reconexiones
router.delete('/', (req, res) => {
  db.query('DELETE FROM reconexiones', (err2, result2) => {
    if (err2) return res.status(500).json({ error: err2.message });
    res.json({ ok: true, message: 'Todas las reconexiones eliminadas.' });
  });
});

module.exports = router;