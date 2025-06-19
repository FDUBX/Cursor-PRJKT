// Configuration
const API_URL = process.env.HOSTNAME;

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

// Fonction pour copier l'URL dans le presse-papier
async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copié !';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = 'Copier URL';
            button.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Erreur lors de la copie:', err);
        button.textContent = 'Erreur';
        setTimeout(() => {
            button.textContent = 'Copier URL';
        }, 2000);
    }
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

// Fonction pour charger les blobs
async function loadBlobs() {
    try {
        loadingElement.style.display = 'block';
        errorElement.style.display = 'none';
        blobGrid.innerHTML = '';
        
        const response = await fetch(`${API_URL}/list-blobs`);
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des blobs');
        }
        
        const blobs = await response.json();
        blobs.forEach(blob => {
            blobGrid.appendChild(createBlobCard(blob));
        });
    } catch (error) {
        console.error('Erreur:', error);
        errorElement.textContent = 'Erreur lors du chargement des fichiers';
        errorElement.style.display = 'block';
    } finally {
        loadingElement.style.display = 'none';
    }
}

// Charger les blobs au démarrage
document.addEventListener('DOMContentLoaded', loadBlobs); 