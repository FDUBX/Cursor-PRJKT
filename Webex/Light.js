import xapi from 'xapi';

function sendHttpPost(lightLevel) {
  updateLevel(lightLevel);
  const url = 'https://desigo-service.avl.mdom.net/light/System1%25253AGmsDevice_1_2005_121635707';
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const requestBody = {
    value: lightLevel,
    priority: 13
  };
  const headers = [`Authorization: Bearer ${bearerToken}`,
    `Content-Type: application/json`];

  xapi.command('HttpClient Post', {
    Url: url,
    Header: headers,
    AllowInsecureHTTPS: 'True'
  }, JSON.stringify(requestBody))
    .then(response => {
      if (response.StatusCode === "200") {
        console.log('Requête réussie !');
        console.log(`Niveau de Lumière à : ${lightLevel}`);
      } else {
        console.error(`Échec de la requête. Code d'état : ${response.StatusCode}`);
      }
    })
    .catch(error => {
      console.error(`Erreur lors de l'envoi de la requête : ${error.message}, ${error.StatusCode}`);
      console.error(error);
    });
}

function updateLevel(newLevel) {
  if (newLevel == 0) {
    xapi.command('UserInterface Extensions Widget SetValue', {
      WidgetId: 'LightStep',
      value: '0'
    });
  }
  else if (newLevel > 0 && newLevel <= 35) {
    xapi.command('UserInterface Extensions Widget SetValue', {
      WidgetId: 'LightStep',
      value: '25'
    });
  }
  else if (newLevel > 35 && newLevel <= 65) {
    xapi.command('UserInterface Extensions Widget SetValue', {
      WidgetId: 'LightStep',
      value: '50'
    });
  }
  else if (newLevel > 65 && newLevel < 100) {
    xapi.command('UserInterface Extensions Widget SetValue', {
      WidgetId: 'LightStep',
      value: '75'
    });
  }
  else if (newLevel == 100) {
    xapi.command('UserInterface Extensions Widget SetValue', {
      WidgetId: 'LightStep',
      value: '100'
    });
  }
}

function convertData(data) {
  return Math.round((data / 255) * 100);
}

let level = null;

function onLevelChange(newValue) {
  console.log("Nouvelle valeur de level :", newValue);
  sendHttpPost(newValue)
}

function setLevel(newValue) {
  if (level !== newValue) {
    level = newValue;
    onLevelChange(level);
  }
}


function controlData(data) {
  const convertedData = convertData(data);
  if (convertedData == 0) {
    setLevel(0)
  } else if (convertedData > 10 && convertedData <= 20) {
    setLevel(10)
  } else if (convertedData > 20 && convertedData <= 30) {
    setLevel(20)
  } else if (convertedData > 30 && convertedData <= 40) {
    setLevel(30)
  } else if (convertedData > 40 && convertedData <= 50) {
    setLevel(40)
  } else if (convertedData > 50 && convertedData <= 60) {
    setLevel(50)
  } else if (convertedData > 60 && convertedData <= 70) {
    setLevel(60)
  } else if (convertedData > 70 && convertedData <= 80) {
    setLevel(70)
  } else if (convertedData > 80 && convertedData <= 90) {
    setLevel(80)
  } else if (convertedData > 90 && convertedData < 100) {
    setLevel(90)
  } else if (convertedData == 100) {
    setLevel(100)
  }
}

xapi.event.on('UserInterface Extensions Widget Action', (event) => {
  if (event.WidgetId === 'Light') {
    const data = parseInt(event.Value);
    controlData(data);
  }
});