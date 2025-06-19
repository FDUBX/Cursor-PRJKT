const Modbus = require('jsmodbus');
const net = require('net');
const fs = require('fs');
const devices = require('./devices.json');
const dataMap = require('./dataModbus.json');

const port = 502;
const addresses = Object.keys(dataMap).map(Number);

// Objet de suivi des connexions
const connectionTracker = {
  totalDevices: devices.length,
  openSockets: 0,
  closedSockets: 0,
  activeConnections: new Set()
};

// Objet pour stocker les résultats
const results = [];

function saveResults() {
  // Création du summary pour les logs
  const summary = {
    timestamp: new Date().toISOString(),
    totalDevices: devices.length,
    openSockets: connectionTracker.openSockets,
    closedSockets: connectionTracker.closedSockets,
    activeConnections: connectionTracker.activeConnections.size
  };

  // Log du summary
  console.log('Summary:', JSON.stringify(summary, null, 2));

  // Sauvegarde des résultats
  fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
  console.log('Résultats sauvegardés dans results.json');
}

function readDevice(deviceIdx) {
  return new Promise((resolve, reject) => {
    if (deviceIdx >= devices.length) {
      resolve();
      return;
    }

    const { ip, slave_id, name: deviceName } = devices[deviceIdx];
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, slave_id);

    // Création de l'entrée pour ce device dans les résultats
    const deviceResult = {
      name: deviceName,
      address: ip,
      slave_id: slave_id,
      successCount: 0,
      value: {}
    };
    results.push(deviceResult);

    let addrIdx = 0;

    function readNextAddress() {
      if (addrIdx >= addresses.length) {
        socket.end();
        return;
      }

      const siemensAddr = addresses[addrIdx];
      client.readHoldingRegisters(siemensAddr, 2)
        .then(resp => {
          const regs = resp.response._body.valuesAsArray;
          const buf = Buffer.alloc(4);
          buf.writeUInt16BE(regs[0], 0);
          buf.writeUInt16BE(regs[1], 2);
          const value = buf.readFloatBE(0);
          deviceResult.value[dataMap[siemensAddr]] = value;
          deviceResult.successCount = 1;
          console.log(`[${ip}][Slave ${slave_id}] ${deviceName} | ${dataMap[siemensAddr]} : ${value}`);
          addrIdx++;
          setTimeout(readNextAddress, 100);
        })
        .catch(err => {
          console.error(`[${ip}][Slave ${slave_id}] ${deviceName} | Erreur sur ${dataMap[siemensAddr]}: ${err.message}`);
          addrIdx++;
          setTimeout(readNextAddress, 100);
        });
    }

    socket.on('connect', () => {
      connectionTracker.openSockets++;
      connectionTracker.activeConnections.add(`${ip}:${slave_id}`);
      console.log(`[${ip}][Slave ${slave_id}] ${deviceName} | Connexion établie`);
      readNextAddress();
    });

    socket.on('error', (err) => {
      console.error(`[${ip}][Slave ${slave_id}] ${deviceName} | Erreur de connexion: ${err.message}`);
      socket.end();
      reject(err);
    });

    socket.on('close', () => {
      connectionTracker.closedSockets++;
      connectionTracker.activeConnections.delete(`${ip}:${slave_id}`);
      console.log(`[${ip}][Slave ${slave_id}] ${deviceName} | Connexion fermée`);
      resolve();
    });

    socket.connect({ host: ip, port });
  });
}

// Démarrer la lecture pour tous les appareils en parallèle
Promise.all(devices.map((_, index) => readDevice(index)))
  .then(() => {
    saveResults();
  })
  .catch(err => {
    console.error('Erreur globale:', err);
    saveResults();
  }); 