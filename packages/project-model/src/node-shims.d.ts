declare module "node:fs/promises" {
  export function readFile(path:string, encoding:"utf8"):Promise<string>;
  export function writeFile(path:string, data:string, encoding:"utf8"):Promise<void>;
  export function mkdir(path:string, options?:{recursive?:boolean}):Promise<string|undefined>;
  export function rm(path:string, options?:{recursive?:boolean;force?:boolean}):Promise<void>;
  export function rename(oldPath:string,newPath:string):Promise<void>;
  export function realpath(path:string):Promise<string>;
}
declare module "node:path" {
  export function resolve(...paths:string[]):string;
  export function join(...paths:string[]):string;
  export function dirname(path:string):string;
  export function basename(path:string):string;
  export function relative(from:string,to:string):string;
  export function isAbsolute(path:string):boolean;
}
