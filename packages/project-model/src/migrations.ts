import type { Diagnostic } from "../../core-types/src/index.js";
import { CURRENT_PROJECT_SCHEMA_VERSION, decodeProjectManifest, type ProjectManifestV2 } from "./manifest.js";

export interface ProjectMigration {
  readonly from:number;
  readonly to:number;
  migrate(raw:Readonly<Record<string,unknown>>):Readonly<Record<string,unknown>>;
}
export class MigrationRegistry {
  private readonly migrations=new Map<number,ProjectMigration>();
  register(migration:ProjectMigration):void{
    if(migration.to!==migration.from+1)throw new Error("Vertax migrations must advance exactly one schema version.");
    if(this.migrations.has(migration.from))throw new Error(`Migration from schema ${migration.from} already registered.`);
    this.migrations.set(migration.from,migration);
  }
  get(from:number):ProjectMigration|undefined{return this.migrations.get(from)}
}
export interface MigrationResult { readonly manifest?:ProjectManifestV2; readonly diagnostics:readonly Diagnostic[]; }
function error(code:string,message:string):MigrationResult{return {diagnostics:[{severity:"Error",code,message}]}}
function rec(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v)}
export function createDefaultMigrationRegistry():MigrationRegistry{
  const registry=new MigrationRegistry();
  registry.register({from:0,to:1,migrate(raw){return {...raw,schema_version:1,node_groups:Array.isArray(raw.node_groups)?raw.node_groups:[],layouts:Array.isArray(raw.layouts)?raw.layouts:[],dependencies:Array.isArray(raw.dependencies)?raw.dependencies:[]}}});
  registry.register({from:1,to:2,migrate(raw){return {...raw,schema_version:2}}});
  return registry;
}
export function migrateManifest(raw:unknown,registry:MigrationRegistry):MigrationResult{
  if(!rec(raw)||typeof raw.schema_version!=="number"||!Number.isInteger(raw.schema_version))return error("INVALID_PROJECT_MANIFEST","Project manifest requires an integer schema_version.");
  let version=raw.schema_version; if(version>CURRENT_PROJECT_SCHEMA_VERSION)return error("UNSUPPORTED_PROJECT_SCHEMA",`Project schema ${version} is newer than supported schema ${CURRENT_PROJECT_SCHEMA_VERSION}.`);
  let current:Readonly<Record<string,unknown>>=raw;
  while(version<CURRENT_PROJECT_SCHEMA_VERSION){const migration=registry.get(version);if(!migration)return error("PROJECT_MIGRATION_PATH_MISSING",`No migration is registered from schema ${version}.`);current=migration.migrate(current);version=migration.to;}
  const decoded=decodeProjectManifest(current);return decoded.value?.schema_version===2?{manifest:decoded.value,diagnostics:decoded.diagnostics}:{diagnostics:decoded.diagnostics};
}
