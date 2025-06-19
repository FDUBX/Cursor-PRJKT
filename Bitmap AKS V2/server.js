const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();
const dotenv = require('dotenv');
const basicAuth = require('express-basic-auth');

dotenv.config();

// Configuration Azure
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'millennium-fontaine';
const BASIC_AUTH_USERNAME = process.env.BASIC_AUTH_USERNAME || 'admin';
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || 'password';

// Vérification des variables d'environnement requises
if (!AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING doit être définie dans les variables d\'environnement');
}

// Configuration de l'authentification basique
const auth = basicAuth({
    users: { [BASIC_AUTH_USERNAME]: BASIC_AUTH_PASSWORD },
    challenge: true,
    realm: 'Millennium Fontaine'
});

// Configuration Multer pour le traitement des fichiers
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Créer le client Blob Service
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// Protection de toutes les routes avec l'authentification basique
app.use(auth);

// Servir les fichiers statiques depuis le dossier www
app.use(express.static(path.join(__dirname, 'www')));

// Route pour fournir les credentials d'authentification
app.get('/auth-config', auth, (req, res) => {
    res.json({
        username: BASIC_AUTH_USERNAME,
        password: BASIC_AUTH_PASSWORD
    });
});

// Route pour lister les blobs
app.get('/list-blobs', auth, async (req, res) => {
    try {
        const blobs = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            const blobClient = containerClient.getBlobClient(blob.name);
            blobs.push({
                name: blob.name,
                url: blobClient.url,
                lastModified: blob.properties.lastModified
            });
        }
        res.json(blobs);
    } catch (error) {
        console.error('Erreur lors de la récupération des blobs:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des blobs' });
    }
});

// Route pour supprimer un blob
app.delete('/delete-blob/:blobName', auth, async (req, res) => {
    try {
        const blobName = req.params.blobName;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
        res.json({ message: 'Blob supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du blob:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du blob' });
    }
});

// Route pour uploader directement via le serveur
app.post('/upload', auth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('Aucun fichier reçu');
        }

        const fileName = req.file.originalname;
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        
        // Upload le fichier
        await blockBlobClient.upload(req.file.buffer, req.file.size, {
            blobHTTPHeaders: {
                blobContentType: 'image/png'
            }
        });
        
        // Retourner l'URL publique du blob
        const publicUrl = `https://millenniumopsignage.blob.core.windows.net/${CONTAINER_NAME}/${fileName}`;
        res.json({ url: publicUrl });
    } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
}); 