import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { Builder } from "xml2js";

type DataType = {
  [key: string]: string | number;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // อ่านไฟล์ CSV เป็นข้อความ
    const text = await file.text();

    // ใช้ PapaParse ในการแปลงไฟล์ CSV เป็น JSON
    const parsedData = Papa.parse<DataType>(text, {
      header: true, // อ่านแถวแรกเป็นคีย์
      skipEmptyLines: true, // ตัดบรรทัดว่าง
      transform: (value, field) => {
        if (typeof value === "string") {
          // เฉพาะคอลัมน์ที่ต้องการให้เครื่องหมายพิเศษยังคงอยู่
          if (
            ["38", "39"].includes(field as string) &&
            value.match(/^\d+\.\d+$/)
          ) {
            const num = parseFloat(value);
            if (value.endsWith(".0")) {
              return num.toFixed(1); // รักษารูปแบบ 1.0
            } else {
              return num.toString().replace(/\.?0+$/, ""); // ตัดเลขศูนย์ส่วนเกิน
            }
          }

          if (["41"].includes(field as string)) {
            return value.trim(); // เก็บเครื่องหมายไว้ แต่ตัดเว้นวรรค
          }

          if (["42"].includes(field as string)) {
            return value.replace(/<=|>=|>|</g, "").trim(); // เก็บเครื่องหมายไว้ แต่ตัดเว้นวรรค
          }
          return value.trim();
        }
        return value;
      },
    });

    const jsonData = parsedData.data;
    const xmlData = convertToXML(jsonData);

    return NextResponse.json({ xmlData });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { error: "Error processing CSV file" },
      { status: 500 }
    );
  }
}

function convertToXML(data: DataType[]) {
  const desiredOrder = [
    "Purity",
    "Other Fluorocarbons",
    "CClF3",
    "Acid content(as HF)",
    "H2O",
    "CO",
    "CO2",
    "THC(CH4)",
    "SF6",
    "N2",
    "O2",
  ];

  const nameMapping = {
    Purity: "PURITY",
    "Other Fluorocarbons": "OTHER FLUOROCARBONS",
    CClF3: "CClF3",
    "Acid content(as HF)": "ACIDITY (AS HF)",
    H2O: "H2O",
    CO: "CO",
    CO2: "CO2",
    "THC(CH4)": "THC (AS CH4)",
    SF6: "SF6",
    N2: "NITROGEN",
    O2: "OXYGEN",
  };

  // Function to reformat date with a simple replace
  const reformatDate = (date: string | undefined): string =>
    date ? date.replace(/(\d{4})(\d{2})(\d{2})/, "$1/$2/$3") : "";

  const findFirstNonEmptyValue = (
    data: DataType[],
    columnKey: string
  ): string => {
    const value = data.find(
      (row) => row[columnKey] && String(row[columnKey]).trim() !== ""
    )?.[columnKey];

    return value !== undefined && value !== null ? String(value) : "";
  };

  type Field = {
    key: string;
    name: string;
    transform?: (value: string) => string;
  };

  const fields: Field[] = [
    { key: "44", name: "UnitId" },
    {
      key: "6",
      name: "Supplier",
      transform: (value: string) => value.split(" ")[0],
    },
    { key: "23", name: "Number" },
    { key: "28", name: "Productiondate", transform: reformatDate },
    { key: "30", name: "ExpiredDate", transform: reformatDate },
    { key: "26", name: "ExpectDate", transform: reformatDate },
    { key: "15", name: "Author" },
    { key: "27", name: "DataInDate", transform: reformatDate },
  ];

  // สร้าง object ที่เก็บค่าทั้งหมด
  const result = fields.reduce(
    (acc: Record<string, string>, { key, name, transform }) => {
      const value = findFirstNonEmptyValue(data, key);
      acc[name] = transform ? transform(String(value)) : String(value).trim();
      return acc;
    },
    {}
  );

  const inspectionItemsMap = new Map<
    string,
    {
      Unit: string;
      Specification: string;
      DetectionLimit: string;
      InspectionValue: string;
    }
  >();

  data.forEach((row) => {
    const itemName = row["35"] as string;

    if (desiredOrder.includes(itemName)) {
      const specSymbol = String(row["41"] || "");
      const specValue = String(row["39"] || row["38"]);
      const spec = specSymbol + specValue;

      const rawDetectionLimit = String(row["42"] || "").trim();
      const detectionLimit = rawDetectionLimit.replace(/<=|>=|>|</g, "");

      const ins = String(row["40"] || "");

      let unit = String(row["37"] || "");
      if (unit.includes("vol%")) unit = unit.replace("vol", "");
      if (unit.includes("volppm")) unit = unit.replace("volppm", "ppmv");
      if (unit.includes("massppm")) unit = unit.replace("massppm", "ppmw");

      inspectionItemsMap.set(itemName, {
        Unit: unit,
        Specification: spec,
        DetectionLimit: detectionLimit,
        InspectionValue: ins,
      });
    }
  });

  const sortedEntries = Array.from(inspectionItemsMap.entries()).sort(
    ([keyA], [keyB]) => desiredOrder.indexOf(keyA) - desiredOrder.indexOf(keyB)
  );

  const sortedMap = new Map(sortedEntries);

  // แปลง Map เป็น XML
  const builder = new Builder();
  const xmlObj = {
    Root: {
      Header: {
        BasicInfoField: [
          { $: { FieldName: "Purno", FieldValue: "" } },
          { $: { FieldName: "POLine", FieldValue: "" } },
          { $: { FieldName: "Spec.no", FieldValue: "ZN5YQVW54AFP-18-18856" } },
          { $: { FieldName: "Version", FieldValue: "2" } },
          { $: { FieldName: "DeliveryNote", FieldValue: "ICS-Doxxxx" } },
          {
            $: {
              FieldName: "COAnumber",
              FieldValue: "F10N_1017096_130-02041_20240822_A_02",
            },
          },
          { $: { FieldName: "Materialtype", FieldValue: "Gas" } },
          { $: { FieldName: "MaterialName", FieldValue: "CF4 30*15" } },
          { $: { FieldName: "SupplierPartNo", FieldValue: "14EH" } },
          { $: { FieldName: "MaterialNumber", FieldValue: "130-02041" } },
          { $: { FieldName: "Supplier", FieldValue: result.Supplier } },
          { $: { FieldName: "Agency", FieldValue: "1017096" } },
          { $: { FieldName: "DataSource", FieldValue: result.Supplier } },
          { $: { FieldName: "Company_UID", FieldValue: "" } },
          { $: { FieldName: "BatchNumber", FieldValue: Number } },
          { $: { FieldName: "LotNumber", FieldValue: Number } },
          { $: { FieldName: "FAB", FieldValue: "F10N" } },
          { $: { FieldName: "LotQuantity", FieldValue: "1" } },
          { $: { FieldName: "QuantityUn", FieldValue: "Bundled" } },
          { $: { FieldName: "ManufacturingSite", FieldValue: "Osaka JP" } },
          {
            $: {
              FieldName: "Productiondate",
              FieldValue: result.Productiondate,
            },
          },
          { $: { FieldName: "ExpiredDate", FieldValue: result.ExpiredDate } },
          {
            $: { FieldName: "Expect_FABInDate", FieldValue: result.ExpectDate },
          },
          { $: { FieldName: "Author", FieldValue: result.Author } },
          {
            $: {
              FieldName: "Author_Email",
              FieldValue: "daikin-chem-qa-c@daikin.co.jp",
            },
          },
          { $: { FieldName: "DataInDate", FieldValue: result.DataInDate } },
          { $: { FieldName: "Remark", FieldValue: "NA" } },
        ],
      },
      Content: {
        UnitId: {
          $: { Value: result.UnitId },
          InspectionItem: Array.from(sortedMap.entries()).map(
            ([key, value]) => ({
              $: {
                ItemName: nameMapping[key as keyof typeof nameMapping],
              },
              ResultItem: [
                { $: { ResultName: "Unit", Value: value.Unit } },
                {
                  $: {
                    ResultName: "Specification",
                    Value: value.Specification,
                  },
                },
                {
                  $: {
                    ResultName: "DetectionLimit",
                    Value: value.DetectionLimit,
                  },
                },
                {
                  $: {
                    ResultName: "InspectionValue",
                    Value: value.InspectionValue,
                  },
                },
              ],
            })
          ),
        },
      },
    },
  };

  return builder.buildObject(xmlObj);
}
