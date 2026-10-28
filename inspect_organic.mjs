import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const w=await SpreadsheetFile.importXlsx(await FileBlob.load('tmp/organic_template.xlsx'));
console.log((await w.inspect({kind:'region',sheetId:'Diazinon',range:'A1:M9',maxChars:1000})).ndjson);
const p=await w.render({sheetName:'Diazinon',range:'A1:M35',scale:1,format:'png'});
await fs.writeFile('tmp/organic_before.png',new Uint8Array(await p.arrayBuffer()));
