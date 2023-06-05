const express = require('express');
const mysql = require('mysql');
const axios = require('axios');

const app = express();
const db = require('./db');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.text({ type: 'text/plain;charset=UTF-8' })); // Configuración de codificación UTF-8


app.get('/api/vehiculos/:id', (req, res) => {
  const id = req.params.id;

  const query = `SELECT * FROM vehiculos WHERE id_conductor = '${id}'`;

  db.query(query, (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Error al ejecutar la consulta en la base de datos.' });
    } else {
      const vehiculos = result;
      res.json(vehiculos);
    }
  });
});

app.post('/api/login', (req, res) => {
  const cedula = req.body.cedula || '';
  const clave = req.body.clave || '';
  const token = req.body.token || '';

  // Verificar si el correo y la contraseña son correctos
  const sql = 'SELECT * FROM conductores WHERE cedula = ? AND clave = ?';
  db.query(sql, [cedula, clave], (err, result) => {
    if (err) {
      console.error('Error en la consulta:', err);
      res.status(500).json({
        success: false,
        id: 0,
        names: '',
        user: '',
        tipo: '',
      });
    } else if (result.length > 0) {
      const row = result[0];
      const uid = row.conductor_id;

      const updateTokenSql = 'UPDATE conductores SET token = ? WHERE conductor_id = ?';
      db.query(updateTokenSql, [token, uid], (updateTokenErr) => {
        if (updateTokenErr) {
          console.error('Error al actualizar el token:', updateTokenErr);
        }
      });

      res.json({
        success: true,
        id: uid,
        names: row.nombres,
        user: row.telefono,
        tipo: row.tipo,
      });
    } else {
      res.json({
        success: false,
        id: 0,
        names: '',
        user: '',
        tipo: '',
      });
    }
  });
});


app.get('/api/profile/:id', (req, res) => {
  const id = req.params.id;

  const query = `SELECT * FROM conductores WHERE conductor_id = '${id}'`;

  db.query(query, (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Error al ejecutar la consulta en la base de datos.' });
    } else {
      const marcadores = result;
      res.json(marcadores);
    }
  });
});


app.get('/api/conductores/:id', (req, res) => {
  const id = req.params.id;

  const query = `SELECT * FROM conductores WHERE tipo = 'taxi' AND conductor_id != '${id}' AND latitude != '' AND longitude != ''`;

  db.query(query, (err, result) => {
    if (err) {
      res.status(500).json({ error: 'Error al ejecutar la consulta en la base de datos.' });
    } else {
      const marcadores = result;
      res.json(marcadores);
    }
  });
});


app.post('/api/acceptTrip', (req, res) => {
  const { idViaje, idConductor } = req.body;

  // Actualizar el estado del viaje a "aceptado" y asignar el ID del conductor en la base de datos
  const sql = 'UPDATE viajes SET id_conductor = ?, estado_viaje = ? WHERE id_viaje = ?';
  const values = [idConductor, 'aceptado', idViaje];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error al cambiar el estado del viaje:', err);
      res.status(500).json({ error: 'Error al aceptar el viaje' });
      return;
    }

    console.log('El viaje ha sido aceptado');
    res.status(200).json({ message: 'El viaje ha sido aceptado' });
  });
});


app.post('/api/cancelTrip', (req, res) => {
  const { id } = req.body;

  // Actualizar el estado del viaje a "cancelado" en la base de datos
  const sql = 'UPDATE viajes SET estado_viaje = ? WHERE id_viaje = ?';
  const values = ['cancelado', id]; // Ajusta el ID del viaje según tus necesidades

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error al cambiar el estado del viaje:', err);
      res.status(500).json({ error: 'Error al cambiar el estado del viaje' });
      return;
    }
    console.log('Estado del viaje cambiado a cancelado');
    res.status(200).json({ message: 'Estado del viaje cambiado a cancelado' });
  });
});


app.get('/api/buscar_conductor', (req, res) => {
  // Definir las coordenadas de origen
  const origen_lat = 11.420197158636887;
  const origen_long = -69.6353049899798;
  const id_viaje = 116;

  // Obtener la lista de conductores ordenada por distancia
  const sql = `
    SELECT *,
      (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distancia
    FROM conductores
    WHERE tipo = 'taxi' AND estado_taxi = 'true'
    HAVING distancia <= distancia_maxima
    ORDER BY distancia ASC
  `;

  db.query(sql, [origen_lat, origen_long, origen_lat], (error, results) => {
    if (error) {
      console.error('Error al obtener la lista de conductores:', error);
      db.end();
      res.status(500).json({ error: 'Error al obtener la lista de conductores' });
      return;
    }

    if (results.length > 0) {
      results.forEach((fila) => {
        const id_conductor = fila.conductor_id;
        const nombre_conductor = fila.nombres;
        const distancia_conductor = fila.distancia;
        const token = fila.token;
        const tiempo_inicio = Math.floor(Date.now() / 1000);

        // Enviar notificación utilizando FCM
        const serverKey = 'AAAATMn-L4Y:APA91bFioYYoQ_ReCOpilXLLKhUcKVRelfFsfmIhfa6aQMlxm1b95oHYMBJIGCLFd_rn9QQRMEDf85V-ZXOzxME2QNMlPcGfGb_yWPBIrbLChLa7-LrSA3AEkatnc_hmmcbHyxDW5SJU';
        const title = 'Rideway Rides';
        const body = 'Tienes una nueva solicitud de viaje';
        const data = { id: id_viaje };
        const notification = { title, body, sound: 'default', badge: '1' };
        const arrayToSend = { to: token, notification, priority: 'high', data };
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`
        };
        const url = 'https://fcm.googleapis.com/fcm/send';

        axios.post(url, arrayToSend, { headers })
          .then((response) => {
              
            // Verificar si el conductor está disponible
            const estado_sql = `SELECT estado_taxi FROM conductores WHERE conductor_id = ?`;
            db.query(estado_sql, [id_conductor], (error_estado, results_estado) => {
              if (error_estado) {
                console.log(id_conductor)
                console.error('Error al obtener el estado del conductor:', id_conductor);
            
                res.status(500).json({ error: 'Error al obte2ner el estado del conductor', error_estado });
                return;
              }

              const estado = results_estado[0].estado_taxi;
              if (estado === 'true') {
                // Aceptar al conductor actual
                const respuesta = {
                  status: 'success',
                  id_conductor,
                  nombre_conductor,
                  distancia_conductor
                };
                res.json(respuesta);
             
                return;
              }
            });
          })
          .catch((error) => {
            console.error('Error al enviar la notificación FCM:', error);
     
            res.status(500).json({ error: 'Error al enviar la notificación FCM' });
          });
      });
    } else {
      res.status(404).json({ error: 'No se encontraron conductores dentro del radio especificado' });
 
    }
  });

  // Cerrar la conexión a la base de datos

});

app.get('/api/datosviaje/:id', (req, res) => {
  const id = req.params.id;

  // Realizar la consulta a la base de datos
  const sql = `SELECT * FROM viajes AS V
              INNER JOIN conductores AS U ON V.id_conductor = U.conductor_id
              INNER JOIN vehiculos AS VE ON V.id_conductor = VE.id_conductor
              WHERE V.id_viaje = ?`;
  db.query(sql, [id], (error, resultado) => {
    if (error) {
      // Manejar el error en caso de que ocurra
      res.status(500).json({ error: 'Ocurrió un error en el servidor' });
    } else {
      // Crear un array para almacenar los datos
      const datos = [];

      // Iterar sobre los resultados de la consulta y agregarlos al array
      resultado.forEach((fila) => {
        datos.push(fila);
      });

      // Devolver los datos en formato JSON
      res.json(datos);
    }
  });
});


app.get('/api/datosviaje2/:id', (req, res) => {
  const id = req.params.id;

  // Realizar la consulta a la base de datos
  const sql = `SELECT * FROM viajes AS V
              INNER JOIN conductores AS U ON V.id_usuario = U.conductor_id
              WHERE V.id_viaje = ?`;
  db.query(sql, [id], (error, resultado) => {
    if (error) {
      // Manejar el error en caso de que ocurra
      res.status(500).json({ error: 'Ocurrió un error en el servidor' });
    } else {
      // Crear un array para almacenar los datos
      const datos = [];

      // Iterar sobre los resultados de la consulta y agregarlos al array
      resultado.forEach((fila) => {
        datos.push(fila);
      });

      // Establecer la cabecera de la respuesta con la codificación UTF-8
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      // Devolver los datos en formato JSON
      res.json(datos);
    }
  });
});

app.get('/api/conductor/:id', (req, res) => {
  const conductorId = req.params.id;


  // Realizar la consulta a la base de datos
  const sql = `SELECT * FROM conductores WHERE conductor_id = ?`;
  db.query(sql, [conductorId], (error, result) => {
    if (error) {
      // Manejar el error en caso de que ocurra
      res.status(500).json({ error: 'Ocurrió un error en el servidor' });
    } else {
      // Verificar si se encontró un conductor con el ID proporcionado
      if (result.length === 0) {
        // Manejo de conductor no encontrado
        res.status(404).json({ error: 'Conductor no encontrado' });
      } else {
        // Obtener la información del conductor como un objeto
        const conductor = result[0];

        // Enviar la respuesta al cliente (Flutter)
        res.json(conductor);
      }
    }
  });
});


app.post('/api/crearviaje', (req, res) => {
  const {
    cliente_id,
    latitud_origen,
    longitud_origen,
    latitud_destino,
    longitud_destino,
    medio_pago,
    costo,
    distancia,
    direccion_origen,
    direccion_destino
  } = req.body;
 

  // Crear un nuevo registro en la tabla de viajes
  const query = `INSERT INTO viajes (id_usuario, origen_latitud, origen_longitud, destino_latitud, destino_longitud, id_conductor, costo, medio_pago, distancia, direccion_origen, direccion_destino)
          VALUES (?, ?, ?, ?, ?, '0', ?, ?, ?, ?, ?)`;
  const values = [
    cliente_id,
    latitud_origen,
    longitud_origen,
    latitud_destino,
    longitud_destino,
    costo,
    medio_pago,
    distancia,
    direccion_origen,
    direccion_destino
  ];
  db.query(query, values, (error, results) => {
    if (error) {
      res.json({ success: false, message: 'Error al crear un nuevo viaje' });
    } else {
     const id_viaje = results.insertId;

        

      const sql2 = `SELECT * FROM viajes WHERE id_viaje = ?`;
      db.query(sql2, id_viaje, (secondQueryError, secondQueryResults) => {
        if (secondQueryError) {
          res.json({ success: false, message: 'Error al obtener información del viaje creado' });
        } else {
          const row = secondQueryResults[0];
          const id_conductor = row.id_conductor;
          
          const ini = parseFloat(latitud_origen);
          const des = parseFloat(longitud_origen);

          const origen_lat = 11.4220853;
          const origen_long = -69.6223997;

 res.json({ id_viaje, id_conductor, ini, des });
  // Obtener la lista de conductores ordenada por distancia
  const sql = `
    SELECT *,
      (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distancia
    FROM conductores
    WHERE tipo = 'taxi' AND estado_taxi = 'true'
    HAVING distancia <= distancia_maxima
    ORDER BY distancia ASC
  `;

  db.query(sql, [ini, des, ini], (error, results) => {
    if (error) {
      console.error('Error al obtener la lista de conductores:', error);
      db.end();
      res.status(500).json({ error: 'Error al obtener la lista de conductores' });
      return;
    }
    
  
    if (results.length > 0) {
      results.forEach((fila) => {
        const id_conductor = fila.conductor_id;
        const nombre_conductor = fila.nombres;
        const distancia_conductor = fila.distancia;
        const token = fila.token;
        const tiempo_inicio = Math.floor(Date.now() / 1000);

       
        // Enviar notificación utilizando FCM
        const serverKey = 'AAAATMn-L4Y:APA91bFioYYoQ_ReCOpilXLLKhUcKVRelfFsfmIhfa6aQMlxm1b95oHYMBJIGCLFd_rn9QQRMEDf85V-ZXOzxME2QNMlPcGfGb_yWPBIrbLChLa7-LrSA3AEkatnc_hmmcbHyxDW5SJU';
        const title = 'Rideway Rides';
        const body = 'Tienes una nueva solicitud de viaje';
        const data = { id: id_viaje };
        const notification = { title, body, sound: 'default', badge: '1' };
        const arrayToSend = { to: token, notification, priority: 'high', data };
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`
        };
        const url = 'https://fcm.googleapis.com/fcm/send';

        axios.post(url, arrayToSend, { headers })
          .then((response) => {
            // Verificar si el conductor está disponible
            const estado_sql = `SELECT estado_taxi FROM conductores WHERE conductor_id = ?`;
            db.query(estado_sql, [id_conductor], (error_estado, results_estado) => {
              if (error_estado) {
                console.log(id_conductor)
                console.error('Error al obtener el estado del conductor:', id_conductor);
                res.status(500).json({ error: 'Error al obtener el estado del conductor', error_estado });
                return;
              }

           
            });
          })
          .catch((error) => {
            console.error('Error al enviar la notificación FCM:', error);
            res.status(500).json({ error: 'Error al enviar la notificación FCM' });
          });
      });
    } else {
      res.status(404).json({ error: 'No se encontraron conductores dentro del radio especificado' });
    }
  });
          
        }
      });
      
      
      
      
      
    }
    
  });

//FCM ENVIAR TODO SOBRE NOTIFICACION

});


app.get('/api/obtener_conductor/:id', (req, res) => {
  const id = req.params.id;
  
  // Obtener información del conductor asignado al viaje
  const query = `SELECT * FROM viajes WHERE id_viaje = ${id}`;
  db.query(query, (error, results) => {
    if (error) {
      res.json({ success: false, message: 'Error al obtener información del viaje' });
    } else {
      if (results.length > 0) {
        const row = results[0];
        const idConductor = row.id_conductor;
        
        if (idConductor !== 0) {
          // Obtener información del conductor
          const conductorQuery = `SELECT * FROM conductores WHERE conductor_id = ${idConductor}`;
          db.query(conductorQuery, (conductorError, conductorResults) => {
            if (conductorError) {
              res.json({ success: false, message: 'Error al obtener información del conductor' });
            } else {
              if (conductorResults.length > 0) {
                const conductorRow = conductorResults[0];
                const conductor = {
                  id_conductor: conductorRow.conductor_id,
                  name: conductorRow.nombres
                };
                res.json(conductor);
              } else {
                res.json({ success: false, message: 'No se encontró información del conductor' });
              }
            }
          });
        } else {
          res.json({ success: false, id_conductor: '0' });
        }
      } else {
        res.json({ success: false, message: 'No se encontró información del viaje' });
      }
    }
  });
});


// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor iniciado en el puerto 3000');
});
