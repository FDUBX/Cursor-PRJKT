// Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin; // En production, utilise le même domaine que la page

// Configuration de l'authentification
let AUTH_HEADER = null;

// Éléments DOM
const blobGrid = document.getElementById('blobGrid');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');

// Fonction pour formater la date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fonction pour copier dans le presse-papier
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        button.classList.add('copied');
        button.textContent = 'Copié!';
        setTimeout(() => {
            button.classList.remove('copied');
            button.textContent = 'Copier URL';
        }, 2000);
    });
}

// Fonction pour créer une carte de blob
function createBlobCard(blob) {
    const card = document.createElement('div');
    card.className = 'blob-card';
    
    const image = document.createElement('img');
    image.className = 'blob-image';
    image.src = blob.url;
    image.alt = blob.name;
    
    const info = document.createElement('div');
    info.className = 'blob-info';
    
    const name = document.createElement('div');
    name.className = 'blob-name';
    name.textContent = blob.name;
    
    const date = document.createElement('div');
    date.className = 'blob-date';
    date.textContent = formatDate(blob.lastModified);
    
    const actions = document.createElement('div');
    actions.className = 'blob-actions';
    
    const viewButton = document.createElement('button');
    viewButton.className = 'btn btn-view';
    viewButton.textContent = 'Voir';
    viewButton.onclick = () => window.open(blob.url, '_blank');
    
    const copyButton = document.createElement('button');
    copyButton.className = 'btn btn-copy';
    copyButton.textContent = 'Copier URL';
    copyButton.onclick = () => copyToClipboard(blob.url, copyButton);
    
    actions.appendChild(viewButton);
    actions.appendChild(copyButton);
    info.appendChild(name);
    info.appendChild(date);
    card.appendChild(image);
    card.appendChild(info);
    card.appendChild(actions);
    
    return card;
}

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

// Fonction pour charger les blobs
async function loadBlobs() {
    try {
        if (!AUTH_HEADER) {
            await initAuth();
        }
        loadingElement.style.display = 'block';
        errorElement.style.display = 'none';
        blobGrid.innerHTML = '';
        
        const response = await fetch(`${API_URL}/list-blobs`, {
            headers: {
                'Authorization': AUTH_HEADER
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Non autorisé. Veuillez vérifier vos identifiants.');
            }
            throw new Error('Erreur lors de la récupération des blobs');
        }
        
        const blobs = await response.json();
        blobs.forEach(blob => {
            blobGrid.appendChild(createBlobCard(blob));
        });
    } catch (error) {
        console.error('Erreur:', error);
        errorElement.textContent = error.message || 'Erreur lors du chargement des fichiers';
        errorElement.style.display = 'block';
    } finally {
        loadingElement.style.display = 'none';
    }
}

// Charger les blobs au démarrage
document.addEventListener('DOMContentLoaded', loadBlobs); 