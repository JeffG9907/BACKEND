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
  const tableName = 'cortes';
  const newColumn = 'id_cortes';

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

    // 3. Quitar restricción UNIQUE de id_cuenta si existe
    try {
      await connection.query(`ALTER TABLE \`${tableName}\` DROP INDEX id_cuenta;`);
      console.log('Restricción UNIQUE/el índice de id_cuenta eliminado (si existía).');
    } catch (e) {
      console.log('No había índice UNIQUE en id_cuenta o ya fue eliminado.');
    }

    // 4. Agregar nueva columna autoincremental como clave primaria, solo si no existe
    try {
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${newColumn}\` INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;`);
      console.log(`Columna '${newColumn}' agregada como clave primaria autoincremental.`);
    } catch (e) {
      // Si la columna ya existe, asegurar que es AUTO_INCREMENT y PRIMARY KEY, pero evita agregar PK si ya existe
      console.log(`La columna '${newColumn}' ya existe, asegurando que sea AUTO_INCREMENT y PRIMARY KEY.`);
      await connection.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${newColumn}\` INT NOT NULL AUTO_INCREMENT;`);
      // Solo agrega PK si no existe
      const [keys] = await connection.query(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY';`);
      if (keys.length === 0) {
        await connection.query(`ALTER TABLE \`${tableName}\` ADD PRIMARY KEY (\`${newColumn}\`);`);
        console.log(`PRIMARY KEY agregada a '${newColumn}'.`);
      } else {
        console.log(`La columna '${newColumn}' ya es PRIMARY KEY.`);
      }
    }

    // 5. Verifica la estructura de la tabla
    const [rows] = await connection.query(`SHOW CREATE TABLE \`${tableName}\`;`);
    console.log('Nueva estructura de tabla:\n', rows[0]['Create Table']);
  } catch (err) {
    console.error('Error modificando la tabla:', err.message);
  } finally {
    await connection.end();
  }
}

modifyTable();