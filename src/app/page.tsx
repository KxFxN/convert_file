"use client";

import { useState } from "react";
import { AlertCircle, FileSpreadsheet, FileOutput } from "lucide-react";

async function convertExcelToXML(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/convert", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Conversion failed");
  }

  const data = await response.json();
  return data.xmlData;
}

export default function ExcelToXMLConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [xmlData, setXmlData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setXmlData(null);
      setError(null);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError("Please select an Excel or CSV file first.");
      return;
    }

    setIsConverting(true);
    setError(null);

    try {
      const xml = await convertExcelToXML(file);
      setXmlData(xml);
    } catch (err: any) {
      setError(
        err.message || "An error occurred during conversion. Please try again."
      );
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">
            Excel/CSV to XML Converter
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Upload an Excel or CSV file to convert it to XML
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-md">
            <FileSpreadsheet className="text-green-500" size={24} />
            <label htmlFor="excel-file" className="flex-1">
              <input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-green-50 file:text-green-700
                  hover:file:bg-green-100"
              />
            </label>
          </div>
          <button
            onClick={handleConvert}
            disabled={!file || isConverting}
            className={`w-full py-2 px-4 rounded-md text-white font-semibold transition-colors duration-200
              ${
                !file || isConverting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600"
              }`}
          >
            {isConverting ? "Converting..." : "Convert to XML"}
          </button>
          {error && (
            <div className="flex items-center space-x-2 text-red-500 bg-red-50 p-3 rounded-md">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {xmlData && (
            <div className="flex items-center space-x-2 text-green-500 bg-green-50 p-3 rounded-md">
              <FileOutput size={20} />
              <a
                href={`data:text/xml;charset=utf-8,${encodeURIComponent(
                  xmlData
                )}`}
                download="converted.xml"
                className="text-sm font-medium underline hover:text-green-700"
              >
                Download XML File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
