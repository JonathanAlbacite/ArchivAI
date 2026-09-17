import path from "path";
import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];

// Extract raw text from an uploaded document based on its extension
export const extractTextFromFile = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".pdf") {
    const buffer = await fs.readFile(file.path);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === ".docx" || ext === ".doc") {
    const { value } = await mammoth.extractRawText({ path: file.path });
    return value;
  }

  return fs.readFile(file.path, "utf-8");
};
