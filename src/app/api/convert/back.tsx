import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Builder } from "xml2js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    let workbook;
    if (file.name.endsWith(".csv")) {
      // Handle CSV files
      const csvContent = fileBuffer.toString("utf-8");
      workbook = XLSX.read(csvContent, { type: "string" });
    } else {
      // Handle Excel files
      workbook = XLSX.read(fileBuffer, { type: "buffer" });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const xmlData = convertToXML(jsonData);
    return NextResponse.json({ xmlData });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { error: "Error converting file" },
      { status: 500 }
    );
  }
}

function convertToXML(data: any[]): string {
  const xmlObj = {
    Root: {
      Header: {
        BasicInfoField: data.map((row) => ({
          $: {
            FieldName: row.FieldName,
            FieldValue: row.FieldValue || "",
          },
        })),
      },
      Content: {
        UnitId: data.map((row) => ({
          $: { Value: row['44'] || "" },
          InspectionItem: {
            $: { ItemName: row['35'] || "" },
            ResultItem: [
              { $: { ResultName: "Unit", Value: row.Unit || "" } },
              {
                $: {
                  ResultName: "Specification",
                  Value: row['39'] || "",
                },
              },
              {
                $: {
                  ResultName: "DetectionLimit",
                  Value: row['40'] || "",
                },
              },
              {
                $: {
                  ResultName: "InspectionValue",
                  Value: row['42'] || "",
                },
              },
            ],
          },
        })),
      },
    },
  };

  const builder = new Builder();
  return builder.buildObject(xmlObj);
}
