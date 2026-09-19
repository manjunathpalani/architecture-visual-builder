declare module 'pptxgenjs' {
  // Minimal class declaration to satisfy the project's use of PptxGenJS as a
  // constructor and as a type. Methods are typed as `any` to avoid strict
  // surface typing while keeping TypeScript happy.
  export default class PptxGenJS {
    constructor()
    addSlide(): any
    save(name?: string): any
    // allow indexing for other dynamic methods
    [key: string]: any
  }
}
