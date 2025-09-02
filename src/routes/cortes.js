const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configuración Cloudinary (pon tus credenciales)
cloudinary.config({
  cloud_name: 'TU_CLOUD_NAME',      // <--- pon tu cloud_name aquí
  api_key: 'TU_API_KEY',            // <--- pon tu api_key aquí
  api_secret: 'TU_API_SECRET'       // <--- pon tu api_secret aquí
});

// Configuración de Multer para guardar imágenes en Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'siscorte/cortes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => Date.now() + '-' + file.originalname.replace(/\s/g, '_')
  },
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
    // Las URLs de imagen ya serán públicas por Cloudinary
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
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

// POST nuevo corte (con imagen en Cloudinary)
router.post('/', upload.single('imagen'), (req, res) => {
  const { cuenta, medidor, fecha, localizacion } = req.body;
  let imagen = req.file ? req.file.path : null; // Multer-storage-cloudinary pone la URL pública aquí
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

// PUT editar corte (actualiza imagen en Cloudinary si hay una nueva)
// *Opcional: puedes guardar el public_id para borrar la imagen anterior en Cloudinary cuando edites/borras*
router.put('/:id', upload.single('imagen'), (req, res) => {
  const { id } = req.params;
  const { id_medidor, fecha, localizacion } = req.body;
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
  // Opcional: puedes consultar y borrar la imagen en Cloudinary usando public_id si lo guardas en la DB
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