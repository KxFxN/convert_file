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
    const selected = formData.get("selected") as string;

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
    const xmlData = convertToXML(jsonData, selected);

    return NextResponse.json({ xmlData });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { error: "Error processing CSV file" },
      { status: 500 }
    );
  }
}

const decimalPlacesMap: { [key: string]: number } = {
  Purity: 3,
  "Other Fluorocarbons": 0,
  "Acid content(as HF)": 1,
  H2O: 1,
  CO: 1,
  CO2: 1,
  "THC (AS CH4)": 1,
  NITROGEN: 1,
  OXYGEN: 1,
  CF4: 1,
};

// 2️⃣ ฟังก์ชันจัดรูปแบบตัวเลขตาม itemName
function formatDecimal(value: string, itemName: string): string {
  const num = parseFloat(value);

  if (isNaN(num)) return value; // ถ้าไม่ใช่ตัวเลข ให้คืนค่าเดิม

  // ตรวจสอบว่ามีค่าใน Mapping หรือไม่
  const decimalPlaces = decimalPlacesMap[itemName] ?? 1; // ค่า Default เป็น 2 ตำแหน่ง
  return num.toFixed(decimalPlaces);
}

function convertToXML(data: DataType[], selected: string) {
  const desiredOrder = [
    "Purity",
    "Other Fluorocarbons",
    "CClF3",
    "Acid content(as HF)",
    "H2O",
    "CF4",
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
    CF4: "CF4",
    CO: "CO",
    CO2: "CO2",
    "THC(CH4)": "THC (AS CH4)",
    SF6: "SF6",
    N2: "NITROGEN",
    O2: "OXYGEN",
  };

  const defaultUnit: Record<string, string> = {
    Purity: "%",
    "Other Fluorocarbons": "ppmv",
    CClF3: "ppmv",
    "Acid content(as HF)": "ppmv",
    H2O: "ppmv",
    CF4: "ppmv",
    CO: "ppmv",
    CO2: "ppmv",
    "THC(CH4)": "ppmv",
    SF6: "ppmv",
    N2: "ppmv",
    O2: "ppmv",
  };

  const defaultspecSymbol: Record<string, string> = {
    Purity: ">=",
    "Other Fluorocarbons": "<=",
    CClF3: "<=",
    "Acid content(as HF)": "<=",
    H2O: "<=",
    CF4: "<=",
    CO: "<=",
    CO2: "<=",
    "THC(CH4)": "<=",
    SF6: "<=",
    N2: "<=",
    O2: "<=",
  };

  const defaultSpec: Record<string, Record<string, string>> = {
    "14HE": {
      Purity: "99.999",
      "Other Fluorocarbons": "10",
      "Acid content(as HF)": "0.1",
      H2O: "1.0",
      CF4: "2.0",
      CO: "1.0",
      CO2: "1.0",
      "THC(CH4)": "0.5",
      N2: "8.0",
      O2: "2.0",
    },
    "32HE": {
      Purity: "99.999",
      "Other Fluorocarbons": "1.0",
      CClF3: "1.0",
      "Acid content(as HF)": "0.1",
      H2O: "1.0",
      CO: "0.5",
      CO2: "0.5",
      "THC(CH4)": "0.5",
      SF6: "0.5",
      N2: "5.0",
      O2: "1.0",
    },
  };

  const defaultDetect: Record<string, Record<string, string>> = {
    "14HE": {
      Purity: "99.999",
      "Other Fluorocarbons": "1",
      "Acid content(as HF)": "0.1",
      H2O: "0.1",
      CF4: "0.05",
      CO: "0.05",
      CO2: "0.05",
      "THC(CH4)": "0.05",
      N2: "0.1",
      O2: "0.1",
    },
    "32HE": {
      Purity: "99.999",
      "Other Fluorocarbons": "0.1",
      CClF3: "0.1",
      "Acid content(as HF)": "0.1",
      H2O: "0.1",
      CO: "0.05",
      CO2: "0.05",
      "THC(CH4)": "0.05",
      SF6: "0.1",
      N2: "0.1",
      O2: "0.1",
    },
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
    // { key: "44", name: "UnitId" },
    {
      key: "6",
      name: "Supplier",
      transform: (value: string) =>
        value
          .split(" ")[0]
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase()),
    },
    { key: "23", name: "Number" },
    {key: "24" , name: "LotQuantity"},
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
    string, // Unit ID as the key
    Map<
      string, // Nested Map with itemName as the key
      {
        Unit: string;
        Specification: string;
        DetectionLimit: string;
        InspectionValue: string;
      }
    >
  >();

  // 1️⃣ เก็บ unitId ทั้งหมดที่เจอในไฟล์ CSV
  const allUnitIds = new Set<string>();

  // 2️⃣ เก็บค่าของ "Purity", "Other Fluorocarbons", "Acid content(as HF)", "H2O" ถ้ามีค่า
  const mandatoryItems = [
    "Purity",
    "Other Fluorocarbons",
    "Acid content(as HF)",
    "H2O",
    "SF6",
  ];
  const globalValues = new Map<
    string, // Item Name เช่น "Purity"
    {
      Unit: string;
      Specification: string;
      DetectionLimit: string;
      InspectionValue: string;
    } // ค่า
  >();

  data.forEach((row) => {
    const unitId = String(row["44"] || "").trim();
    const itemName = String(row["35"] || "").trim();

    if (unitId) {
      allUnitIds.add(unitId);
    }

    if (mandatoryItems.includes(itemName)) {
      // ตรวจสอบ specSymbol: ถ้า row["41"] เป็นค่าว่างหลัง trim ให้ใช้ defaultspecSymbol
      const rawSpecSymbol = String(row["41"] || "").trim();
      const specSymbol =
        rawSpecSymbol === "" ? defaultspecSymbol[itemName] : rawSpecSymbol;

      // ตรวจสอบ specValue: ใช้ row["39"] หรือ row["38"] แล้ว trim ถ้าว่างให้ใช้ defaultSpec
      const rawSpecValue = (
        String(row["39"] || "") || String(row["38"] || "")
      ).trim();
      const specValue =
        rawSpecValue === "" ? defaultSpec[selected][itemName] : rawSpecValue;

      const spec = specSymbol + formatDecimal(specValue, itemName);

      // ตรวจสอบ detectionLimit: ถ้า row["42"] เป็นค่าว่างหลัง trim ให้ใช้ defaultDetect
      const rawDetectionLimit = String(row["42"] || "").trim();
      const detectionLimitValue =
        rawDetectionLimit === ""
          ? defaultDetect[selected][itemName]
          : rawDetectionLimit;
      const detectionLimit = String(detectionLimitValue).replace(
        /<=|>=|>|</g,
        ""
      );

      // InspectionValue
      const ins = String(row["40"] || "").trim();

      // ตรวจสอบ unit: ถ้า row["37"] เป็นค่าว่างให้ใช้ defaultUnit
      let unit = String(row["37"] || "").trim();
      if (unit === "") {
        unit = defaultUnit[itemName];
      }
      if (unit.includes("vol%")) unit = unit.replace("vol", "");
      if (unit.includes("volppm")) unit = unit.replace("volppm", "ppmv");
      if (unit.includes("massppm")) unit = unit.replace("massppm", "ppmw");

      // เก็บค่าใน globalValues (ไม่ขึ้นกับค่า InspectionValue ว่างหรือไม่)
      globalValues.set(itemName, {
        Unit: unit,
        Specification: spec,
        DetectionLimit: detectionLimit,
        InspectionValue: ins,
      });
    }
  });

  // 3️⃣ เติม "Purity", "Other Fluorocarbons", "Acid content(as HF)", "H2O" ให้ทุก unitId ก่อน
  allUnitIds.forEach((unitId) => {
    if (!inspectionItemsMap.has(unitId)) {
      inspectionItemsMap.set(unitId, new Map());
    }

    const itemMap = inspectionItemsMap.get(unitId)!;

    mandatoryItems.forEach((itemName) => {
      if (!itemMap.has(itemName) && globalValues.has(itemName)) {
        itemMap.set(itemName, globalValues.get(itemName)!);
      }
    });
  });

  // 4️⃣ ดำเนินการเพิ่มข้อมูลจาก CSV ปกติ
  data.forEach((row) => {
    const unitId = String(row["44"] || "").trim();
    const itemName = String(row["35"] || "").trim();

    if (!unitId) return; // ข้ามแถวที่ไม่มี unitId

    if (!inspectionItemsMap.has(unitId)) {
      inspectionItemsMap.set(unitId, new Map());
    }

    const itemMap = inspectionItemsMap.get(unitId)!;

    if (desiredOrder.includes(itemName)) {
      // ตรวจสอบ specSymbol: ถ้า row["41"] เป็นค่าว่างหลัง trim ให้ใช้ defaultspecSymbol
      const rawSpecSymbol = String(row["41"] || "").trim();
      const specSymbol =
        rawSpecSymbol === "" ? defaultspecSymbol[itemName] : rawSpecSymbol;

      // ตรวจสอบ specValue: ใช้ row["39"] หรือ row["38"] แล้ว trim ถ้าว่างให้ใช้ defaultSpec
      const rawSpecValue = (
        String(row["39"] || "") || String(row["38"] || "")
      ).trim();
      const specValue =
        rawSpecValue === "" ? defaultSpec[selected][itemName] : rawSpecValue;

      const spec = specSymbol + formatDecimal(specValue, itemName);

      // ตรวจสอบ detectionLimit: ถ้า row["42"] เป็นค่าว่างหลัง trim ให้ใช้ defaultDetect
      const rawDetectionLimit = String(row["42"] || "").trim();
      const detectionLimitValue =
        rawDetectionLimit === ""
          ? defaultDetect[selected][itemName]
          : rawDetectionLimit;
      const detectionLimit = String(detectionLimitValue).replace(
        /<=|>=|>|</g,
        ""
      );

      // InspectionValue
      const ins = String(row["40"] || "").trim();

      // ตรวจสอบ unit: ถ้า row["37"] เป็นค่าว่างให้ใช้ defaultUnit
      let unit = String(row["37"] || "").trim();
      if (unit.includes("vol%")) unit = unit.replace("vol", "");
      if (unit.includes("volppm")) unit = unit.replace("volppm", "ppmv");
      if (unit.includes("massppm")) unit = unit.replace("massppm", "ppmw");

      itemMap.set(itemName, {
        Unit: unit,
        Specification: spec,
        DetectionLimit: detectionLimit,
        InspectionValue: ins,
      });
    }
  });

  // สมมติว่าคุณมี inspectionItemsMap เป็น Map<UnitID, Map<ItemName, Data>>
  const sortedInspectionItemsMap = new Map(
    Array.from(inspectionItemsMap.entries()).map(([unitId, itemsMap]) => {
      const sortedItems = new Map(
        Array.from(itemsMap.entries()).sort(([itemA], [itemB]) => {
          // ใช้ orderMap หรือ desiredOrder.indexOf ได้เช่นกัน
          const indexA = desiredOrder.indexOf(itemA);
          const indexB = desiredOrder.indexOf(itemB);
          return indexA - indexB;
        })
      );
      return [unitId, sortedItems];
    })
  );

  const sortedMap = new Map(sortedInspectionItemsMap);

  // แปลง Map เป็น XML
  const builder = new Builder();
  const xmlObj = {
    Micron_COA: {
      Header: {
        BasicInfoField: [
          { $: { FieldName: "Purno", FieldValue: "" } },
          { $: { FieldName: "POLine", FieldValue: "" } },
          { $: { FieldName: "Spec.no", FieldValue: selected === "14HE" ? "ZN5YQVW54AFP-18-18856" : selected === "32HE" && "ZN5YQVW54AFP-18-20951" } },
          { $: { FieldName: "Version", FieldValue: "2" } },
          { $: { FieldName: "DeliveryNote", FieldValue: "ICS-Doxxxx" } },
          {
            $: {
              FieldName: "COAnumber",
              FieldValue: "F10N_1017096_130-02041_20240822_A_02",
            },
          },
          { $: { FieldName: "Materialtype", FieldValue: "Gas" } },
          {
            $: {
              FieldName: "MaterialName",
              FieldValue:
                selected === "14HE"
                  ? "CF4 30*15"
                  : selected === "32HE" && "CH2F2 47L",
            },
          },
          {
            $: {
              FieldName: "SupplierPartNo",
              FieldValue:
                selected === "14HE"
                  ? selected
                  : selected === "32HE" && "HFC32EH",
            },
          },
          {
            $: {
              FieldName: "MaterialNumber",
              FieldValue:
                selected === "14HE"
                  ? "130-02004"
                  : selected === "32HE" && "130-05393",
            },
          },
          { $: { FieldName: "Supplier", FieldValue: result.Supplier } },
          { $: { FieldName: "Agency", FieldValue: "1017096" } },
          { $: { FieldName: "DataSource", FieldValue: result.Supplier } },
          { $: { FieldName: "Company_UID", FieldValue: "" } },
          { $: { FieldName: "BatchNumber", FieldValue: result.Number } },
          { $: { FieldName: "LotNumber", FieldValue: result.Number } },
          { $: { FieldName: "FAB", FieldValue: "F10N" } },
          { $: { FieldName: "LotQuantity", FieldValue: result.LotQuantity } },
          {
            $: {
              FieldName: "QuantityUn",
              FieldValue:
                selected === "14HE"
                  ? "Bundled"
                  : selected === "32HE" && "Cylinder",
            },
          },
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
        UnitId: Array.from(sortedMap.entries()).map(([key, value]) => ({
          $: { Value: key }, // ใส่ Value สำหรับ UnitId
          InspectionItems: Array.from(value.entries()).map(
            ([itemName, details]) => ({
              $: {
                ItemName: nameMapping[itemName as keyof typeof nameMapping],
              },
              ResultItem: [
                { $: { ResultName: "Unit", Value: details.Unit } },
                {
                  $: {
                    ResultName: "Specification",
                    Value: details.Specification,
                  },
                },
                {
                  $: {
                    ResultName: "DetectionLimit",
                    Value: details.DetectionLimit,
                  },
                },
                {
                  $: {
                    ResultName: "InspectionValue",
                    Value: details.InspectionValue,
                  },
                },
              ],
            })
          ),
        })),
      },
    },
  };

  return builder.buildObject(xmlObj);
}
