const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Helper para intentar infinitamente una consulta si hay error de conexión
function retryQuery(query, params) {
  return new Promise((resolve, reject) => {
    function attempt() {
      db.query(query, params, (err, results) => {
        if (!err) return resolve(results);
        // Solo reintentar errores de conexión
        const isConnectionError = err.code === 'PROTOCOL_CONNECTION_LOST' ||
                                  err.code === 'ECONNREFUSED' ||
                                  err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR';
        if (isConnectionError) {
          console.error(`Error de conexión a la base de datos (${err.code}). Reintentando en 2 segundos...`);
          setTimeout(attempt, 2000); // espera 2 segundos antes de reintentar
        } else {
          reject(err);
        }
      });
    }
    attempt();
  });
}

// Login: recibe username y password SIN encriptar
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const results = await retryQuery('SELECT * FROM users WHERE username = ?', [username]);
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
  } catch (err) {
    res.status(500).json({ success: false, message: "Error en el servidor: " + err.message });
  }
});

module.exports = router;