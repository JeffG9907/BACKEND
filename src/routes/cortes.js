const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configuración Cloudinary
cloudinary.config({
  cloud_name: 'dongnlepy',
  api_key: '919336698616996',
  api_secret: 'k9gKVFar7akoyt2rJryefelufR8'
});

// Configuración de Multer para guardar imágenes en Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'siscorte/cortes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => Date.now() + '-' + file.originalname.replace(/\s/g, '_')
  }
});
const upload = multer({ storage });

// GET todos los cortes (con filtros opcionales)
router.get('/', (req, res) => {
  const { fecha, start, end } = req.query;
  let sql = 'SELECT id_cortes, id_cuenta, id_medidor, fecha, herramienta, localizacion, imagen, imagen_public_id FROM cortes';
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
    res.json(Array.isArray(results) ? results : []);
  });
});

// GET /api/cortes/cuenta/:id
router.get('/cuenta/:id', (req, res) => {
  const { id } = req.params;
  db.query(
    'SELECT id_cortes, id_cuenta, id_medidor, fecha, herramienta, localizacion, imagen, imagen_public_id FROM cortes WHERE id_cuenta = ? ORDER BY fecha DESC',
    [id],
    (err, results) => {
      if (err) {
        console.error('Error en GET /cortes/cuenta/:id:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

// POST nuevo corte (permite hasta 2 cortes por mes por cuenta y medidor, con confirmación)
router.post('/', upload.single('imagen'), (req, res) => {
  const { cuenta, medidor, fecha, localizacion, herramienta, forzar } = req.body;
  let imagen = req.file ? req.file.path : null;
  let imagen_public_id = req.file ? req.file.filename : null;

  if (!cuenta || !medidor || !fecha || !herramienta) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  // Validar cuántos cortes existen en el mes para esa cuenta y medidor
  db.query(
    `SELECT COUNT(*) AS total FROM cortes
     WHERE id_cuenta = ? AND id_medidor = ?
     AND YEAR(fecha) = YEAR(?) AND MONTH(fecha) = MONTH(?)`,
    [cuenta, medidor, fecha, fecha],
    (err, result) => {
      if (err) {
        console.error('Error en validación de mes:', err);
        return res.status(500).json({ error: err.message });
      }
      const total = result[0].total;
      if (total >= 2) {
        return res.status(400).json({ error: 'Ya existen dos cortes para esta cuenta y medidor en el mes.' });
      }
      if (total === 1 && !forzar) {
        // Ya hay un corte, pedir confirmación
        return res.status(202).json({
          confirm: true,
          message: 'Ya existe un corte en el mes para esta cuenta y medidor. ¿Desea registrar un segundo corte este mes?'
        });
      }
      db.query(
        'INSERT INTO cortes (id_cuenta, id_medidor, fecha, herramienta, localizacion, imagen, imagen_public_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cuenta, medidor, fecha, herramienta, localizacion || null, imagen, imagen_public_id],
        (err2, result2) => {
          if (err2) {
            console.error('Error en POST /cortes:', err2);
            return res.status(500).json({ error: err2.message });
          }
          res.status(201).json({ ok: true, imagen });
        }
      );
    }
  );
});

// PUT editar corte (actualiza imagen en Cloudinary si hay una nueva)
router.put('/:id', upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  const { id_medidor, fecha, herramienta, localizacion } = req.body;

  db.query('SELECT imagen_public_id FROM cortes WHERE id_cortes=?', [id], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    let imagen = req.file ? req.file.path : req.body.imagen || null;
    let imagen_public_id = req.file ? req.file.filename : req.body.imagen_public_id || null;

    if (req.file && result.length > 0 && result[0].imagen_public_id) {
      try {
        await cloudinary.uploader.destroy(result[0].imagen_public_id);
      } catch (e) {
        console.error('Error al borrar imagen anterior en Cloudinary:', e);
      }
    }

    db.query(
      'UPDATE cortes SET id_medidor=?, fecha=?, herramienta=?, localizacion=?, imagen=?, imagen_public_id=? WHERE id_cortes=?',
      [id_medidor, fecha, herramienta, localizacion || null, imagen, imagen_public_id, id],
      (err2, result2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ok: true, imagen });
      }
    );
  });
});

// DELETE eliminar corte por id_cortes (borra imagen Cloudinary si existe)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT imagen_public_id FROM cortes WHERE id_cortes=?', [id], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.length > 0 && result[0].imagen_public_id) {
      try {
        await cloudinary.uploader.destroy(result[0].imagen_public_id);
      } catch (e) {
        console.error('Error al borrar imagen en Cloudinary:', e);
      }
    }

    db.query('DELETE FROM cortes WHERE id_cortes=?', [id], (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    });
  });
});

// DELETE eliminar TODOS los cortes (borra imágenes Cloudinary)
router.delete('/', (req, res) => {
  db.query('SELECT imagen_public_id FROM cortes', async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    for (const corte of results) {
      if (corte.imagen_public_id) {
        try {
          await cloudinary.uploader.destroy(corte.imagen_public_id);
        } catch (e) {
          console.error('Error al borrar imagen en Cloudinary:', e);
        }
      }
    }

    db.query('DELETE FROM cortes', (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true, message: 'Todos los cortes e imágenes eliminados.' });
    });
  });
});

module.exports = router;
