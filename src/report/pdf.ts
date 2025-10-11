import * as FileSystem from "expo-file-system";
import { logger } from '../utils/productionLogger';
import * as Sharing from "expo-sharing";
import { collect } from "../opslog/collector";
import { readHealth } from "../mesh/health";
import { listLogistics } from "../logistics/store";
import { listTasks } from "../tasks/store";
import { listHazards } from "../hazard/store";
import { SafePDFLib } from "./SafePDFLib";

const DIR = "/tmp/";
const OUT = DIR + "reports/";

export async function buildReport(){
  await FileSystem.makeDirectoryAsync(OUT, { intermediates:true }).catch(()=>{});
  const ops = await collect();
  const mh = await readHealth();
  const lg = await listLogistics(undefined, undefined);
  const tasks = await listTasks();
  const hz = await listHazards();

  if (!SafePDFLib.isAvailable()) {
    logger.warn("PDF generation not available, creating text report instead");
    const textReport = `AFETNET — Operasyon Raporu
Tarih: ${new Date().toLocaleString()}
Mesh Health: Peers: ${mh.totals.peers_seen}  Tx:${mh.totals.msgs_tx}  Rx:${mh.totals.msgs_rx}  Success:${(mh.totals.success_rate*100).toFixed(0)}%
Lojistik & Görevler: Lojistik Kayıt: ${lg.length}  Görev: ${tasks.length}  Hazard: ${hz.length}
${ops.slice(-40).map(r => `${new Date(r.ts).toLocaleString()} • ${r.type} • ${r.id||""} • ${r.note||""}`).join('\n')}`;
    
    const textPath = OUT + `report_${Date.now()}.txt`;
    await FileSystem.writeAsStringAsync(textPath, textReport);
    return textPath;
  }

  // Build a simple multi-page PDF with summary texts
  const page1 = SafePDFLib.Page().setMediaBox(595, 842) // A4
    .drawText("AFETNET — Operasyon Raporu", { x:40, y:790, color: SafePDFLib.rgb(0,0,0), fontSize:18 })
    .drawText(`Tarih: ${new Date().toLocaleString()}`, { x:40, y:770, color: SafePDFLib.rgb(0,0,0), fontSize:10 })
    .drawText("Mesh Health", { x:40, y:740, color: SafePDFLib.rgb(0,0,0), fontSize:14 })
    .drawText(`Peers: ${mh.totals.peers_seen}  Tx:${mh.totals.msgs_tx}  Rx:${mh.totals.msgs_rx}  Success:${(mh.totals.success_rate*100).toFixed(0)}%`, { x:40, y:720, color: SafePDFLib.rgb(0,0,0), fontSize:10 })
    .drawText("Lojistik & Görevler (özet)", { x:40, y:690, color: SafePDFLib.rgb(0,0,0), fontSize:14 })
    .drawText(`Lojistik Kayıt: ${lg.length}  Görev: ${tasks.length}  Hazard: ${hz.length}`, { x:40, y:670, color: SafePDFLib.rgb(0,0,0), fontSize:10 });

  let y = 640;
  const maxLines = 40;
  for(const r of ops.slice(-maxLines)){
    const line = `${new Date(r.ts).toLocaleString()} • ${r.type} • ${r.id||""} • ${r.note||""}`.slice(0,100);
    page1.drawText(line, { x:40, y, color: SafePDFLib.rgb(0,0,0), fontSize:9 }); y -= 14; if(y<60) {break;}
  }

  const pdfPath = OUT + `report_${Date.now()}.pdf`;
  const pdf = await SafePDFLib.PDFDocument()
    .addPages(page1)
    .write();
  if(await Sharing.isAvailableAsync()){ await Sharing.shareAsync(pdfPath, { mimeType:"application/pdf", dialogTitle:"Operasyon Raporu" }); }
  return pdfPath;
}
