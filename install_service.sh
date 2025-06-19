#!/bin/bash

# Créer le dossier LaunchAgents s'il n'existe pas
mkdir -p ~/Library/LaunchAgents

# Copier le fichier de configuration
cp com.millennium.videotranscoder.plist ~/Library/LaunchAgents/

# Charger le service
launchctl load ~/Library/LaunchAgents/com.millennium.videotranscoder.plist

# Démarrer le service
launchctl start com.millennium.videotranscoder

echo "Service installé et démarré. Les logs seront dans video_transcoder.log" 