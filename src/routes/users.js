const express = require("express");
const router = express.Router();
const db = require("../config/db");

/**
 * POST: Registrar nuevo usuario
 * Campos: username, password, name, role, status
 */
router.post("/", (req, res) => {
  const { username, password, name, role, status } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  db.query(
    "INSERT INTO users (username, password, name, role, status) VALUES (?, ?, ?, ?, ?)",
    [username, password, name, role, status ?? 1],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "El nombre de usuario ya existe." });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ ok: true, id: result.insertId });
    }
  );
});

/**
 * GET: Listar usuarios (paginado opcional: ?pagina=1&limite=50)
 */
router.get("/", (req, res) => {
  const pagina = parseInt(req.query.pagina) || 1;
  const limite = parseInt(req.query.limite) || 100;
  const offset = (pagina - 1) * limite;

  db.query("SELECT COUNT(*) as total FROM users", (err, totalResult) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(
      "SELECT id, username, name, role, status FROM users ORDER BY id DESC LIMIT ? OFFSET ?",
      [limite, offset],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ total: totalResult[0].total, pagina, limite, users: results });
      }
    );
  });
});

/**
 * GET: Buscar usuario por username o name (ejemplo: /api/users/buscar?q=juan)
 */
router.get("/buscar", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  db.query(
    "SELECT id, username, name, role, status FROM users WHERE username LIKE ? OR name LIKE ? ORDER BY id DESC",
    [`%${q}%`, `%${q}%`],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

/**
 * PUT: Editar usuario
 */
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { username, password, name, role, status } = req.body;
  if (!username || !name || !role) {
    return res.status(400).json({ error: "Campos obligatorios faltantes." });
  }

  let query, params;
  if (password) {
    query = "UPDATE users SET username=?, password=?, name=?, role=?, status=? WHERE id=?";
    params = [username, password, name, role, status ?? 1, id];
  } else {
    query = "UPDATE users SET username=?, name=?, role=?, status=? WHERE id=?";
    params = [username, name, role, status ?? 1, id];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "El nombre de usuario ya existe." });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: true });
  });
});

/**
 * DELETE: Eliminar usuario
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM users WHERE id=?", [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

module.exports = router;