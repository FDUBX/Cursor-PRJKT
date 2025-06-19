# Video Transcoder avec LUT

Ce script surveille un dossier et transcodage automatiquement les fichiers vidéo qui y sont ajoutés.

## Prérequis

- Python 3.x
- ffmpeg installé sur votre système
- Une LUT au format .cube

## Installation

1. Installez les dépendances Python :
```bash
pip install -r requirements.txt
```

2. Assurez-vous que ffmpeg est installé sur votre système :
```bash
brew install ffmpeg
```

## Configuration

Modifiez les chemins dans le script `video_transcoder.py` :
- `input_dir` : Dossier à surveiller
- `output_dir` : Dossier où seront sauvegardés les fichiers transcodés
- `processed_dir` : Dossier où seront déplacés les fichiers originaux après traitement
- `lut_path` : Chemin vers votre fichier LUT (.cube)

## Utilisation

1. Modifiez les chemins dans le script selon votre configuration
2. Exécutez le script :
```bash
python video_transcoder.py
```

Le script surveillera le dossier d'entrée et traitera automatiquement tout nouveau fichier vidéo ajouté.

## Fonctionnalités

- Surveillance automatique du dossier
- Transcodage en H.265 (HEVC)
- Application d'une LUT
- Conservation de la résolution d'origine
- Renommage automatique avec suffixe "_LUT"
- Déplacement des fichiers originaux vers un dossier de traitement

## Formats vidéo supportés

- MP4
- MOV
- AVI
- MKV 