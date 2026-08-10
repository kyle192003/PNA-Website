import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Special Invites");
  sheet.columns = [
    { header: "First Name", key: "firstName", width: 22 },
    { header: "Email", key: "email", width: 36 },
    { header: "Role", key: "role", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    firstName: "Maria",
    email: "maria.santos@example.com",
    role: "Committee",
  });
  sheet.addRow({
    firstName: "Juan",
    email: "juan.dela.cruz@example.com",
    role: "Guest Speaker",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pna-special-invites-template.xlsx"',
    },
  });
}
