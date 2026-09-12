/*
 * virtual_device.js 的类型声明。
 *
 * 那个文件是 UMD：它把自己挂到 globalThis.ArgxVirtualDevice，
 * 而不是用 ESM 导出。副作用导入（import './virtual_device.js'）本身
 * 就能跑通，但 TypeScript 需要一个"这个文件是个模块"的声明才会放行，
 * 否则报 TS2882。
 *
 * 具体类型包装在 console/src/core/virtualDevice.ts 里——那边才是
 * 给上层用的接口，这里只声明"它可以被导入"，不伪造任何导出。
 */

export {};
