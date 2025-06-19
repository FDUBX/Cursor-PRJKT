const API_URL = process.env.HOSTNAME;

// Variables globales
let originalCanvas = null;
let originalCtx = null;
let bitmapCanvas = null;
let bitmapCtx = null;

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
            // Si le pixel n'est pas blanc (255,255,255)
            if (data[i] < 255 || data[i + 1] < 255 || data[i + 2] < 255) {
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
        const value = brightness > threshold ? 255 : 0;
        
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
            const value = brightness > 127 ? 255 : 0;
            
            originalData[i] = value;     // Rouge
            originalData[i + 1] = value; // Vert
            originalData[i + 2] = value; // Bleu
        }
        
        // Mettre à jour le canvas temporaire avec le bitmap noir et blanc
        tempCtx.putImageData(originalImageData, 0, 0);

        // Dessiner le bitmap centré avec des coordonnées entières
        finalCtx.drawImage(tempCanvas, xOffset, 0);
        
        // Convertir le canvas en blob avec une qualité maximale
        const blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png', 1.0));
        
        // Récupérer le nom de fichier personnalisé
        const customFilename = document.getElementById('filename').value.trim() || 'bitmap';
        const filename = `${customFilename}.png`;
        
        // Créer un FormData pour l'envoi du fichier
        const formData = new FormData();
        formData.append('image', blob, filename);
        
        // Upload via le serveur
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
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
        alert('Erreur lors de l\'upload vers Azure Blob Storage');
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

// Initialisation de l'interface
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const thresholdInput = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');
    const targetWidthInput = document.getElementById('targetWidth');
    const widthValue = document.getElementById('widthValue');
    const uploadBtn = document.getElementById('uploadBtn');
    
    // Initialiser les aperçus
    updatePreviews(null, null);
    
    // Gérer le changement de largeur
    targetWidthInput.addEventListener('input', async (e) => {
        const value = parseInt(e.target.value);
        widthValue.textContent = value;
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
                uploadBtn.style.display = 'inline-block';
                
                // Afficher l'aperçu original
                updatePreviews(URL.createObjectURL(file), canvas.toDataURL());
            } catch (error) {
                console.error('Erreur lors de la conversion:', error);
                updatePreviews(null, null);
            }
        } else {
            updatePreviews(null, null);
            uploadBtn.style.display = 'none';
        }
    });
    
    // Gérer le changement de seuil
    thresholdInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        thresholdValue.textContent = value;
        updatePreview(value);
    });
    
    // Gérer l'upload vers Azure
    uploadBtn.addEventListener('click', async () => {
        if (bitmapCanvas) {
            await uploadToAzureBlob(bitmapCanvas);
        }
    });
}); 