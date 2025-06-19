const fetch = require('node-fetch');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const CSV_PATH = './Digital Signage - Info - 2025 05 18.csv';
const JSON_URL = 'https://stmillenniumappprod.blob.core.windows.net/signage-events/signage-events.json?sp=r&st=2025-05-14T14:06:42Z&se=2055-05-14T22:06:42Z&sip=194.209.129.128-194.209.129.135&spr=https&sv=2024-11-04&sr=c&sig=EhFh0RLQRiyPTtd033rH0WdfV%2BtpyLMRNLa6M3oEx0s%3D';

// Fonction utilitaire pour formater les dates ISO en format lisible
function formatDateHuman(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Fonction utilitaire pour n'afficher que l'heure (HH:mm)
function formatHour(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function main() {
  // 1. Lire le CSV
  const csvRaw = fs.readFileSync(CSV_PATH, { encoding: 'latin1' }); // latin1 pour les caractères spéciaux
  const csvRows = parse(csvRaw, { delimiter: ';', skip_empty_lines: true });

  // 2. Trouver l'entête utile (celle qui contient 'roomId')
  const headerIndex = csvRows.findIndex(row => row.includes('roomId'));
  if (headerIndex === -1) {
    console.error('Entête avec roomId non trouvée dans le CSV.');
    process.exit(1);
  }
  const headers = csvRows[headerIndex];
  // Ajout: détection de section (ex: Event/Momentus)
  let section = '';
  const dataRows = [];
  for (let i = headerIndex + 1; i < csvRows.length; i++) {
    const row = csvRows[i];
    // Détection de section (ligne contenant Event/Momentus, Digital Signage/SpinetiX, etc.)
    if (row.some(cell => cell && cell.trim().length > 0 && cell.trim().length < 40 && cell.trim().match(/Event\/Momentus|Digital Signage|Marketing\/Directus|AVL/))) {
      // On prend la première cellule non vide comme nom de section, ou la cellule contenant Event/Momentus
      section = row.find(cell => cell && cell.match(/Event\/Momentus|Digital Signage|Marketing\/Directus|AVL/)) || section;
      continue;
    }
    // Ligne de données
    if (row.length > 5 && row.some(cell => cell && cell.trim() !== '')) {
      dataRows.push({ row, section });
    }
  }

  // 3. Indexer le CSV par roomId et deviceTypeId
  const csvByRoomId = {};
  const csvByDeviceTypeId = {};
  dataRows.forEach(({ row, section }) => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    obj.eventNumber = row[11] || '';
    obj.eventItem = row[12] || '';
    if (obj.roomId) {
      if (!csvByRoomId[obj.roomId]) csvByRoomId[obj.roomId] = [];
      csvByRoomId[obj.roomId].push(obj);
    }
    if (obj.deviceTypeId) {
      if (!csvByDeviceTypeId[obj.deviceTypeId]) csvByDeviceTypeId[obj.deviceTypeId] = [];
      csvByDeviceTypeId[obj.deviceTypeId].push(obj);
    }
  });

  // 4. Télécharger le JSON
  const response = await fetch(JSON_URL);
  const events = await response.json();

  // 5. Croiser les infos et synthétiser
  const synthese = events.map(event => {
    // Chercher toutes les lignes CSV où roomId OU deviceTypeId correspondent
    const csvInfosRoom = csvByRoomId[event.roomId] || [];
    const csvInfosDevice = csvByDeviceTypeId[event.deviceType] || [];
    // Fusionner les deux tableaux sans doublons
    const allCsvInfos = [...csvInfosRoom, ...csvInfosDevice].filter((v, i, a) => a.indexOf(v) === i);
    // Nettoyer chaque eventItem en supprimant tous les '- |' (avec ou sans espaces/tabulations) au début de chaque item, même si plusieurs items sont concaténés ou séparés par des retours à la ligne/tabulations
    const allEventItems = Array.from(new Set(
      allCsvInfos
        .map(info => (info.eventItem || ''))
        .flatMap(items => items.split(/\||\n|\r|\t/))
        .map(item => item.replace(/^[\s\-\|]+/, '').trim())
        .filter(Boolean)
    )).join(' | ');
    const csvInfo = allCsvInfos[0] || {}; // On garde la première pour les autres champs
    return {
      functionStart: formatHour(event.functionStart),
      functionEnd: formatHour(event.functionEnd),
      articleStart: formatHour(event.articleStart),
      articleEnd: formatHour(event.articleEnd),
      customerName: event.customerName || '',
      roomId: event.roomId || '',
      playerName: csvInfo['Player Name'] || '',
      playerType: csvInfo['Player Type'] || '',
      display: csvInfo['Display'] || '',
      deviceType: event.deviceType || '',
      eventNumber: csvInfo.eventNumber || '',
      eventItem: allEventItems,
      articleInvoiceNote: event.articleInvoiceNote || '',
      articleNote: event.articleNote || '',
      screenText: csvInfo['Screen Text'] || '',
      screenValue: csvInfo['Screen Value'] || '',
    };
  });

  // Trier la synthèse par ordre chronologique sur functionStart (format HH:mm)
  synthese.sort((a, b) => {
    if (!a.functionStart) return 1;
    if (!b.functionStart) return -1;
    // Comparer les heures HH:mm
    const [ha, ma] = a.functionStart.split(':').map(Number);
    const [hb, mb] = b.functionStart.split(':').map(Number);
    return ha !== hb ? ha - hb : ma - mb;
  });

  // 6. Écrire la synthèse dans un CSV de sortie
  const csvWriter = createCsvWriter({
    path: 'synthese.csv',
    header: [
      {id: 'functionStart', title: 'functionStart'},
      {id: 'functionEnd', title: 'functionEnd'},
      {id: 'articleStart', title: 'articleStart'},
      {id: 'articleEnd', title: 'articleEnd'},
      {id: 'customerName', title: 'customerName'},
      {id: 'roomId', title: 'roomId'},
      {id: 'playerName', title: 'playerName'},
      {id: 'playerType', title: 'playerType'},
      {id: 'display', title: 'display'},
      {id: 'deviceType', title: 'deviceType'},
      {id: 'eventNumber', title: '# Event/Momentus'},
      {id: 'eventItem', title: 'Item Event/Momentus'},
      {id: 'articleInvoiceNote', title: 'articleInvoiceNote'},
      {id: 'articleNote', title: 'articleNote'},
      {id: 'screenText', title: 'screenText'},
      {id: 'screenValue', title: 'screenValue'},
    ]
  });
  await csvWriter.writeRecords(synthese);

  // Génération du HTML
  // Récupérer les valeurs distinctes pour chaque colonne
  const uniqueValuesByCol = {};
  for (const col of ['articleStart', 'articleEnd', 'functionStart', 'functionEnd', 'articleNote', 'customerName', 'roomId', 'deviceType', 'articleInvoiceNote', 'playerName', 'playerType', 'display', 'screenText', 'screenValue', 'eventNumber', 'eventItem']) {
    uniqueValuesByCol[col] = Array.from(new Set(synthese.map(row => row[col] || ''))).sort((a, b) => a.localeCompare(b, 'fr'));
  }

  const htmlHeader = `<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Synthèse Signage/Events</title>\n<link href=\"https://fonts.googleapis.com/css?family=Source+Sans+Pro:400,600&display=swap\" rel=\"stylesheet\">\n<style>\nbody { background: #163256; margin: 0; padding: 0; }\n.main-container { margin: 32px auto; padding: 24px 32px; background: #fff; border-radius: 18px; box-shadow: 0 4px 24px 0 rgba(0,0,0,0.07); width: 95vw; box-sizing: border-box; }\nh1 { font-size: 2.2em; color: #222; font-weight: 700; margin-bottom: 0.2em; letter-spacing: 0.01em; }\n#summary { margin-bottom: 18px; font-size: 1.1em; font-weight: 600; color: #fff; background: #222; display: inline-block; border-radius: 16px; padding: 6px 18px; letter-spacing: 0.03em; }\n.table-responsive { width: 100%; overflow-x: auto; }\ntable { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 900px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04); }\nth, td { border: none; padding: 8px 10px; }\nth { background: rgba(22,50,86,0.10); color: #222; font-weight: 600; font-size: 1em; }\ntr:nth-child(even) td { background: rgba(22,50,86,0.10); }\ntr:nth-child(odd) td { background: #fff; }\nselect.colFilter { width: 98%; box-sizing: border-box; border-radius: 8px; border: 1px solid #d1d5db; padding: 4px 6px; background: #f8f9fb; font-size: 1em; transition: border 0.2s; }\nselect.colFilter:focus { border: 1.5px solid #222; outline: none; background: #fff; }\ninput, select { font-family: 'Source Sans Pro', Arial, sans-serif; }\n::-webkit-scrollbar { width: 8px; background: #eee; }\n::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 8px; }\n@media (max-width: 900px) {\n  .main-container { padding: 8px 2vw; }\n  h1 { font-size: 1.3em; }\n  #summary { font-size: 1em; padding: 5px 10px; }\n  table { min-width: 600px; font-size: 0.95em; }\n}\n</style>\n</head>\n<body>\n<div class=\"main-container\">\n<h1>Synthèse Signage/Events</h1>\n<div id=\"summary\">Evènement(s) : ${synthese.length}</div>\n<div class=\"table-responsive\">\n<table id=\"syntheseTable\">\n<tr>\n`;
  const htmlFooter = `</table>\n</div>\n</div>\n<script>\nfunction filterTableSelects() {\n  var table = document.getElementById('syntheseTable');\n  var trs = table.getElementsByTagName('tr');\n  var filters = Array.from(document.querySelectorAll('select.colFilter')).map(i => i.value);\n  for (var i = 2; i < trs.length; i++) { // i=2 car 0:th, 1:selects\n    var tds = trs[i].getElementsByTagName('td');\n    var show = true;\n    for (var j = 0; j < filters.length; j++) {\n      if (filters[j] && filters[j] !== '__ALL__' && (!tds[j] || tds[j].textContent !== filters[j])) {\n        show = false; break;\n      }\n    }\n    trs[i].style.display = show ? '' : 'none';\n  }\n}\n</script>\n</body>\n</html>`;
  const htmlCols = [
    'functionStart','functionEnd','articleStart','articleEnd','customerName','roomId','playerName','playerType','display','deviceType','eventNumber','eventItem','articleInvoiceNote','articleNote','screenText','screenValue'
  ];
  let html = htmlHeader;
  html += htmlCols.map(col => `<th>${col}</th>`).join('') + '</tr>\n';
  // Ligne de combo box de filtre par colonne
  html += '<tr>' + htmlCols.map((col, idx) => {
    const options = [`<option value=\"__ALL__\">(Tous)</option>`]
      .concat(uniqueValuesByCol[col].filter(v => v !== '').map(v => `<option value=\"${v.replace(/"/g, '&quot;')}\">${v.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`));
    return `<td><select class=\"colFilter\" onchange=\"filterTableSelects()\">${options.join('')}</select></td>`;
  }).join('') + '</tr>\n';
  for (const row of synthese) {
    html += '<tr>' + htmlCols.map(col => `<td>${row[col] || ''}</td>`).join('') + '</tr>\n';
  }
  html += htmlFooter;
  fs.writeFileSync('synthese.html', html, {encoding: 'utf8'});

  console.log('Synthèse générée dans synthese.csv et synthese.html');
}

main();