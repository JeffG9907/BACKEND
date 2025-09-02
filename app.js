const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboard');
const cortesRoutes = require('./src/routes/cortes');
const reconexionesRouter = require('./src/routes/reconexiones');
const incidenciasRouter = require('./src/routes/incidencias');
const reportesRouter = require('./src/routes/reportes');
const usuariosRoutes = require('./src/routes/users')

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));


app.use('/api', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cortes', cortesRoutes);
app.use('/api/reconexiones', reconexionesRouter);
app.use('/api/incidencias', incidenciasRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/users', usuariosRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
});