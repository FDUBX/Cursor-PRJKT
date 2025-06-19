const Modbus = require('jsmodbus');
const net = require('net');
const devices = require('./devices.json');
const dataMap = require('./dataModbus.json');

const port = 502;
const addresses = Object.keys(dataMap).map(Number);

function readDevice(deviceIdx) {
  if (deviceIdx >= devices.length) return;

  const { ip, slave_id, name: deviceName } = devices[deviceIdx];
  const socket = new net.Socket();
  const client = new Modbus.client.TCP(socket, slave_id);

  let addrIdx = 0;

  function readNextAddress() {
    if (addrIdx >= addresses.length) {
      socket.end();
      setTimeout(() => readDevice(deviceIdx + 1), 200); // Passe au device suivant
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
        console.log(`[${ip}][Slave ${slave_id}] ${deviceName} | ${dataMap[siemensAddr]} : ${value}`);
        addrIdx++;
        setTimeout(readNextAddress, 100);
      })
      .catch(err => {
        console.error(`[${ip}][Slave ${slave_id}] ${deviceName} | Erreur sur ${dataMap[siemensAddr]} :`, err.message);
        addrIdx++;
        setTimeout(readNextAddress, 100);
      });
  }

  socket.on('connect', readNextAddress);
  socket.connect({ host: ip, port });
}

readDevice(0); 