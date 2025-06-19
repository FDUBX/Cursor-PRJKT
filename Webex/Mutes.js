import xapi from 'xapi';

function muteFunc(event) {
  if (event.WidgetId === 'muteMic' && event.Type === 'changed' && event.Value === 'on') {
    console.log("Mic Muted");
    xapi.Command.Audio.Microphones.Mute();
    return;
  }
  if (event.WidgetId === 'muteMic' && event.Type === 'changed' && event.Value === 'off') {
    console.log("Mic UnMuted");
    xapi.Command.Audio.Microphones.Unmute();
    return;
  }
  if (event.WidgetId === 'muteButton' && event.Type === 'changed' && event.Value === 'on') {
    console.log("Mic Muted");
    xapi.Command.Audio.Microphones.Mute();
    return;
  }
  if (event.WidgetId === 'muteButton' && event.Type === 'changed' && event.Value === 'off') {
    console.log("Mic UnMuted");
    xapi.Command.Audio.Microphones.Unmute();
    return;
  }
}

xapi.Event.UserInterface.Extensions.Widget.Action.on(muteFunc);