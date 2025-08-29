const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Login: recibe username y password SIN encriptar
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Error en el servidor" });
    if (results.length === 0) return res.status(401).json({ success: false, message: "Usuario no existe" });

    const user = results[0];
    if (user.status !== 1) return res.status(403).json({ success: false, message: "Usuario inactivo" });

    // Comparación directa SIN encriptar
    if (password !== user.password) {
      return res.status(401).json({ success: false, message: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "tu_secreto_jwt",
      { expiresIn: "2h" }
    );
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  });
});

module.exports = router;