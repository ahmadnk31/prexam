// CRITICAL: Polyfill DOMMatrix and other DOM APIs BEFORE importing pdfjs-dist
// pdfjs-dist uses these at module evaluation time, so they must be available immediately
// This file must be imported BEFORE any pdfjs-dist imports

// Execute immediately at module load time (not in a function)
(function setupPolyfills() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
  // DOMMatrix polyfill for Node.js
  class DOMMatrixPolyfill {
    a: number = 1
    b: number = 0
    c: number = 0
    d: number = 1
    e: number = 0
    f: number = 0
    constructor(init?: string | number[]) {
      if (init) {
        if (typeof init === 'string') {
          // Parse matrix string if needed
        } else if (Array.isArray(init) && init.length >= 6) {
          this.a = init[0] || 1
          this.b = init[1] || 0
          this.c = init[2] || 0
          this.d = init[3] || 1
          this.e = init[4] || 0
          this.f = init[5] || 0
        }
      }
    }
  }
  globalThis.DOMMatrix = DOMMatrixPolyfill as any
  
  // ImageData polyfill
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class {
      data: Uint8ClampedArray
      width: number
      height: number
      constructor(dataOrWidth: Uint8ClampedArray | number, heightOrWidth?: number, height?: number) {
        if (dataOrWidth instanceof Uint8ClampedArray) {
          this.data = dataOrWidth
          this.width = heightOrWidth || 0
          this.height = height || 0
        } else {
          this.width = dataOrWidth
          this.height = heightOrWidth || 0
          this.data = new Uint8ClampedArray(this.width * this.height * 4)
        }
      }
    } as any
  }
  
  // Path2D polyfill (minimal)
  if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = class {
      constructor() {}
    } as any
  }
  
  // DOMParser polyfill (minimal)
  if (typeof globalThis.DOMParser === 'undefined') {
    globalThis.DOMParser = class {
      parseFromString(str: string, type: string) {
        return {} as any
      }
    } as any
  }
  }
})()

// Verify polyfills are set up
if (typeof globalThis.DOMMatrix === 'undefined') {
  throw new Error('Failed to set up DOMMatrix polyfill')
}

// Export nothing - this file is just for side effects
export {}

