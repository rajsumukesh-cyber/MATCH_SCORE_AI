declare module "mammoth/mammoth.browser" {
  const mammoth: typeof import("mammoth");
  export = mammoth;
}

declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const src: string;
  export default src;
}
