import xapi from 'xapi';

function updateLevel(newLevel) {
  xapi.command('UserInterface Extensions Widget SetValue', {
    WidgetId: 'temp',
    Value: Math.round(newLevel * 10) / 10 + "°C",
  });
  }

function sendHttpGet() {
  const url = 'https://desigo-service.avl.mdom.net/genericRtemp/System1%25253AGmsDevice_1_2005_121636319'; // Corrected URL encoding
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



setInterval(sendHttpGet, 5 * 60 * 1000); 