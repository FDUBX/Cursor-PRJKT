// Chargement des targets
let targets;
try {
    console.log('Loading targets from file...');
    targets = require("./targets.json");
    console.log(`Loaded ${targets.length} targets from file`);

    if (!Array.isArray(targets)) {
        console.error('Targets is not an array, resetting to empty array');
        targets = [];
    }

    if (!targets.length) {
        console.warn('No targets loaded!');
    } else {
        console.log('First target:', JSON.stringify(targets[0]));
    }
} catch (error) {
    console.error('Error loading targets:', error);
    targets = [];
}

var request = require('request');
const express = require('express');
const winston = require('winston');
const Modbus = require('jsmodbus');
const net = require('net');
const dataMap = require('./dataModbus.json');

const app = express();
const port = 8888;
const appName = "metersMonitoring";
const modbusPort = 502;
const addresses = Object.keys(dataMap).map(Number);

/* --------------------------------- logger --------------------------------- */
var winslogger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()]
});

global.winsLog = function (message, level, service) {
    if (process.env.NAME) {
        console.log(message, level, service);
    } else {
        winslogger.log({
            message: message,
            service: service,
            level: level,
            system: appName
        });
    }
};

// Initialize targets with default values
targets.forEach(target => {
    target.previousImportT1 = 0;
    target.previousImportT1Minute = null;
    target.consumptionLast5Seconds = 0;
    target.consumptionLastMinute = 0;
    target.successCount = 0;
    target.value = {};
    // Ajout des champs pour les appareils Modbus
    target.previousImportedEnergyMinute = null;
});

/* -------------------------------------------------------------------------- */
/*                                  function                                  */
/* -------------------------------------------------------------------------- */
var getOverview = (address) => {
    return new Promise((resolve, reject) => {
        var options = {
            'method': 'GET',
            'url': `http://${address}/data.json?type=OVERVIEW`,
            'timeout': 5000
        };
        request(options, (error, response) => {
            if (error) {
                reject(error);
            } else {
                try {
                    var result = {};
                    const overviewData = JSON.parse(response.body).OVERVIEW;
                    for (const metric in overviewData) {
                        if (Object.prototype.hasOwnProperty.call(overviewData, metric)) {
                            if (overviewData[metric].value) {
                                result[metric] = overviewData[metric].value;
                            }
                        }
                    }
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}

// Nouvelle fonction pour lire les données Modbus
function readModbusDevice(target) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const client = new Modbus.client.TCP(socket, target.slave_id);

        let addrIdx = 0;

        function readNextAddress() {
            if (addrIdx >= addresses.length) {
                socket.end();
                return;
            }

            const siemensAddr = addresses[addrIdx];
            const registerCount = dataMap[siemensAddr].registers;
            client.readHoldingRegisters(siemensAddr, registerCount)
                .then(resp => {
                    const regs = resp.response._body.valuesAsArray;
                    let value;
                    
                    if (registerCount === 2) {
                        // 32-bit float (4 bytes)
                        const buf = Buffer.alloc(4);
                        buf.writeUInt16BE(regs[0], 0);
                        buf.writeUInt16BE(regs[1], 2);
                        value = buf.readFloatBE(0);
                    } else if (registerCount === 4) {
                        // 64-bit double (8 bytes)
                        const buf = Buffer.alloc(8);
                        buf.writeUInt16BE(regs[0], 0);
                        buf.writeUInt16BE(regs[1], 2);
                        buf.writeUInt16BE(regs[2], 4);
                        buf.writeUInt16BE(regs[3], 6);
                        value = buf.readDoubleBE(0);
                    } else {
                        throw new Error(`Unsupported register count: ${registerCount}`);
                    }

                    target.value[dataMap[siemensAddr].name] = value;
                    target.successCount = 1;
                    winsLog(`[${target.address}][Slave ${target.slave_id}] ${target.name} | ${dataMap[siemensAddr].name} : ${value}`, 'info', 'readModbusDevice');
                    addrIdx++;
                    setTimeout(readNextAddress, 100);
                })
                .catch(err => {
                    winsLog(`[${target.address}][Slave ${target.slave_id}] ${target.name} | Erreur sur ${dataMap[siemensAddr].name}: ${err.message}`, 'error', 'readModbusDevice');
                    addrIdx++;
                    setTimeout(readNextAddress, 100);
                });
        }

        socket.on('connect', () => {
            winsLog(`[${target.address}][Slave ${target.slave_id}] ${target.name} | Connexion établie`, 'info', 'readModbusDevice');
            readNextAddress();
        });

        socket.on('error', (err) => {
            winsLog(`[${target.address}][Slave ${target.slave_id}] ${target.name} | Erreur de connexion: ${err.message}`, 'error', 'readModbusDevice');
            socket.end();
            reject(err);
        });

        socket.on('close', () => {
            winsLog(`[${target.address}][Slave ${target.slave_id}] ${target.name} | Connexion fermée`, 'info', 'readModbusDevice');
            resolve();
        });

        socket.connect({ host: target.address, port: modbusPort });
    });
}

let isReady = false;
let isReadyForMinute = false;

var run = () => {
    const promises = targets.map(target => {
        if (target.slave_id) {
            // Utiliser Modbus pour les appareils avec slave_id
            return readModbusDevice(target)
                .catch(error => {
                    winsLog(`${target.name}: ${error.message}`, 'error', 'run');
                    return Promise.reject(error);
                });
        } else {
            // Utiliser la méthode existante pour les appareils PAC
            return getOverview(target.address)
                .then(response => {
                    if (target.previousImportT1 !== 0) {
                        target.consumptionLast5Seconds = Math.round((response.Import_T1 - target.previousImportT1) * 100) / 100;
                        response.consumptionLast5Seconds = target.consumptionLast5Seconds;
                    }
                    target.previousImportT1 = response.Import_T1;
                    response.consumptionLastMinute = target.consumptionLastMinute;
                    target.value = response;
                    target.successCount += 1;
                })
                .catch(error => {
                    winsLog(`${target.name}: ${error.message}`, 'error', 'run');
                    return Promise.reject(error);
                });
        }
    });

    return Promise.allSettled(promises)
        .then((results) => {
            const successfulTargets = targets.filter(target => target.successCount >= 2);
            if (successfulTargets.length > 0) {
                calculateConsumptionLastMinute();
                if (!isReady) {
                    winsLog('At least one target has been successfully updated twice', 'info', 'run');
                    isReady = true;
                }
            }
        })
        .catch(error => {
            winsLog(`An error occurred during the update: ${error.message}`, 'error', 'run');
        });
}

// Fonction pour calculer la consommation de la dernière minute
var calculateConsumptionLastMinute = () => {
    var previousImportT1MinuteInit = false;
    var previousImportedEnergyMinuteInit = false;

    targets.forEach(target => {
        if (target.slave_id) {
            // Calcul pour les appareils Modbus
            if (target.value["Imported active energy"] !== undefined) {
                const currentEnergy = target.value["Imported active energy"];
                
                if (target.previousImportedEnergyMinute !== null) {
                    previousImportedEnergyMinuteInit = true;
                    const consumption = currentEnergy - target.previousImportedEnergyMinute;
                    target.value.consumptionLastMinute = Math.round(consumption * 1000) / 1000;
                    winsLog(`[${target.address}][Slave ${target.slave_id}] ${target.name} | Calcul consommation: ${currentEnergy} - ${target.previousImportedEnergyMinute} = ${target.value.consumptionLastMinute}`, 'info', 'calculateConsumptionLastMinute');
                } else {
                    winsLog(`[${target.address}][Slave ${target.slave_id}] ${target.name} | Première lecture d'énergie: ${currentEnergy}`, 'info', 'calculateConsumptionLastMinute');
                }
                
                // Mise à jour de la valeur précédente
                target.previousImportedEnergyMinute = currentEnergy;
            }
        } else {
            // Calcul existant pour les PAC
            if (target.previousImportT1Minute !== null) {
                previousImportT1MinuteInit = true;
                target.consumptionLastMinute = Math.round((target.previousImportT1 - target.previousImportT1Minute) * 1000) / 1000;
            }
            target.previousImportT1Minute = target.previousImportT1;
        }
    });

    if (!isReadyForMinute && (previousImportT1MinuteInit || previousImportedEnergyMinuteInit)) {
        winsLog('Consumption for the last minute has been successfully calculated.', 'info', 'run');
        isReadyForMinute = true;
    }
};

/* -------------------------------------------------------------------------- */
/*                             Health and Readiness                           */
/* -------------------------------------------------------------------------- */
let appHealth = require('express')();

appHealth.get('/health', (req, res) => {
    if (isReady && isReadyForMinute) {
        res.status(200).send('OK');
    } else {
        res.status(503).send('Service Unavailable');
    }
});

appHealth.listen(9200, '0.0.0.0', () => {
    winsLog('Health check server running on port 9200', 'info', 'run');
});

/* -------------------------------------------------------------------------- */
/*                          Express Routes and Server                         */
/* -------------------------------------------------------------------------- */
app.use(express.json()); // Pour parser le JSON dans les requêtes POST

// Middleware pour vérifier le token Bearer
const BEARER_TOKEN = 'L2cYTDv)RTC3iA0Cuc$w';
app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'Missing Authorization Header' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== BEARER_TOKEN) {
        return res.status(403).json({ message: 'Invalid Bearer Token' });
    }

    next();
});

// Endpoint GET pour récupérer tous les targets
app.get('/get-targets', (req, res) => {
    const targetsForResponse = targets.map(target => {
        const { previousImportedEnergyMinute, ...targetWithoutInternal } = target;
        return targetWithoutInternal;
    });
    res.json(targetsForResponse);
});

// Endpoint POST pour récupérer un target par nom
app.post('/get-target', (req, res) => {
    const name = req.body.name;
    if (!name) {
        return res.status(400).json({ message: 'Name is required' });
    }

    const target = targets.find(t => t.name === name);
    if (!target) {
        return res.status(404).json({ message: `Target with name ${name} not found` });
    }

    const { previousImportedEnergyMinute, ...targetWithoutInternal } = target;
    res.json(targetWithoutInternal);
});

// Lancer le serveur principal
app.listen(port, () => {
    winsLog(`Server is running on port ${port}`, 'info', 'run');
});

/* -------------------------------------------------------------------------- */
/*                                     run                                    */
/* -------------------------------------------------------------------------- */
run().then(() => {
    setInterval(run, 60 * 1000);
});
