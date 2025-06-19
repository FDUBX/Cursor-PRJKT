const express = require('express');
const client = require('prom-client');
const devices = require('./devices.json');
const dataMap = require('./dataModbus.json');
const Modbus = require('jsmodbus');
const net = require('net');

const app = express();
// Augmenter le timeout des requêtes
app.use((req, res, next) => {
  req.setTimeout(60000); // 60 secondes
  res.setTimeout(60000);
  next();
});

const register = new client.Registry();

// Variable pour stocker le timestamp de dernière mise à jour
let lastUpdateTimestamp = Date.now();

const gauge = new client.Gauge({
  name: 'modbus_value',
  help: 'Valeur Modbus lue',
  labelNames: ['ip', 'slave_id', 'device', 'point']
});
register.registerMetric(gauge);

// Ajout d'un compteur d'erreurs
const errorCounter = new client.Counter({
  name: 'modbus_read_errors_total',
  help: 'Nombre total d\'erreurs de lecture Modbus',
  labelNames: ['ip', 'slave_id', 'device']
});
register.registerMetric(errorCounter);

// Ajout d'un compteur de lectures réussies
const successCounter = new client.Counter({
  name: 'modbus_read_success_total',
  help: 'Nombre total de lectures Modbus réussies',
  labelNames: ['ip', 'slave_id', 'device']
});
register.registerMetric(successCounter);

// Variable pour stocker les dernières valeurs lues
let lastReadValues = new Map();
let isReading = false;
let lastError = null;
let deviceIdx = 0;
let addrIdx = 0;

// Configuration des endpoints
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Modbus Exporter</title></head>
      <body>
        <h1>Modbus Exporter</h1>
        <p>Endpoints disponibles :</p>
        <ul>
          <li><a href="/metrics">/metrics</a> - Métriques Prometheus</li>
          <li><a href="/status">/status</a> - État de l'exporter</li>
        </ul>
      </body>
    </html>
  `);
});

app.get('/status', (req, res) => {
  try {
    res.json({
      status: 'running',
      isReading,
      lastUpdate: new Date(lastUpdateTimestamp).toISOString(),
      lastError: lastError ? lastError.message : null,
      devicesTotal: devices.length,
      pointsPerDevice: addresses.length,
      currentDevice: isReading ? deviceIdx : null,
      currentPoint: isReading ? addrIdx : null
    });
  } catch (error) {
    console.error('Erreur lors de la génération du statut:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: lastUpdateTimestamp
    });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    console.error('Erreur lors de la génération des métriques:', error);
    lastError = error;
    res.status(500).send('Erreur lors de la génération des métriques');
  }
});

// Démarrage du serveur
const server = app.listen(10006, '0.0.0.0', () => {
  console.log('Exporter Prometheus démarré sur :');
  console.log('- http://0.0.0.0:10006/');
  console.log('- http://0.0.0.0:10006/metrics');
  console.log('- http://0.0.0.0:10006/status');
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('Arrêt du serveur...');
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});

const port = 502;
const addresses = Object.keys(dataMap).map(Number);

function readAllDevices() {
  if (isReading) {
    console.log('Une lecture est déjà en cours, on attend le prochain cycle');
    return;
  }

  isReading = true;
  deviceIdx = 0;
  console.log(`Nombre total de devices à lire: ${devices.length}`);
  console.log(`Nombre total de points à lire par device: ${addresses.length}`);

  function readDevice() {
    if (deviceIdx >= devices.length) {
      console.log('Lecture de tous les devices terminée');
      isReading = false;
      lastUpdateTimestamp = Date.now();
      return;
    }

    const { ip, slave_id, name: deviceName } = devices[deviceIdx];
    console.log(`\nDébut de la lecture du device ${deviceIdx + 1}/${devices.length}: ${deviceName} (${ip}, slave_id: ${slave_id})`);
    
    const socket = new net.Socket();
    const clientModbus = new Modbus.client.TCP(socket, slave_id);
    addrIdx = 0;

    function readNextAddress() {
      if (addrIdx >= addresses.length) {
        console.log(`Fin de la lecture du device ${deviceName} (${ip}, slave_id: ${slave_id})`);
        socket.end();
        deviceIdx++;
        setTimeout(readDevice, 1000);
        return;
      }

      const siemensAddr = addresses[addrIdx];
      console.log(`Lecture du point ${addrIdx + 1}/${addresses.length} pour ${deviceName}: ${dataMap[siemensAddr]} (adresse: ${siemensAddr})`);
      
      clientModbus.readHoldingRegisters(siemensAddr, 2)
        .then(resp => {
          const regs = resp.response._body.valuesAsArray;
          const buf = Buffer.alloc(4);
          buf.writeUInt16BE(regs[0], 0);
          buf.writeUInt16BE(regs[1], 2);
          const value = buf.readFloatBE(0);
          const key = `${ip}_${slave_id}_${deviceName}_${dataMap[siemensAddr]}`;
          lastReadValues.set(key, value);
          gauge.set(
            { ip, slave_id, device: deviceName, point: dataMap[siemensAddr] },
            value
          );
          successCounter.inc({ ip, slave_id, device: deviceName });
          console.log(`Lecture réussie pour ${deviceName} - Point: ${dataMap[siemensAddr]}, Valeur: ${value}`);
          addrIdx++;
          setTimeout(readNextAddress, 1000);
        })
        .catch((err) => {
          console.error(`Erreur de lecture pour ${deviceName} - Point: ${dataMap[siemensAddr]}:`, err.message);
          errorCounter.inc({ ip, slave_id, device: deviceName });
          lastError = err;
          addrIdx++;
          setTimeout(readNextAddress, 1000);
        });
    }

    socket.on('connect', () => {
      console.log(`Connexion établie avec ${ip}:${port} (slave_id: ${slave_id})`);
      readNextAddress();
    });

    socket.on('error', (err) => {
      console.error(`Erreur de connexion pour ${ip}:${port} (slave_id: ${slave_id}):`, err.message);
      lastError = err;
      socket.destroy();
      deviceIdx++;
      setTimeout(readDevice, 1000);
    });

    socket.on('close', () => {
      console.log(`Connexion fermée pour ${ip}:${port} (slave_id: ${slave_id})`);
    });

    socket.connect({ host: ip, port });
    
  }

  readDevice();
}

function loop() {
  console.log('\n=== Démarrage d\'un nouveau cycle de lecture ===');
  readAllDevices();
  setTimeout(loop, 30000); // Rafraîchissement toutes les 30s
}

// Démarrer le premier cycle
loop(); 