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

// Configuración Multer para guardar imágenes en Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'siscorte/reconexiones',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => Date.now() + '-' + file.originalname.replace(/\s/g, '_')
  }
});
const upload = multer({ storage });

// GET todas las reconexiones (con filtros opcionales)
router.get('/', (req, res) => {
  const { fecha, start, end } = req.query;
  let sql = 'SELECT id_reconexion, id_cuenta, id_medidor, fecha, localizacion, imagen, imagen_public_id FROM reconexiones';
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
    'SELECT id_reconexion, id_cuenta, id_medidor, fecha, localizacion, imagen, imagen_public_id FROM reconexiones WHERE id_cuenta = ? ORDER BY fecha DESC',
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
router.post('/', upload.single('imagen'), (req, res) => {
  const { id_cuenta, id_medidor, fecha, localizacion, forzar } = req.body;
  let imagen = req.file ? req.file.path : null;
  let imagen_public_id = req.file ? req.file.filename : null;

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
        'INSERT INTO reconexiones (id_cuenta, id_medidor, fecha, localizacion, imagen, imagen_public_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id_cuenta, id_medidor, fecha, localizacion || null, imagen, imagen_public_id],
        (err2, result2) => {
          if (err2) {
            console.error('Error en POST /reconexiones:', err2);
            return res.status(500).json({ error: err2.message });
          }
          res.status(201).json({ ok: true, imagen });
        }
      );
    }
  );
});

// PUT editar reconexión (actualiza imagen en Cloudinary si hay una nueva)
router.put('/:id', upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  const { id_medidor, fecha, localizacion } = req.body;

  db.query('SELECT imagen_public_id FROM reconexiones WHERE id_reconexion=?', [id], async (err, result) => {
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
      'UPDATE reconexiones SET id_medidor=?, fecha=?, localizacion=?, imagen=?, imagen_public_id=? WHERE id_reconexion=?',
      [id_medidor, fecha, localizacion || null, imagen, imagen_public_id, id],
      (err2, result2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ok: true, imagen });
      }
    );
  });
});

// DELETE eliminar reconexión por id_reconexion (borra imagen Cloudinary si existe)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT imagen_public_id FROM reconexiones WHERE id_reconexion=?', [id], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.length > 0 && result[0].imagen_public_id) {
      try {
        await cloudinary.uploader.destroy(result[0].imagen_public_id);
      } catch (e) {
        console.error('Error al borrar imagen en Cloudinary:', e);
      }
    }

    db.query('DELETE FROM reconexiones WHERE id_reconexion=?', [id], (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    });
  });
});

// DELETE eliminar TODOS las reconexiones (borra imágenes Cloudinary)
router.delete('/', (req, res) => {
  db.query('SELECT imagen_public_id FROM reconexiones', async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    for (const rec of results) {
      if (rec.imagen_public_id) {
        try {
          await cloudinary.uploader.destroy(rec.imagen_public_id);
        } catch (e) {
          console.error('Error al borrar imagen en Cloudinary:', e);
        }
      }
    }

    db.query('DELETE FROM reconexiones', (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true, message: 'Todas las reconexiones e imágenes eliminadas.' });
    });
  });
});

module.exports = router;