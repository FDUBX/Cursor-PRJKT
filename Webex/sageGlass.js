import xapi from 'xapi';

function sendHttpPost(sageMode, address) {
  const url = address; // Corrected URL encoding
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const requestBody = {
    proxyString: sageMode,
    priority: 8
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
        console.log(`Mode SageGlass à : ${sageMode}`);
      } else {
        console.error(`Échec de la requête. Code d'état : ${response.StatusCode}`);
      }
    })
    .catch(error => {
      console.error(`Erreur lors de l'envoi de la requête : ${error.message}, ${error.StatusCode}`);
      console.error(error);
    });
}

const verre1 = 'https://desigo-service.avl.mdom.net/sageGlass/System1%25253AGmsDevice_1_100_79712100';
const verre2 = 'https://desigo-service.avl.mdom.net/sageGlass/System1%25253AGmsDevice_1_100_54536293';
const verre3 = 'https://desigo-service.avl.mdom.net/sageGlass/System1%25253AGmsDevice_1_100_79712101';
const verre4 = 'https://desigo-service.avl.mdom.net/sageGlass/System1%25253AGmsDevice_1_100_79712102';

function sageModeStep(event) {
  if (event.WidgetId === 'sageModeEst' && event.Value === 'Auto' && event.Type === 'pressed') {
    console.log("Auto");
    sendHttpPost("auto", verre1);
    // setTimeout(() => {
    //   sendHttpPost("auto", verre2);
    // }, 1000);
    return;
  }
  if (event.WidgetId === 'sageModeEst' && event.Value === 'Gradient' && event.Type === 'pressed') {
    console.log("Gradient");
    sendHttpPost("gradient", verre1);
    // setTimeout(() => {
    //   sendHttpPost("gradient", verre2);
    // }, 1000);
    return;
  }
  if (event.WidgetId === 'sageModeEst' && event.Value === 'Dark' && event.Type === 'pressed') {
    console.log("Dark");
    sendHttpPost("dark", verre1);
    // setTimeout(() => {
    //   sendHttpPost("dark", verre2);
    // }, 1000);
    return;
  }
  if (event.WidgetId === 'sageModeEst' && event.Value === 'Light' && event.Type === 'pressed') {
    console.log("Light");
    sendHttpPost("light", verre1);
    // setTimeout(() => {
    //   sendHttpPost("light", verre2);
    // }, 1000);
    return;
  }
  if (event.WidgetId === 'sageModeOuest' && event.Value === 'Auto' && event.Type === 'pressed') {
    console.log("Auto");
      sendHttpPost("auto", verre3);
    setTimeout(() => {
      sendHttpPost("auto", verre4);
    }, 1000);
    return;
  }
  if (event.WidgetId === 'sageModeOuest' && event.Value === 'Gradient' && event.Type === 'pressed') {
    console.log("Gradient");
      sendHttpPost("gradient", verre3);
    setTimeout(() => {
      sendHttpPost("gradient", verre4);
    }, 1000);
    return;
  }
  if (event.WidgetId === 'sageModeOuest' && event.Value === 'Dark' && event.Type === 'pressed') {
    console.log("Dark");
      sendHttpPost("dark", verre3);
    setTimeout(() => {
      sendHttpPost("dark", verre4);
    }, 1000);
    return;
  }
  if (event.WidgetId === 'sageModeOuest' && event.Value === 'Light' && event.Type === 'pressed') {
    console.log("Light");
      sendHttpPost("light", verre3);
    setTimeout(() => {
      sendHttpPost("light", verre4);
    }, 1000);
    return;
  }
}
xapi.Event.UserInterface.Extensions.Widget.Action.on(sageModeStep);
