import xapi from 'xapi';

const OFFSET_CHAUD_FROID = 2;
const urlHot = 'https://desigo-service.avl.mdom.net/climate/System1%25253AGmsDevice_1_2005_121636333';
const urlCold = 'https://desigo-service.avl.mdom.net/climate/System1%25253AGmsDevice_1_2005_121636339';
const urlReleaseHot = 'https://desigo-service.avl.mdom.net/climateReleasePrio/System1%25253AGmsDevice_1_2005_121636333';
const urlReleaseCold = 'https://desigo-service.avl.mdom.net/climateReleasePrio/System1%25253AGmsDevice_1_2005_121636339';

function updateConsigneWidget(value) {
  xapi.command('UserInterface Extensions Widget SetValue', {
    WidgetId: 'actualConsigne',
    value: Math.round(value * 10) / 10 + "°C"
  });
}

function sendHttpPost(setpoint) {
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const headers = [`Authorization: Bearer ${bearerToken}`,
    `Content-Type: application/json`];

  // Envoi de la consigne chaud
  const postBodyChaud = {
    value: setpoint,
    mode: "hot"
  };

  console.log('Envoi requête chaud:', {
    url: urlHot,
    body: postBodyChaud
  });

  // Première requête (chaud)
  xapi.command('HttpClient Post', {
    Url: urlHot,
    Header: headers,
    AllowInsecureHTTPS: 'True'
  }, JSON.stringify(postBodyChaud))
    .then(response => {
      if (response.StatusCode === "200") {
        console.log('Requête chaud réussie !');
        // Deuxième requête (froid)
        const postBodyFroid = {
          value: setpoint + OFFSET_CHAUD_FROID,
          mode: "cold"
        };
        console.log('Envoi requête froid:', {
          url: urlCold,
          body: postBodyFroid
        });
        return xapi.command('HttpClient Post', {
          Url: urlCold,
          Header: headers,
          AllowInsecureHTTPS: 'True'
        }, JSON.stringify(postBodyFroid));
      } else {
        console.error(`Échec de la requête chaud. Code d'état : ${response.StatusCode}`);
        console.error('Réponse complète:', response);
        throw new Error(`Échec de la requête chaud: ${response.StatusCode}`);
      }
    })
    .then(response => {
      if (response && response.StatusCode === "200") {
        console.log('Requête froid réussie !');
        console.log(`Consigne de température mise à : ${setpoint}°C`);
        updateConsigneWidget(setpoint);
      } else if (response) {
        console.error(`Échec de la requête froid. Code d'état : ${response.StatusCode}`);
        console.error('Réponse complète:', response);
        throw new Error(`Échec de la requête froid: ${response.StatusCode}`);
      }
    })
    .catch(error => {
      console.error(`Erreur lors de l'envoi de la requête : ${error.message}`);
      console.error('Erreur complète:', error);
    });
}

function releasePriority() {
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const headers = [`Authorization: Bearer ${bearerToken}`,
    `Content-Type: application/json`];

  const requestBodyChaud = {
    priority: 13,
    mode: "hot"
  };

  xapi.command('HttpClient Post', {
    Url: urlReleaseHot,
    Header: headers,
    AllowInsecureHTTPS: 'True'
  }, JSON.stringify(requestBodyChaud))
    .then(response => {
      if (response.StatusCode === "200") {
        console.log('Release chaud réussi');
        setTimeout(() => {
          const requestBodyFroid = {
            priority: 13,
            mode: "cold"
          };
          return xapi.command('HttpClient Post', {
            Url: urlReleaseCold,
            Header: headers,
            AllowInsecureHTTPS: 'True'
          }, JSON.stringify(requestBodyFroid));
        }, 1000);
      } else {
        console.error(`Échec du release chaud. Code d'état : ${response.StatusCode}`);
        console.error('Réponse complète:', response);
      }
    })
    .then(response => {
      if (response && response.StatusCode === "200") {
        console.log('Release froid réussi');
      } else if (response) {
        console.error(`Échec du release froid. Code d'état : ${response.StatusCode}`);
        console.error('Réponse complète:', response);
      }
    })
    .catch(error => {
      console.error(`Erreur lors du release : ${error.message}`);
      console.error('Erreur complète:', error);
    });
}

// Fonction pour récupérer la consigne actuelle
function getCurrentSetpoint() {
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const headers = [`Authorization: Bearer ${bearerToken}`,
    `Content-Type: application/json`];

  return xapi.command('HttpClient Get', {
    Url: urlHot,
    Header: headers,
    AllowInsecureHTTPS: 'True'
  }, JSON.stringify({}))
  .then(response => {
    if (response.StatusCode === "200") {
      const setpoint = parseFloat(response.Body);
      updateConsigneWidget(setpoint);
      return setpoint;
    } else {
      throw new Error(`Échec de la requête. Code d'état : ${response.StatusCode}`);
    }
  })
  .catch(error => {
    console.error('Erreur lors de la lecture de la consigne actuelle:', error);
    console.error('Erreur complète:', error);
    throw error;
  });
}

// Fonction pour augmenter la température de 2°C
function increaseTemp() {
  getCurrentSetpoint()
  .then(currentSetpoint => {
    if (currentSetpoint >= 23) {
      console.log('Impossible d\'augmenter la température au-delà de 23°C');
      return;
    }
    const newSetpoint = currentSetpoint + 1;
    sendHttpPost(newSetpoint);
  })
  .catch(error => {
    console.error('Impossible d\'augmenter la température:', error);
  });
}

// Fonction pour diminuer la température de 2°C
function decreaseTemp() {
  getCurrentSetpoint()
  .then(currentSetpoint => {
    if (currentSetpoint <= 17) {
        console.log('Impossible d\'augmenter la température en dessous de 17°C');
        return;
    }    
    const newSetpoint = currentSetpoint - 1;
    sendHttpPost(newSetpoint);
  })
  .catch(error => {
    console.error('Impossible de diminuer la température:', error);
  });
}

// Fonction pour calculer le temps jusqu'au prochain minuit
function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(22, 0, 0, 0);
  return midnight - now;
}

// Fonction pour programmer le release quotidien
function scheduleDailyRelease() {
  // Exécuter le release immédiatement
  // releasePriority();
  
  // Programmer le prochain release à minuit
  const timeUntilMidnight = getTimeUntilMidnight();
  setTimeout(() => {
    // Exécuter le release
    releasePriority();
    
    // Programmer le prochain release pour le jour suivant
    setInterval(releasePriority, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);
}

// Écouteurs d'événements pour les boutons d'augmentation et de diminution
xapi.event.on('UserInterface Extensions Widget Action', (event) => {
  if (event.WidgetId === 'increaseTemp') {
    increaseTemp();
  } else if (event.WidgetId === 'decreaseTemp') {
    decreaseTemp();
  } else if (event.WidgetId === 'releaseTemp') {
    releasePriority();
  }
});

// Mise à jour périodique de la consigne affichée
setInterval(() => {
  getCurrentSetpoint()
    .catch(error => {
      console.error('Erreur lors de la mise à jour périodique de la consigne:', error);
    });
}, 1 * 60 * 1000); // Mise à jour toutes les minutes

// Mise à jour initiale de la consigne
getCurrentSetpoint();

// Démarrer le programme de release quotidien
scheduleDailyRelease(); 