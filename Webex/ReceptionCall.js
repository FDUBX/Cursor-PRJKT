import xapi from 'xapi';


function panelEvent(event) {
  if (event.PanelId === 'helpCall') {
    console.log("TEST")
    xapi.Command.Dial({ Number: '+41584007036' });
  }
}


xapi.Event.UserInterface.Extensions.Panel.Clicked.on(panelEvent);