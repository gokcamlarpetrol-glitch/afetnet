declare module 'react-native-pdf-lib' {
  export interface PDFDocument {
    addPages(...pages: Page[]): PDFDocument;
    write(): Promise<string>;
  }
  
  export interface Page {
    setMediaBox(width: number, height: number): Page;
    drawText(text: string, options: { x: number; y: number; color: any; fontSize: number }): Page;
  }
  
  export function rgb(r: number, g: number, b: number): any;
  
  export namespace PDFLib {
    export function Page(): Page;
    export function PDFDocument(): PDFDocument;
  }
  
  export default PDFLib;
}



