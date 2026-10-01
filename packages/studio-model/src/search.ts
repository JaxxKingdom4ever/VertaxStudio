import type { NodeCatalogEntry } from './catalog.js';
function score(entry:NodeCatalogEntry,query:string):number{
  const q=query.trim().toLowerCase();if(!q)return 0;
  if(q.startsWith('group:')){if(entry.source!=='node-group')return -1;const needle=q.slice(6).trim();const label=entry.label.toLowerCase();return label===needle?100:label.startsWith(needle)?80:label.includes(needle)?60:-1}
  const label=entry.label.toLowerCase(),type=entry.typeId.toLowerCase();if(label===q||type===q)return 100;if(label.startsWith(q)||type.startsWith(q)||type.split(/[.:/-]/).some(token=>token===q))return 90;if(entry.keywords.some(keyword=>keyword.toLowerCase()===q))return 85;if(label.includes(q)||type.includes(q)||entry.keywords.some(keyword=>keyword.toLowerCase().includes(q)))return 60;return -1;
}
export function searchNodeCatalog(entries:readonly NodeCatalogEntry[],query:string):readonly NodeCatalogEntry[]{return entries.map((entry,index)=>({entry,index,score:score(entry,query)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.entry)}
