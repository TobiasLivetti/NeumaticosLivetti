const { google } = require('googleapis');
require('dotenv').config();

// En producción: GOOGLE_CREDENTIALS = contenido del JSON como string
// En desarrollo: GOOGLE_CREDENTIALS_PATH = ruta al archivo JSON
const auth = process.env.GOOGLE_CREDENTIALS
  ? new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  : new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function leerRango(spreadsheetId, rango) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: rango });
  return res.data.values || [];
}

async function agregarFila(spreadsheetId, rango, valores) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: rango,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [valores] },
  });
}

async function actualizarCelda(spreadsheetId, rango, valor) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: rango,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[valor]] },
  });
}

module.exports = { leerRango, agregarFila, actualizarCelda };
