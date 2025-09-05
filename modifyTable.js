// modifyTable.js
// Script para agregar un nuevo campo autoincremental y clave primaria a una tabla MySQL en Railway
// Uso: node modifyTable.js

const mysql = require('mysql2/promise');

// Configura tus datos de conexión Railway aquí:
const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'LOmqhmefSYeZWuJgrrHVRSwYLkrkEZDy',
  database: 'railway',
  port: 12510,
};

async function modifyTable() {
  const tableName = 'cortes'; // Cambia por el nombre de tu tabla si es diferente
  const newColumn = 'id_cortes'; // Nombre del nuevo campo autoincremental

  const connection = await mysql.createConnection(dbConfig);

  try {
    // 1. Verifica si id_cuenta es AUTO_INCREMENT y cambia a VARCHAR si es necesario
    try {
      await connection.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN id_cuenta VARCHAR(50);`);
      console.log('La columna id_cuenta modificada (sin AUTO_INCREMENT).');
    } catch (e) {
      console.log('La columna id_cuenta ya era VARCHAR o no era AUTO_INCREMENT.');
    }

    // 2. Quitar clave primaria actual si existe
    try {
      await connection.query(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY;`);
      console.log('Clave primaria anterior eliminada (si existía).');
    } catch (e) {
      console.log('No había clave primaria o ya fue eliminada.');
    }

    // 3. Agregar nueva columna autoincremental como clave primaria
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${newColumn}\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;`);
    console.log(`Columna '${newColumn}' agregada como clave primaria autoincremental.`);

    // 4. (Opcional) Verifica la estructura de la tabla
    const [rows] = await connection.query(`SHOW CREATE TABLE \`${tableName}\`;`);
    console.log('Nueva estructura de tabla:\n', rows[0]['Create Table']);
  } catch (err) {
    console.error('Error modificando la tabla:', err.message);
  } finally {
    await connection.end();
  }
}

modifyTable();