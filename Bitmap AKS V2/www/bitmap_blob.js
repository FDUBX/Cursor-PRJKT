// Variables globales
let originalCanvas = null;
let originalCtx = null;
let bitmapCanvas = null;
let bitmapCtx = null;
let isInverted = false;  // Nouvelle variable pour suivre l'état d'inversion

// Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin; // En production, utilise le même domaine que la page

// Configuration de l'authentification
let AUTH_HEADER = null;

// Fonction pour initialiser l'authentification
async function initAuth() {
    try {
        const response = await fetch(`${API_URL}/auth-config`);
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des credentials');
        }
        const { username, password } = await response.json();
        AUTH_HEADER = 'Basic ' + btoa(username + ':' + password);
    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        alert('Erreur d\'authentification. Veuillez recharger la page.');
    }
}

// Fonction pour trouver les bords du logo
function findLogoBounds(imageData, width, height) {
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    
    const data = imageData.data;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // Calculer la luminosité
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            // Si le pixel n'est pas blanc (255,255,255) ou si l'image est inversée et le pixel n'est pas noir (0,0,0)
            if ((!isInverted && brightness < 255) || (isInverted && brightness > 0)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    return { minX, maxX, minY, maxY };
}

// Fonction pour convertir une image en bitmap noir et blanc
function convertToBitmap(imageFile, threshold = 128) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Créer un canvas temporaire pour l'analyse initiale
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            // Désactiver le lissage pour le canvas temporaire
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.webkitImageSmoothingEnabled = false;
            tempCtx.mozImageSmoothingEnabled = false;
            
            // Dessiner l'image originale pour obtenir les données
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            
            // Obtenir les données de l'image
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Trouver les bords du logo
            const bounds = findLogoBounds(imageData, tempCanvas.width, tempCanvas.height);
            
            // Calculer la largeur et hauteur du logo
            const logoWidth = bounds.maxX - bounds.minX;
            const logoHeight = bounds.maxY - bounds.minY;
            
            // Calculer le ratio d'aspect
            const ratio = logoWidth / logoHeight;
            
            // Obtenir la largeur cible depuis l'input
            const targetWidth = parseInt(document.getElementById('targetWidth').value) || 300;
            
            // Calculer la hauteur cible en conservant le ratio
            const targetHeight = Math.round(targetWidth / ratio);
            
            // Créer le canvas pour l'image originale
            originalCanvas = document.createElement('canvas');
            originalCtx = originalCanvas.getContext('2d');
            originalCanvas.width = targetWidth;
            originalCanvas.height = targetHeight;
            
            // Désactiver le lissage pour le canvas original
            originalCtx.imageSmoothingEnabled = false;
            originalCtx.webkitImageSmoothingEnabled = false;
            originalCtx.mozImageSmoothingEnabled = false;
            
            // Créer le canvas pour le bitmap
            bitmapCanvas = document.createElement('canvas');
            bitmapCtx = bitmapCanvas.getContext('2d');
            bitmapCanvas.width = targetWidth;
            bitmapCanvas.height = targetHeight;
            
            // Désactiver le lissage pour le canvas bitmap
            bitmapCtx.imageSmoothingEnabled = false;
            bitmapCtx.webkitImageSmoothingEnabled = false;
            bitmapCtx.mozImageSmoothingEnabled = false;
            
            // Dessiner uniquement la partie utile du logo sur le canvas original
            originalCtx.drawImage(
                tempCanvas,
                bounds.minX, bounds.minY, logoWidth, logoHeight,
                0, 0, targetWidth, targetHeight
            );
            
            // Mettre à jour l'aperçu
            updatePreview(threshold);
            
            resolve(bitmapCanvas);
        };
        
        img.onerror = reject;
        img.src = URL.createObjectURL(imageFile);
    });
}

// Fonction pour mettre à jour l'aperçu
function updatePreview(threshold) {
    if (!originalCanvas || !originalCtx || !bitmapCanvas || !bitmapCtx) return;
    
    // Copier l'image originale sur le canvas bitmap
    bitmapCtx.drawImage(originalCanvas, 0, 0);
    
    // Obtenir les données de l'image
    const imageData = bitmapCtx.getImageData(0, 0, bitmapCanvas.width, bitmapCanvas.height);
    const data = imageData.data;
    
    // Convertir en noir et blanc avec le seuil spécifié
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        let value = brightness > threshold ? 255 : 0;
        
        // Inverser la valeur si nécessaire
        if (isInverted) {
            value = 255 - value;
        }
        
        data[i] = value;     // Rouge
        data[i + 1] = value; // Vert
        data[i + 2] = value; // Bleu
    }
    
    // Mettre à jour l'image avec les nouvelles données
    bitmapCtx.putImageData(imageData, 0, 0);
    
    // Mettre à jour l'aperçu
    const bitmapPreview = document.getElementById('bitmapPreview');
    bitmapPreview.src = bitmapCanvas.toDataURL();
}

// Fonction pour créer un bitmap monochrome 1-bit
function createMonochromeBitmap(width, height, imageData) {
    // Calcul des tailles
    const headerSize = 14;
    const infoSize = 40;
    const paletteSize = 8;
    const bytesPerRow = Math.ceil(width / 8);
    const padding = (4 - (bytesPerRow % 4)) % 4;
    const rowSize = bytesPerRow + padding;
    const imageDataSize = rowSize * height;
    const fileSize = headerSize + infoSize + paletteSize + imageDataSize;

    // Création du buffer pour le fichier BMP complet
    const bmpBuffer = new Uint8Array(fileSize);

    // En-tête du fichier BMP (14 bytes)
    bmpBuffer[0] = 'B'.charCodeAt(0);
    bmpBuffer[1] = 'M'.charCodeAt(0);
    // Taille du fichier (4 bytes, little-endian)
    bmpBuffer[2] = fileSize & 0xff;
    bmpBuffer[3] = (fileSize >> 8) & 0xff;
    bmpBuffer[4] = (fileSize >> 16) & 0xff;
    bmpBuffer[5] = (fileSize >> 24) & 0xff;
    // Réservé (4 bytes)
    bmpBuffer[6] = 0;
    bmpBuffer[7] = 0;
    bmpBuffer[8] = 0;
    bmpBuffer[9] = 0;
    // Offset des données (4 bytes)
    const dataOffset = headerSize + infoSize + paletteSize;
    bmpBuffer[10] = dataOffset & 0xff;
    bmpBuffer[11] = (dataOffset >> 8) & 0xff;
    bmpBuffer[12] = (dataOffset >> 16) & 0xff;
    bmpBuffer[13] = (dataOffset >> 24) & 0xff;

    // Info header (40 bytes)
    // Taille de l'info header (4 bytes)
    bmpBuffer[14] = infoSize & 0xff;
    bmpBuffer[15] = (infoSize >> 8) & 0xff;
    bmpBuffer[16] = (infoSize >> 16) & 0xff;
    bmpBuffer[17] = (infoSize >> 24) & 0xff;
    // Largeur (4 bytes)
    bmpBuffer[18] = width & 0xff;
    bmpBuffer[19] = (width >> 8) & 0xff;
    bmpBuffer[20] = (width >> 16) & 0xff;
    bmpBuffer[21] = (width >> 24) & 0xff;
    // Hauteur (4 bytes)
    bmpBuffer[22] = height & 0xff;
    bmpBuffer[23] = (height >> 8) & 0xff;
    bmpBuffer[24] = (height >> 16) & 0xff;
    bmpBuffer[25] = (height >> 24) & 0xff;
    // Plans (2 bytes)
    bmpBuffer[26] = 1;
    bmpBuffer[27] = 0;
    // Bits par pixel (2 bytes)
    bmpBuffer[28] = 1;
    bmpBuffer[29] = 0;
    // Compression (4 bytes)
    bmpBuffer[30] = 0;
    bmpBuffer[31] = 0;
    bmpBuffer[32] = 0;
    bmpBuffer[33] = 0;
    // Taille de l'image (4 bytes)
    bmpBuffer[34] = imageDataSize & 0xff;
    bmpBuffer[35] = (imageDataSize >> 8) & 0xff;
    bmpBuffer[36] = (imageDataSize >> 16) & 0xff;
    bmpBuffer[37] = (imageDataSize >> 24) & 0xff;
    // X pixels par mètre (4 bytes)
    const dpi = 2835; // 72 DPI
    bmpBuffer[38] = dpi & 0xff;
    bmpBuffer[39] = (dpi >> 8) & 0xff;
    bmpBuffer[40] = (dpi >> 16) & 0xff;
    bmpBuffer[41] = (dpi >> 24) & 0xff;
    // Y pixels par mètre (4 bytes)
    bmpBuffer[42] = dpi & 0xff;
    bmpBuffer[43] = (dpi >> 8) & 0xff;
    bmpBuffer[44] = (dpi >> 16) & 0xff;
    bmpBuffer[45] = (dpi >> 24) & 0xff;
    // Nombre de couleurs (4 bytes)
    bmpBuffer[46] = 2;
    bmpBuffer[47] = 0;
    bmpBuffer[48] = 0;
    bmpBuffer[49] = 0;
    // Couleurs importantes (4 bytes)
    bmpBuffer[50] = 2;
    bmpBuffer[51] = 0;
    bmpBuffer[52] = 0;
    bmpBuffer[53] = 0;

    // Palette (8 bytes)
    // Blanc
    bmpBuffer[54] = 0xFF;
    bmpBuffer[55] = 0xFF;
    bmpBuffer[56] = 0xFF;
    bmpBuffer[57] = 0;
    // Noir
    bmpBuffer[58] = 0;
    bmpBuffer[59] = 0;
    bmpBuffer[60] = 0;
    bmpBuffer[61] = 0;

    // Données de l'image
    for (let y = 0; y < height; y++) {
        const row = height - 1 - y; // BMP est stocké de bas en haut
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            const byteIndex = Math.floor(x / 8);
            const bitOffset = 7 - (x % 8);
            const bytePosition = dataOffset + (row * rowSize) + byteIndex;

            // Calculer la luminosité du pixel
            const brightness = (imageData[pixelIndex] + imageData[pixelIndex + 1] + imageData[pixelIndex + 2]) / 3;
            
            // Si le pixel est plus sombre que le seuil
            if (brightness < 128) {
                bmpBuffer[bytePosition] |= (1 << bitOffset);
            }
        }
    }

    return bmpBuffer;
}

// Fonction pour télécharger le bitmap vers Azure Blob Storage
async function uploadToAzureBlob(canvas) {
    try {
        // Créer un nouveau canvas de 320 pixels de large
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        finalCanvas.width = 320;
        finalCanvas.height = canvas.height;

        // Désactiver tous les effets de lissage
        finalCtx.imageSmoothingEnabled = false;
        finalCtx.webkitImageSmoothingEnabled = false;
        finalCtx.mozImageSmoothingEnabled = false;

        // Remplir le fond en blanc
        finalCtx.fillStyle = '#FFFFFF';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // Calculer la position x pour centrer le bitmap (arrondir à l'entier le plus proche)
        const xOffset = Math.round((320 - canvas.width) / 2);

        // Créer un canvas temporaire pour le bitmap
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        // Désactiver le lissage pour le canvas temporaire
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.webkitImageSmoothingEnabled = false;
        tempCtx.mozImageSmoothingEnabled = false;

        // Copier le bitmap original sur le canvas temporaire
        tempCtx.drawImage(canvas, 0, 0);

        // Obtenir les données du bitmap original
        const originalImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const originalData = originalImageData.data;

        // Forcer le noir et blanc pur sur le bitmap original
        for (let i = 0; i < originalData.length; i += 4) {
            const brightness = (originalData[i] + originalData[i + 1] + originalData[i + 2]) / 3;
            // Conversion en 1-bit (0 ou 255)
            const value = brightness > 127 ? 255 : 0;
            
            originalData[i] = value;     // Rouge
            originalData[i + 1] = value; // Vert
            originalData[i + 2] = value; // Bleu
            originalData[i + 3] = 255;   // Alpha (opacité maximale)
        }
        
        // Mettre à jour le canvas temporaire avec le bitmap noir et blanc
        tempCtx.putImageData(originalImageData, 0, 0);

        // Dessiner le bitmap centré avec des coordonnées entières
        finalCtx.drawImage(tempCanvas, xOffset, 0);
        
        // Obtenir les données de l'image finale
        const finalImageData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
        
        // Créer le bitmap monochrome
        const bmpBuffer = createMonochromeBitmap(finalCanvas.width, finalCanvas.height, finalImageData.data);
        
        // Créer le blob à partir du buffer
        const blob = new Blob([bmpBuffer], { type: 'image/bmp' });
        
        // Récupérer le nom de fichier personnalisé
        const customFilename = document.getElementById('filename').value.trim() || 'bitmap';
        const filename = `${customFilename}.bmp`;
        
        // Créer un FormData pour l'envoi du fichier
        const formData = new FormData();
        formData.append('image', blob, filename);
        
        // Upload via le serveur
        const response = await fetch(API_URL + '/upload', {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER
            },
            body: formData
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Non autorisé. Veuillez vérifier vos identifiants.');
            }
            throw new Error('Erreur lors de l\'upload');
        }
        
        const { url } = await response.json();
        
        // Afficher l'URL publique
        const urlDisplay = document.getElementById('urlDisplay');
        const publicUrl = document.getElementById('publicUrl');
        urlDisplay.style.display = 'block';
        publicUrl.href = url;
        publicUrl.textContent = url;
        
        alert('Bitmap uploadé avec succès vers Azure Blob Storage!');
    } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
        alert(error.message || 'Erreur lors de l\'upload vers Azure Blob Storage');
    }
}

// Fonction pour mettre à jour l'affichage des aperçus
function updatePreviews(originalUrl, bitmapUrl) {
    const originalPreview = document.getElementById('originalPreview');
    const bitmapPreview = document.getElementById('bitmapPreview');
    const originalPlaceholder = originalPreview.parentElement.querySelector('.preview-placeholder');
    const bitmapPlaceholder = bitmapPreview.parentElement.querySelector('.preview-placeholder');
    
    if (originalUrl) {
        originalPreview.src = originalUrl;
        originalPreview.classList.add('visible');
        originalPlaceholder.classList.add('hidden');
    } else {
        originalPreview.classList.remove('visible');
        originalPlaceholder.classList.remove('hidden');
    }
    
    if (bitmapUrl) {
        bitmapPreview.src = bitmapUrl;
        bitmapPreview.classList.add('visible');
        bitmapPlaceholder.classList.add('hidden');
    } else {
        bitmapPreview.classList.remove('visible');
        bitmapPlaceholder.classList.remove('hidden');
    }
}

function updateUploadButtonState() {
    const filename = document.getElementById('filename').value.trim();
    const uploadBtn = document.getElementById('uploadBtn');
    const filenameStatus = document.getElementById('filenameStatus');
    const filenameInput = document.getElementById('filename');
    const hasFile = document.getElementById('fileInput').files.length > 0;
    
    if (filename) {
        filenameStatus.textContent = '✅';
        filenameInput.classList.add('valid');
        if (hasFile) {
            uploadBtn.style.display = 'block';
        }
    } else {
        filenameStatus.textContent = '❌';
        filenameInput.classList.remove('valid');
        uploadBtn.style.display = 'none';
    }
}

// Initialisation de l'interface
document.addEventListener('DOMContentLoaded', async () => {
    // Initialiser l'authentification
    await initAuth();
    
    const fileInput = document.getElementById('fileInput');
    const thresholdInput = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');
    const targetWidthInput = document.getElementById('targetWidth');
    const widthValue = document.getElementById('widthValue');
    const uploadBtn = document.getElementById('uploadBtn');
    const filenameInput = document.getElementById('filename');
    
    // Initialiser le visualiseur de largeur
    const widthIndicator = document.getElementById('widthIndicator');
    const initialWidth = parseInt(targetWidthInput.value);
    const initialPercentage = (initialWidth / 320) * 100;
    widthIndicator.style.width = `${initialPercentage}%`;
    
    // Initialiser les aperçus
    updatePreviews(null, null);
    
    // Gérer le changement de largeur
    targetWidthInput.addEventListener('input', async (e) => {
        const value = parseInt(e.target.value);
        widthValue.textContent = value;
        
        // Mettre à jour le visualiseur de largeur
        const widthIndicator = document.getElementById('widthIndicator');
        const percentage = (value / 320) * 100;
        widthIndicator.style.width = `${percentage}%`;
        
        const file = fileInput.files[0];
        if (file) {
            try {
                const canvas = await convertToBitmap(file, parseInt(thresholdInput.value));
                updatePreviews(URL.createObjectURL(file), canvas.toDataURL());
            } catch (error) {
                console.error('Erreur lors de la conversion:', error);
                updatePreviews(null, null);
            }
        }
    });
    
    // Gérer le changement de fichier
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const canvas = await convertToBitmap(file, parseInt(thresholdInput.value));
                updatePreviews(URL.createObjectURL(file), canvas.toDataURL());
                updateUploadButtonState();
                // Afficher le bouton d'inversion des couleurs
                document.getElementById('invertColorsBtn').style.display = 'block';
            } catch (error) {
                console.error('Erreur lors de la conversion:', error);
                updatePreviews(null, null);
            }
        } else {
            updatePreviews(null, null);
            // Masquer le bouton d'inversion des couleurs
            document.getElementById('invertColorsBtn').style.display = 'none';
        }
        updateUploadButtonState();
    });
    
    // Gérer le changement de seuil
    thresholdInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        thresholdValue.textContent = value;
        updatePreview(value);
    });
    
    // Gérer le changement de nom de fichier
    filenameInput.addEventListener('input', updateUploadButtonState);
    
    // Gérer l'upload vers Azure
    uploadBtn.addEventListener('click', async () => {
        if (bitmapCanvas && filenameInput.value.trim() !== '') {
            await uploadToAzureBlob(bitmapCanvas);
        }
    });
    
    // Ajouter l'écouteur d'événements pour le bouton d'inversion
    const invertColorsBtn = document.getElementById('invertColorsBtn');
    
    invertColorsBtn.addEventListener('click', async () => {
        isInverted = !isInverted;
        const file = fileInput.files[0];
        if (file) {
            try {
                const canvas = await convertToBitmap(file, parseInt(thresholdInput.value));
                updatePreviews(URL.createObjectURL(file), canvas.toDataURL());
            } catch (error) {
                console.error('Erreur lors de la conversion:', error);
            }
        }
    });
}); 