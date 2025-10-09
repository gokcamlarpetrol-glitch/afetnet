// Safe PDF Lib wrapper to prevent crashes when native modules are not available
let PDFLib: any = null;
let PDFDocument: any = null;
let Page: any = null;
let rgb: any = null;

try {
  const pdfLibModule = require('react-native-pdf-lib');
  PDFLib = pdfLibModule.default;
  PDFDocument = pdfLibModule.PDFDocument;
  Page = pdfLibModule.Page;
  rgb = pdfLibModule.rgb;
} catch (e) {
  console.warn('react-native-pdf-lib not available');
}

export const SafePDFLib = {
  isAvailable: () => PDFLib !== null,
  
  PDFDocument: PDFDocument,
  Page: Page,
  rgb: rgb,
  
  createDocument: () => {
    if (!PDFDocument) {
      console.warn('PDFDocument not available, returning mock');
      return {
        addPage: () => {},
        write: async () => ({ uri: '/tmp/mock.pdf' }),
        end: async () => {}
      };
    }
    return PDFDocument.create();
  }
};



