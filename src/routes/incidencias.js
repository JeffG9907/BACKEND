const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configuración Cloudinary (pon tus credenciales)
cloudinary.config({
  cloud_name: "dongnlepy",
  api_key: "919336698616996",
  api_secret: "k9gKVFar7akoyt2rJryefelufR8"
});

// Multer & Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "siscorte/incidencias",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req, file) =>
      Date.now() + "-" + (req.body.cuenta || "n") + "-" + (req.body.medidor || "n") + "-" + file.originalname.replace(/\s/g, "_")
  },
});
const upload = multer({ storage });

/**
 * POST: Registrar nueva incidencia
 * Campos: cuenta, medidor, fecha, novedad, operador, observaciones, imagen (opcional)
 */
router.post("/", upload.single("imagen"), (req, res) => {
  const { cuenta, medidor, fecha, novedad, operador, observaciones } = req.body;
  let imagenUrl = req.file ? req.file.path : null; // URL pública Cloudinary
  let imagen_public_id = req.file ? req.file.filename : null;
  if (!cuenta || !medidor || !fecha || !novedad || !operador) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }
  db.query(
    "INSERT INTO incidencias (cuenta, medidor, fecha, novedad, operador, observaciones, imagenUrl, imagen_public_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [cuenta, medidor, fecha, novedad, operador, observaciones || "", imagenUrl, imagen_public_id],
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
        // Cloudinary URLs ya son públicas, no hace falta modificar
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
  db.query("SELECT imagen_public_id FROM incidencias WHERE id_incidencia=?", [id], async (err, [inc]) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!inc) return res.status(404).json({ error: "Incidencia no encontrada." });

    let imagenUrl = req.file ? req.file.path : req.body.imagenUrl || null;
    let imagen_public_id = req.file ? req.file.filename : req.body.imagen_public_id || null;
    let nuevaImagenSubida = false;

    // Si hay imagen nueva y existe una anterior, la borramos de Cloudinary
    if (req.file && inc.imagen_public_id) {
      try {
        await cloudinary.uploader.destroy(inc.imagen_public_id);
      } catch (e) {
        console.error("Error al borrar imagen anterior en Cloudinary:", e);
      }
      nuevaImagenSubida = true;
    }

    db.query(
      "UPDATE incidencias SET cuenta=?, medidor=?, fecha=?, novedad=?, operador=?, observaciones=?, imagenUrl=?, imagen_public_id=? WHERE id_incidencia=?",
      [cuenta, medidor, fecha, novedad, operador, observaciones, imagenUrl, imagen_public_id, id],
      (err2, result) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ok: true, imagenUrl, nuevaImagenSubida });
      }
    );
  });
});

/**
 * DELETE: Eliminar incidencia y la imagen de Cloudinary si existe
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT imagen_public_id FROM incidencias WHERE id_incidencia=?", [id], async (err, [inc]) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!inc) return res.status(404).json({ error: "Incidencia no encontrada." });

    // Eliminar imagen de Cloudinary si existe
    if (inc.imagen_public_id) {
      try {
        await cloudinary.uploader.destroy(inc.imagen_public_id);
      } catch (e) { /* ignora error */ }
    }

    db.query("DELETE FROM incidencias WHERE id_incidencia=?", [id], (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    });
  });
});

module.exports = router;