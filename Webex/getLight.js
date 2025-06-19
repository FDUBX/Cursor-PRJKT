import xapi from 'xapi';

function updateLevel(newLevel) {
  xapi.command('UserInterface Extensions Widget SetValue', {
    WidgetId: 'Light',
    Value: newLevel * 255 / 100,
  });
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


function sendHttpGet() {
  const url = 'https://desigo-service.avl.mdom.net/light/System1%25253AGmsDevice_1_2005_121635707'; // Corrected URL encoding
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const requestBody = {
  };
  const headers = [`Authorization: Bearer ${bearerToken}`,
    `Content-Type: application/json`];

  xapi.command('HttpClient Get', {
    Url: url,
    Header: headers,
    AllowInsecureHTTPS: 'True'
  }, JSON.stringify(requestBody))
    .then(response => {
      if (response.StatusCode === "200") {
        console.log('Requête réussie !');
        console.log(`Level : ${response.Body}`);
        // let actualLevel = response.Body
        updateLevel(response.Body)
      } else {
        console.error(`Échec de la requête. Code d'état : ${response.StatusCode}`);
      }
    })
    .catch(error => {
      // console.error(`Erreur lors de l'envoi de la requête : ${error.message}, ${error.StatusCode}`);
      console.error(error);
    });
}



setInterval(sendHttpGet, 5 * 60  * 1000); 