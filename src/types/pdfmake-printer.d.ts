declare module "pdfmake/src/printer" {
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
