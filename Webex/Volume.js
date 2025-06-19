import xapi from 'xapi';

function convertVolume(volumeLevel) {
  return Math.round((volumeLevel / 255) * 100);
}

function controlVolume(volumeLevel) {
  const convertedVolume = convertVolume(volumeLevel);
  xapi.command('Audio Volume Set', { Level: convertedVolume });
}

xapi.event.on('UserInterface Extensions Widget Action', (event) => {
    if (event.WidgetId === 'Volume') {
        const volumeLevel = parseInt(event.Value);
        controlVolume(volumeLevel);
    }
});
