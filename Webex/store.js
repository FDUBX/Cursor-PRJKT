import xapi from 'xapi';

function sendHttpPost(storeValue, address) {
  const url = address;
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const requestBody = {
    value: storeValue,
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
        console.log(`Valeur du store à : ${storeValue}`);
      } else {
        console.error(`Échec de la requête. Code d'état : ${response.StatusCode}`);
      }
    })
    .catch(error => {
      console.error(`Erreur lors de l'envoi de la requête : ${error.message}, ${error.StatusCode}`);
      console.error(error);
    });
}

const store1 = 'https://desigo-service.avl.mdom.net/store/System1%25253AGmsDevice_1_2005_121636463';
const store2 = 'https://desigo-service.avl.mdom.net/store/System1%25253AGmsDevice_1_2005_121636451';
const store3 = 'https://desigo-service.avl.mdom.net/store/System1%25253AGmsDevice_1_2005_121636487';
const store4 = 'https://desigo-service.avl.mdom.net/store/System1%25253AGmsDevice_1_2005_121636523';
const store5 = 'https://desigo-service.avl.mdom.net/store/System1%25253AGmsDevice_1_2005_121636535';
const store6 = 'https://desigo-service.avl.mdom.net/store/System1%25253AGmsDevice_1_2005_121636499';
const store7 = 'https://desigo-service.avl.mdom.net/store/System1%25253AGmsDevice_1_2005_121636511';

function storeControl(event) {
  if (event.WidgetId === 'storeEst' && event.Type === 'changed' && event.Value === 'on') {
    console.log("Store Est à 100%");
    sendHttpPost(100, store1);
    setTimeout(() => {
      sendHttpPost(100, store2);
      setTimeout(() => {
        sendHttpPost(100, store3);
        setTimeout(() => {
          sendHttpPost(100, store4);
        }, 1000);
      }, 1000);
    }, 1000);
    return;
  }
  if (event.WidgetId === 'storeEst' && event.Type === 'changed' && event.Value === 'off') {
    console.log("Store Est à 0%");
    sendHttpPost(0, store1);
    setTimeout(() => {
      sendHttpPost(0, store2);
      setTimeout(() => {
        sendHttpPost(0, store3);
        setTimeout(() => {
          sendHttpPost(0, store4);
        }, 1000);
      }, 1000);
    }, 1000);
    return;
  }
  if (event.WidgetId === 'storeOuest' && event.Type === 'changed' && event.Value === 'on') {
    console.log("Store Ouest à 100%");
    sendHttpPost(100, store5);
    setTimeout(() => {
      sendHttpPost(100, store6);
      setTimeout(() => {
        sendHttpPost(100, store7);
      }, 1000);
    }, 1000);
    return;
  }
  if (event.WidgetId === 'storeOuest' && event.Type === 'changed' && event.Value === 'off') {
    console.log("Store Ouest à 0%");
    sendHttpPost(0, store5);
    setTimeout(() => {
      sendHttpPost(0, store6);
      setTimeout(() => {
        sendHttpPost(0, store7);
      }, 1000);
    }, 1000);
    return;
  }
}

xapi.Event.UserInterface.Extensions.Widget.Action.on(storeControl); 