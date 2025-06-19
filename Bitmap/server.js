const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const API_URL = process.env.HOSTNAME;
const app = express();

// Configuration Azure
const AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=millenniumopsignage;AccountKey=OK8Nm5Lue73PvCoBEc/j76rvz+pfowwCgVQeeHIE1URMtxk3rVr+jCBmTcSIC3xMuguHS5JxSyyCdF5bB+ywZQ==;EndpointSuffix=core.windows.net';
const CONTAINER_NAME = 'millennium-fontaine';

// Configuration Multer pour le traitement des fichiers
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Créer le client Blob Service
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// Route pour lister les blobs
app.get('/list-blobs', async (req, res) => {
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
app.delete('/delete-blob/:blobName', async (req, res) => {
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
app.post('/upload', upload.single('image'), async (req, res) => {
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