# BACpypes COV Subscriber

Ce projet permet de s'abonner aux changements de valeur (COV - Change of Value) d'un objet BACnet.

## Prérequis

- Python 3.6 ou supérieur
- pip (gestionnaire de paquets Python)

## Installation

1. Cloner le repository
2. Installer les dépendances :
```bash
pip install -r requirements.txt
```

## Configuration

Les paramètres de configuration se trouvent dans le fichier `cov_subscriber.py` :

- `DEVICE_ID` : ID du device local
- `DEVICE_NAME` : Nom du device local
- `VENDOR_ID` : ID du vendeur
- `TARGET_IP` : Adresse IP du device cible
- `TARGET_DEVICE_ID` : ID du device cible
- `TARGET_OBJECT_TYPE` : Type d'objet (260 pour Binary Value)
- `TARGET_OBJECT_INSTANCE` : Instance de l'objet

## Utilisation

Pour lancer l'application :

```bash
python cov_subscriber.py
```

L'application va :
1. Se connecter au device BACnet cible
2. S'abonner aux changements de valeur de l'objet spécifié
3. Afficher les notifications de changement de valeur reçues

## Fonctionnalités

- Abonnement COV à un objet BACnet
- Réception des notifications de changement de valeur
- Affichage des nouvelles valeurs
- Gestion des erreurs de connexion 