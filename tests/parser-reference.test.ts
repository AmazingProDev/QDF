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
});
