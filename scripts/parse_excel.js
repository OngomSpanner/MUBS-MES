const xlsx = require('xlsx');
const fs = require('fs');
try {
  const workbook = xlsx.readFile('public/ACTIVITY EXTRACT FOR S& P OFFICE.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  fs.writeFileSync('scripts/excel_output.json', JSON.stringify(data.slice(0, 5), null, 2), 'utf8');
} catch (e) {
  console.error(e);
}
