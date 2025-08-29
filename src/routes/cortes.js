const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');

// Configuración de multer para guardar imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/cortes'); // Carpeta donde se guardan imágenes
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
  }
});
const upload = multer({ storage });

// GET todos los cortes (con filtros opcionales)
router.get('/', (req, res) => {
  const { fecha, start, end } = req.query;
  let sql = 'SELECT id_cuenta, id_medidor, fecha, localizacion, imagen FROM cortes';
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
      console.error('Error en GET /cortes:', err);
      return res.status(500).json({ error: err.message });
    }
    results.forEach(c => {
      if (c.imagen) {
        c.imagen = `${req.protocol}://${req.get('host')}/uploads/cortes/${path.basename(c.imagen)}`;
      }
    });
    res.json(Array.isArray(results) ? results : []);
  });
});

// GET /api/cortes/cuenta/:id
router.get('/cuenta/:id', (req, res) => {
  const { id } = req.params;
  db.query(
    'SELECT id_cuenta, id_medidor, fecha, localizacion, imagen FROM cortes WHERE id_cuenta = ? ORDER BY fecha DESC',
    [id],
    (err, results) => {
      if (err) {
        console.error('Error en GET /cortes/cuenta/:id:', err);
        return res.status(500).json({ error: err.message });
      }
      results.forEach(c => {
        if (c.imagen) {
          c.imagen = `${req.protocol}://${req.get('host')}/uploads/cortes/${path.basename(c.imagen)}`;
        }
      });
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

// POST nuevo corte (con imagen y localización)
router.post('/', upload.single('imagen'), (req, res) => {
  const { cuenta, medidor, fecha, localizacion } = req.body;
  let imagen = req.file ? req.file.path : null;
  if (!cuenta || !medidor || !fecha) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  db.query(
    'INSERT INTO cortes (id_cuenta, id_medidor, fecha, localizacion, imagen) VALUES (?, ?, ?, ?, ?)',
    [cuenta, medidor, fecha, localizacion || null, imagen],
    (err, result) => {
      if (err) {
        console.error('Error en POST /cortes:', err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ ok: true });
    }
  );
});

// PUT editar corte
router.put('/:id', upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  const { id_cuenta, id_medidor, fecha, localizacion } = req.body;
  let imagen = req.file ? req.file.path : req.body.imagen || null;

  db.query(
    'UPDATE cortes SET id_medidor=?, fecha=?, localizacion=?, imagen=? WHERE id_cuenta=?',
    [id_medidor, fecha, localizacion || null, imagen, id],
    (err, result) => {
      if (err) {
        console.error('Error en PUT /cortes:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ ok: true });
    }
  );
});

// DELETE eliminar corte por id_cuenta
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM cortes WHERE id_cuenta=?', [id], (err, result) => {
    if (err) {
      console.error('Error en DELETE /cortes:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: true });
  });
});

// DELETE eliminar TODOS los cortes
router.delete('/', (req, res) => {
  db.query('DELETE FROM cortes', (err, result) => {
    if (err) {
      console.error('Error en DELETE /cortes (todos):', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: true, message: 'Todos los cortes eliminados.' });
  });
});

module.exports = router;