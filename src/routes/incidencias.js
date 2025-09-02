const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// STATIC: en tu app principal debe estar
// app.use('/uploads', express.static('uploads'));

const uploadPath = "uploads/incidencias/";
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + (req.body.cuenta || "n") + "-" + (req.body.medidor || "n") + ext);
  }
});
const upload = multer({ storage });

/**
 * POST: Registrar nueva incidencia
 * Campos: cuenta, medidor, fecha, novedad, operador, observaciones, imagen (opcional)
 */
router.post("/", upload.single("imagen"), (req, res) => {
  const { cuenta, medidor, fecha, novedad, operador, observaciones } = req.body;
  let imagenUrl = req.file ? req.file.path : null; // Guarda la ruta física

  if (!cuenta || !medidor || !fecha || !novedad || !operador) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  db.query(
    "INSERT INTO incidencias (cuenta, medidor, fecha, novedad, operador, observaciones, imagenUrl) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [cuenta, medidor, fecha, novedad, operador, observaciones || "", imagenUrl],
    (err, result) => {
      if (err) {
        console.error("Error al guardar incidencia:", err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ ok: true });
    }
  );
});

/**
 * GET: Listar incidencias (paginado opcional: ?pagina=1&limite=20)
 * Devuelve imagenUrl como URL pública si existe.
 */
router.get("/", (req, res) => {
  const pagina = parseInt(req.query.pagina) || 1;
  const limite = parseInt(req.query.limite) || 100;
  const offset = (pagina - 1) * limite;

  db.query("SELECT COUNT(*) as total FROM incidencias", (err, totalResult) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(
      "SELECT * FROM incidencias ORDER BY id_incidencia DESC LIMIT ? OFFSET ?",
      [limite, offset],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        results.forEach(inc => {
          if (inc.imagenUrl) {
            inc.imagenUrl = `${req.protocol}://${req.get('host')}/uploads/incidencias/${path.basename(inc.imagenUrl)}`;
          }
        });
        res.json({ total: totalResult[0].total, pagina, limite, incidencias: results });
      }
    );
  });
});

/**
 * GET: Buscar por cuenta o medidor (ejemplo: /api/incidencias/buscar?q=12345)
 * Devuelve imagenUrl como URL pública si existe.
 */
router.get("/buscar", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  db.query(
    "SELECT * FROM incidencias WHERE cuenta LIKE ? OR medidor LIKE ? ORDER BY id_incidencia DESC",
    [`%${q}%`, `%${q}%`],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      results.forEach(inc => {
        if (inc.imagenUrl) {
          inc.imagenUrl = `${req.protocol}://${req.get('host')}/uploads/incidencias/${path.basename(inc.imagenUrl)}`;
        }
      });
      res.json(results);
    }
  );
});

/**
 * PUT: Editar incidencia (puede actualizar imagen si se sube una nueva)
 */
router.put("/:id", upload.single("imagen"), (req, res) => {
  const { id } = req.params;
  const { cuenta, medidor, fecha, novedad, operador, observaciones } = req.body;

  // 1. Consulta incidencia actual para posible imagen antigua
  db.query("SELECT imagenUrl FROM incidencias WHERE id_incidencia=?", [id], (err, [inc]) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!inc) return res.status(404).json({ error: "Incidencia no encontrada." });

    let imagenUrl = inc.imagenUrl;
    let nuevaImagenSubida = false;

    // Si hay imagen nueva, borra la anterior y actualiza a la nueva
    if (req.file) {
      if (imagenUrl && fs.existsSync(imagenUrl)) {
        try { fs.unlinkSync(imagenUrl); } catch {}
      }
      imagenUrl = req.file.path;
      nuevaImagenSubida = true;
    }

    db.query(
      "UPDATE incidencias SET cuenta=?, medidor=?, fecha=?, novedad=?, operador=?, observaciones=?, imagenUrl=? WHERE id_incidencia=?",
      [cuenta, medidor, fecha, novedad, operador, observaciones, imagenUrl, id],
      (err2, result) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ok: true, imagenUrl, nuevaImagenSubida });
      }
    );
  });
});

/**
 * DELETE: Eliminar incidencia y la imagen física del disco si existe
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT imagenUrl FROM incidencias WHERE id_incidencia=?", [id], (err, [inc]) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!inc) return res.status(404).json({ error: "Incidencia no encontrada." });

    // Eliminar física la imagen del disco si existe
    if (inc.imagenUrl) {
      if (fs.existsSync(inc.imagenUrl)) {
        try { fs.unlinkSync(inc.imagenUrl); } catch (e) { /* ignora error */ }
      }
    }

    db.query("DELETE FROM incidencias WHERE id_incidencia=?", [id], (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    });
  });
});

module.exports = router;