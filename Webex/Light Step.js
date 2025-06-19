import xapi from 'xapi';

function sendHttpPost(lightLevel) {
  updateLevel(lightLevel) 
  const url = 'https://desigo-service.avl.mdom.net/light/System1%25253AGmsDevice_1_2005_121635707'; // Corrected URL encoding
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
  xapi.command('UserInterface Extensions Widget SetValue', {
    WidgetId: 'Light',
    Value: newLevel * 255 / 100,
  });
}


function lightStep(event) {
  if (event.WidgetId === 'LightStep' && event.Value === '25' && event.Type === 'pressed') {
    console.log("25%");
    sendHttpPost(25);
    return;
  }
  if (event.WidgetId === 'LightStep' && event.Value === '50' && event.Type === 'pressed') {
    console.log("50%");
    sendHttpPost(50);
    return;
  }
  if (event.WidgetId === 'LightStep' && event.Value === '75' && event.Type === 'pressed') {
    console.log("75%");
    sendHttpPost(75);
    return;
  }
  if (event.WidgetId === 'LightStep' && event.Value === '100' && event.Type === 'pressed') {
    console.log("100%");
    sendHttpPost(100);
    return;
  }
  if (event.WidgetId === 'LightStep' && event.Value === '0' && event.Type === 'pressed') {
    console.log("0%");
    sendHttpPost(0);
    return;
  }
}

xapi.Event.UserInterface.Extensions.Widget.Action.on(lightStep);

