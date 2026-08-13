import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseTelecomWorkbook } from "@/lib/excel/parser";

describe("Parser référence Ookla", () => {
  it("reads per-band traffic together with DL and PRB", async () => {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Synthese_Ref");
    sheet.addRow(["", "", "L1800", "L1800", "L1800", "L1800", "", "L2100", "L2100", "L2100", "L2100", "", "L2600", "L2600", "L2600", "L2600", "", "L800", "L800", "L800", "L800"]);
    sheet.addRow(["Secteurs", "Hetsite", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA"]);
    sheet.addRow(["4G_Test_S1", "TEST", 12345, 4, 95, .9, 100, 2345, 6, 50, .9, 100, 3456, 8, 80, .9, 100, 4567, 9, 70, .9]);
    const buffer = await workbook.xlsx.writeBuffer(); const file = new File([buffer], "Situation_Secteurs_ookla_Ref_010626.xlsx"); const parsed = await parseTelecomWorkbook(file);
    expect(parsed.records.get("4G_Test_S1")?.bands.L1800).toMatchObject({ traffic: 12345, throughput: 4, prb: 95 });
    expect(parsed.records.get("4G_Test_S1")?.bands.L800).toMatchObject({ traffic: 4567, throughput: 9, prb: 70 });
  });

  it("reads Average week and SAFI 4G layouts as compatible KPI snapshots", async () => {
    const average = new ExcelJS.Workbook(); const averageSheet = average.addWorksheet("Sheet1");
    averageSheet.addRow(["", "", "", "", "L1800", "L1800", "L1800", "L1800", "", "L2100", "L2100", "L2100", "L2100", "", "L2600", "L2600", "L2600", "L2600", "", "L800", "L800", "L800", "L800"]);
    averageSheet.addRow(["Date", "Secteurs", "", "Hetsite", "Avail", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "Traffic [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA"]);
    averageSheet.addRow(["2026-06-01", "4G_SAFI_S1", "4G_SAFI_S1", "SAFI", 100, 1000, 10, 45, .4, null, null, null, null, null, 100, 2000, 14, 60, .5, 100, 3000, 8, 70, .6]);
    const safi = new ExcelJS.Workbook(); const safiSheet = safi.addWorksheet("Feuil1");
    safiSheet.addRow(["", "", "", "", "", "", "", "", "", "", "", "L1800", "L1800", "L1800", "L1800", "L1800", "L2100", "L2100", "L2100", "L2100", "L2100", "L2600", "L2600", "L2600", "L2600", "L2600", "L800", "L800", "L800", "L800", "L800"]);
    safiSheet.addRow(["Date", "Secteur", "Hetsite", "Status", "Plaque", "Pb de disponibilité", "Bandes débit Dégradé", "Bandes Chargées", "Constat", "Résponsabilité", "Presence alarm", "Avail", "4G Traffic Volume [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "4G Traffic Volume [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "4G Traffic Volume [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA", "Avail", "4G Traffic Volume [MByte]", "Débit 4G DL", "Usage_PRB_DL_BH", "TA"]);
    safiSheet.addRow(["2026-08-13", "4G_SAFI_S1", "SAFI", "1800+2600+800", "SAFI", "", "1800", "L1800", "Partage L800", "Optim", "Service Degraded", 100, 1200, 12, 35, .4, null, 0, null, null, null, 100, 2200, 16, 55, .5, 100, 2800, 9, 65, .6]);
    const averageFile = new File([await average.xlsx.writeBuffer()], "Average week 1.6.2026.xlsx"); const safiFile = new File([await safi.xlsx.writeBuffer()], "SAFI 4G.xlsx");
    const [parsedAverage, parsedSafi] = await Promise.all([parseTelecomWorkbook(averageFile), parseTelecomWorkbook(safiFile)]);
    expect(parsedAverage.format).toBe("kpi-snapshot");
    expect(parsedAverage.records.get("4G_SAFI_S1")?.bands.L2600).toMatchObject({ traffic: 2000, throughput: 14, prb: 60 });
    expect(parsedSafi.format).toBe("qualification");
    expect(parsedSafi.records.get("4G_SAFI_S1")).toMatchObject({ situation: "1800+2600+800", responsibility: "Optim", action: "Partage L800", degradedBands: ["L1800"], chargedBands: ["L1800"] });
  });
});
