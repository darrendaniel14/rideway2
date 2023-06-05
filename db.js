const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'ridewaya_app',
  password: 'Ddarren7$11',
  database: 'ridewaya_app',
  charset: 'utf8mb4' // Agrega esta l®™nea

});

db.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos: ' + err.stack);
    return;
  }
  console.log('Conexi√≥n exitosa a la base de datos.');
});

module.exports = db;
