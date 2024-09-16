import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Builder } from "xml2js";

interface RowData {
  FieldName?: string;
  FieldValue?: string;
  "44": string; // UnitId
  "35": string; // ItemName
  Unit: string;
  "39": string; // Specification
  "40": string; // DetectionLimit
  "42": string; // InspectionValue
  [key: string]: string | undefined; // Allow other string keys
}

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
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as RowData[];
    console.log(jsonData);

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

function convertToXML(data: RowData[]): string {
  // จัดกลุ่มข้อมูลตาม UnitId
  const groupedData = data.reduce<Record<string, RowData[]>>((acc, row) => {
    const unitId = row["44"] || "";
    if (unitId) {
      if (!acc[unitId]) {
        acc[unitId] = [];
      }
      acc[unitId].push(row);
    }
    return acc;
  }, {});

  // ดึงรายการ InspectionItems จากข้อมูลใน Excel
  const inspectionItemsMap = new Map<
    string,
    {
      unit: string;
      spec: string;
      detLimit: string;
      inspValue: string;
    }
  >();

  data.forEach((row) => {
    const itemName = row["35"]?.toUpperCase() || "";
    if (
      ["PURITY", "OTHER FLUOROCARBONS", "ACID CONTENT(AS HF)", "H2O"].includes(
        itemName
      )
    ) {
      inspectionItemsMap.set(itemName, {
        unit: row.Unit || "",
        spec: (row["41"] || "") + (row["39"] || ""),
        detLimit: (String(row["42"]) || "").replace(/<=|>=|>|</g, ""),
        inspValue: row["40"] || "",
      });
    }
  });

  // สร้าง XML
  const xmlObj = {
    Root: {
      Header: {
        BasicInfoField: data
          .filter((row) => row.FieldName && row.FieldValue)
          .map((row) => ({
            $: {
              FieldName: row.FieldName || "",
              FieldValue: row.FieldValue || "",
            },
          })),
      },
      Content: {
        UnitId: Object.entries(groupedData)
          .map(([unitId, rows]) => {
            const inspectionItems = Array.from(
              inspectionItemsMap.entries()
            ).map(([itemName, item]) => ({
              $: { ItemName: itemName },
              ResultItem: [
                { $: { ResultName: "Unit", Value: item.unit } },
                { $: { ResultName: "Specification", Value: item.spec } },
                { $: { ResultName: "DetectionLimit", Value: item.detLimit } },
                { $: { ResultName: "InspectionValue", Value: item.inspValue } },
              ],
            }));

            rows.forEach((row) => {
              if (
                !inspectionItems.some((item) => item.$.ItemName === row["35"])
              ) {
                inspectionItems.push({
                  $: { ItemName: row["35"] || "" },
                  ResultItem: [
                    { $: { ResultName: "Unit", Value: row.Unit || "" } },
                    {
                      $: {
                        ResultName: "Specification",
                        Value: (row["41"] || "") + (row["39"] || ""),
                      },
                    },
                    {
                      $: {
                        ResultName: "DetectionLimit",
                        Value: (String(row["42"]) || "").replace(
                          /<=|>=|>|</g,
                          ""
                        ),
                      },
                    },
                    {
                      $: {
                        ResultName: "InspectionValue",
                        Value: row["40"] || "",
                      },
                    },
                  ],
                });
              }
            });

            return unitId
              ? {
                  $: { Value: unitId },
                  InspectionItem: inspectionItems,
                }
              : null;
          })
          .filter((item) => item !== null),
      },
    },
  };

  const builder = new Builder();
  return builder.buildObject(xmlObj);
}
