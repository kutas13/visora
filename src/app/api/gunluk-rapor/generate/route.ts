import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

interface ReportRowPayload {
  biletNo: number;
  hyKodu: string;
  id: string;
  acenta: string;
  yolcuAdi: string;
  tarih: string;
  biletTut: number;
  servis: number;
  toplam: number;
  parkur1: string;
  parkur2: string;
  parkur3: string;
  satisSecli: string;
  kartNo: string;
  cariAdi: string;
  uyelikNo: string;
  not: string;
}

const HEADERS = [
  "bilet no ",
  "H.Y. Kodu",
  "I-D",
  "Acenta ",
  "Yolcu Adi",
  "Tarih",
  "Bilet Tut.",
  "Servis",
  "Toplam",
  "Parkur1",
  "Parkur2",
  "Parkur3",
  "Satis Sekli",
  "Kart No",
  "CARI ADI",
  "UYELIK NO",
  "NOT",
];

function formatDateForExcel(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows, tarih } = body as {
      rows: ReportRowPayload[];
      tarih: string;
    };

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Satır verisi bulunamadı" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Fox Turizm";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Sayfa1");

    const headerRow = sheet.addRow(HEADERS);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFED7D31" },
      };
    });

    sheet.columns = [
      { width: 10 },
      { width: 10 },
      { width: 5 },
      { width: 12 },
      { width: 35 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 8 },
      { width: 8 },
      { width: 8 },
      { width: 14 },
      { width: 12 },
      { width: 16 },
      { width: 12 },
      { width: 16 },
    ];

    for (const row of rows) {
      const dataRow = sheet.addRow([
        row.biletNo,
        row.hyKodu,
        row.id,
        row.acenta,
        row.yolcuAdi,
        formatDateForExcel(row.tarih),
        row.biletTut || "",
        row.servis || "",
        row.toplam || "",
        row.parkur1,
        row.parkur2,
        row.parkur3,
        row.satisSecli,
        row.kartNo,
        row.cariAdi,
        row.uyelikNo,
        row.not,
      ]);

      [7, 8, 9].forEach(colIdx => {
        const cell = dataRow.getCell(colIdx);
        if (typeof cell.value === "number") {
          cell.numFmt = "#,##0.00";
        }
      });

      dataRow.eachCell((cell) => {
        cell.font = { size: 10 };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${tarih.replace(/-/g, ".")}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("Excel üretim hatası:", err);
    return NextResponse.json({ error: err.message || "Excel üretilemedi" }, { status: 500 });
  }
}
