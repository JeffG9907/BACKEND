const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Asegura la carpeta de uploads existe
const uploadPath = "uploads/cortes/";
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Configuración de multer para guardar imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
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

// PUT editar corte (actualiza imagen, elimina la anterior si existe)
router.put('/:id', upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  const { id_cuenta, id_medidor, fecha, localizacion } = req.body;
  // 1. Consulta corte actual para posible imagen antigua
  db.query('SELECT imagen FROM cortes WHERE id_cuenta=?', [id], (err, [corte]) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!corte) return res.status(404).json({ error: "Corte no encontrado." });

    let imagen = corte.imagen;
    let nuevaImagenSubida = false;

    // Si hay imagen nueva, borra la anterior y actualiza a la nueva
    if (req.file) {
      if (imagen && fs.existsSync(imagen)) {
        try { fs.unlinkSync(imagen); } catch {}
      }
      imagen = req.file.path;
      nuevaImagenSubida = true;
    } else if (req.body.imagen === "") {
      // Si se manda imagen vacía, elimina la imagen actual
      if (imagen && fs.existsSync(imagen)) {
        try { fs.unlinkSync(imagen); } catch {}
      }
      imagen = null;
    }

    db.query(
      'UPDATE cortes SET id_medidor=?, fecha=?, localizacion=?, imagen=? WHERE id_cuenta=?',
      [id_medidor, fecha, localizacion || null, imagen, id],
      (err2, result) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ok: true, imagen, nuevaImagenSubida });
      }
    );
  });
});

// DELETE eliminar corte por id_cuenta (borra imagen física)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT imagen FROM cortes WHERE id_cuenta=?', [id], (err, [corte]) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!corte) return res.status(404).json({ error: "Corte no encontrado." });

    // Eliminar física la imagen del disco si existe
    if (corte.imagen) {
      if (fs.existsSync(corte.imagen)) {
        try { fs.unlinkSync(corte.imagen); } catch (e) { /* ignora error */ }
      }
    }

    db.query('DELETE FROM cortes WHERE id_cuenta=?', [id], (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    });
  });
});

// DELETE eliminar TODOS los cortes (borra imágenes físicas)
router.delete('/', (req, res) => {
  db.query('SELECT imagen FROM cortes', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    results.forEach(corte => {
      if (corte.imagen && fs.existsSync(corte.imagen)) {
        try { fs.unlinkSync(corte.imagen); } catch (e) { /* ignora error */ }
      }
    });
    db.query('DELETE FROM cortes', (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true, message: 'Todos los cortes eliminados.' });
    });
  });
});

module.exports = router;