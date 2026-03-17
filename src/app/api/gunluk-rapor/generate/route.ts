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
  pnr: string;
  odeme: string;
  mil: string;
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
  "PNR",
  "ODEME",
  "MIL ",
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
    const { rows, tarih, personel } = body as {
      rows: ReportRowPayload[];
      tarih: string;
      personel: string;
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
      cell.font = { bold: true, size: 10 };
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
        fgColor: { argb: "FFD9E1F2" },
      };
    });

    sheet.columns = [
      { width: 10 }, // bilet no
      { width: 10 }, // H.Y. Kodu
      { width: 5 },  // I-D
      { width: 12 }, // Acenta
      { width: 35 }, // Yolcu Adi
      { width: 12 }, // Tarih
      { width: 12 }, // Bilet Tut.
      { width: 12 }, // Servis
      { width: 12 }, // Toplam
      { width: 8 },  // Parkur1
      { width: 8 },  // Parkur2
      { width: 8 },  // Parkur3
      { width: 14 }, // Satis Sekli
      { width: 12 }, // Kart No
      { width: 16 }, // CARI ADI
      { width: 12 }, // UYELIK NO
      { width: 10 }, // PNR
      { width: 10 }, // ODEME
      { width: 8 },  // MIL
      { width: 12 }, // NOT
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
        row.pnr,
        row.odeme,
        row.mil,
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
