import type { EditResult, StudioState } from './model.js';
export type StudioSnapshot = StudioState;
export interface StudioHistory { readonly past:readonly StudioSnapshot[]; readonly present:StudioState; readonly future:readonly StudioSnapshot[]; }
export function createStudioHistory(state:StudioState):StudioHistory{return {past:[],present:state,future:[]}}
export function applyStudioEdit(history:StudioHistory,edit:(state:StudioState)=>EditResult):StudioHistory{
  const result=edit(history.present);if(result.diagnostics.some(d=>d.severity==='Error'||d.severity==='Fatal'))return history;
  if(result.state.project===history.present.project)return {...history,present:result.state};
  return {past:[...history.past,history.present],present:result.state,future:[]};
}
export function undoStudio(history:StudioHistory):StudioHistory{if(!history.past.length)return history;const previous=history.past.at(-1)!;return {past:history.past.slice(0,-1),present:previous,future:[history.present,...history.future]}}
export function redoStudio(history:StudioHistory):StudioHistory{if(!history.future.length)return history;const next=history.future[0]!;return {past:[...history.past,history.present],present:next,future:history.future.slice(1)}}
