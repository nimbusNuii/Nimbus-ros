declare module "pdfmake/src/Printer" {
  class PdfPrinter {
    constructor(fontDescriptors: Record<string, Record<string, string>>);
    createPdfKitDocument(documentDefinition: unknown): NodeJS.ReadableStream & {
      end: () => void;
      on: (
        event: "data" | "end" | "error",
        callback: ((chunk: Buffer | string) => void) | (() => void) | ((error: Error) => void)
      ) => void;
    };
  }

  export default PdfPrinter;
}

declare module "pdfmake/src/printer" {
  import PdfPrinter from "pdfmake/src/Printer";
  export default PdfPrinter;
}
