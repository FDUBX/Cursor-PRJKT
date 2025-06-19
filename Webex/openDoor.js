import xapi from 'xapi';

function sendHttpPost() {
  const url = 'https://desigo-service.avl.mdom.net/open-door/System1%25253AKaba_01_I02006701_DR';
  const bearerToken = 'k>jrunkUD7fnoPa[].65';
  const requestBody = {
    value: 2,
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
        console.log("PORTE OUVERTE");
      } else {
        console.error(`Échec de la requête. Code d'état : ${response.StatusCode}`);
      }
    })
    .catch(error => {
      console.error(`Erreur lors de l'envoi de la requête : ${error.message}, ${error.StatusCode}`);
      console.error(error);
    });
}

function doorFunc(event) {
  if (event.WidgetId === 'openDoor' && event.Type === 'clicked') {
    console.log("open door");
    sendHttpPost()
    return;
  }
  if (event.PanelId === 'openDoor') {
    console.log("open door");
    sendHttpPost()
    return;
  }
}

xapi.Event.UserInterface.Extensions.Widget.Action.on(doorFunc);

xapi.Event.UserInterface.Extensions.Panel.Clicked.on(doorFunc);