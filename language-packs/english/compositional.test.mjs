import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProject,toAnalyzerProject} from '../../dist/packages/project-model/src/index.js';
import {registerCorePrimitives} from '../../dist/packages/primitives/src/index.js';
import {NodeRegistry} from '../../dist/packages/runtime/src/index.js';
import {analyzeSurface} from '../../dist/packages/compiler/src/index.js';
const registry=new NodeRegistry();registerCorePrimitives(registry);
const options={mode:'fast',maxStepsPerStage:1000};
let project;async function parse(source){project??=toAnalyzerProject((await loadProject('language-packs/english.vertax')).project).project;return analyzeSurface(project,registry,source,options);}
const refer=(g,obj,role)=>(obj.roles[role]??[]).map(id=>g.objects[id]);
test('real English project productively composes consecutive modifiers without an enumerated sentence pattern',async()=>{
 const r=await parse('The happy small girl saw the boy.');assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.equal(r.candidates.length,1);
 const g=r.candidates[0].meaning,root=g.objects[g.roots[0]],agent=refer(g,root,'agent')[0];
 assert.equal(root.conceptId,'sem:event.see');assert.equal(root.features.values.tense,'past');
 assert.deepEqual(refer(g,agent,'quality').map(o=>o.conceptId),['sem:property.small','sem:property.happy']);
});
test('real English project retains two genuine PP attachments for a new sentence',async()=>{
 const r=await parse('The girl saw the boy with the telescope.');assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.equal(r.candidates.length,2);
 assert.equal(r.candidates.filter(c=>refer(c.meaning,c.meaning.objects[c.meaning.roots[0]],'instrument').length===1).length,1);
 assert.equal(r.candidates.filter(c=>{const g=c.meaning,e=g.objects[g.roots[0]];return refer(g,refer(g,e,'theme')[0],'association').length===1;}).length,1);
});
test('new nominal modifiers combine with ambiguous attachment without duplicate semantic candidates',async()=>{
 const r=await parse('The happy girl saw the small boy with the telescope.');assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.equal(r.candidates.length,2);
 for(const c of r.candidates){const g=c.meaning,e=g.objects[g.roots[0]];assert.equal(refer(g,refer(g,e,'agent')[0],'quality')[0].conceptId,'sem:property.happy');}
});
test('the compositional English path checks agreement instead of accepting a nearby matching word',async()=>{
 const r=await parse('The girls sees the boy.');assert.equal(r.success,false);assert.equal(r.candidates.length,0);
});
test('English retains present/past ambiguity in syncretic forms',async()=>{
 const r=await parse('The girls read the book.');assert.equal(r.success,true,JSON.stringify(r.diagnostics));
 assert.deepEqual(r.candidates.map(c=>c.meaning.objects[c.meaning.roots[0]].features.values.tense).sort(),['past','present']);
});
test('recursive adverb phrases add two explicit manner properties to a composed event',async()=>{
 const r=await parse('The young girl quietly quickly saw the boy.');
 assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.equal(r.candidates.length,1);
 const g=r.candidates[0].meaning,e=g.objects[g.roots[0]],agent=refer(g,e,'agent')[0];
 assert.equal(e.features.values.tense,'past');
 assert.deepEqual(refer(g,e,'manner').map(x=>x.conceptId),['sem:property.quickly','sem:property.quietly']);
 assert.deepEqual(refer(g,agent,'quality').map(x=>x.conceptId),['sem:property.young']);
});
test('a modified singular noun composes with a copular state without a fixed sentence template',async()=>{
 const r=await parse('The tall girl is happy.');assert.equal(r.success,true,JSON.stringify(r.diagnostics));assert.equal(r.candidates.length,1);
 const g=r.candidates[0].meaning,s=g.objects[g.roots[0]],subject=refer(g,s,'subject')[0];
 assert.equal(s.type,'State');assert.equal(s.conceptId,'sem:state.copula');
 assert.equal(refer(g,s,'quality')[0].conceptId,'sem:property.happy');
 assert.equal(refer(g,subject,'quality')[0].conceptId,'sem:property.tall');
});
test('copular agreement is checked across phrases: plural are works, plural is fails',async()=>{
 const ok=await parse('The young girls are happy.');assert.equal(ok.success,true,JSON.stringify(ok.diagnostics));
 const no=await parse('The young girls is happy.');assert.equal(no.success,false);assert.equal(no.candidates.length,0);
});
test('persisted corpus assertions validate every ambiguous meaning and its nested role paths',async()=>{
 const {runPersistedPackTests}=await import('../../dist/packages/translation/src/index.js');
 const pack=(await loadProject('language-packs/english.vertax')).project;
 const example={id:'test:ambiguous-attachment',name:'PP attachment both ways',input_stage:'OrthographyAnalysis',input:{text:'The girl saw the boy with the telescope.'},expected_stage:'MeaningAnalysis',expected_output:{success:true,candidateCount:2,candidateRoleConceptPaths:[
  {'instrument':'sem:entity.telescope','theme.association':null},
  {'instrument':null,'theme.association':'sem:entity.telescope'}
 ]},mode:'fast',assertions:[]};
 const p={...pack,tests:{case:example}};
 const opts={mode:'fast',maxStepsPerStage:1000};
 assert.equal(runPersistedPackTests(p,registry,opts).passed,1);
 const wrong={...example,expected_output:{...example.expected_output,candidateRoleConceptPaths:[
  {'instrument':'sem:entity.banana','theme.association':null},
  {'instrument':null,'theme.association':'sem:entity.telescope'}]}};
 const report=runPersistedPackTests({...pack,tests:{case:wrong}},registry,opts);
 assert.equal(report.passed,0,'wrong semantic attachments must fail even when candidateCount=2');
});
test('persisted role paths can verify ordered repeated roles, not just the first modifier',async()=>{
 const {runPersistedPackTests}=await import('../../dist/packages/translation/src/index.js');
 const pack=(await loadProject('language-packs/english.vertax')).project;
 const example={id:'test:stacked',name:'Ordered stacked modifiers',input_stage:'OrthographyAnalysis',input:{text:'The happy small girl saw the boy.'},expected_stage:'MeaningAnalysis',expected_output:{success:true,candidateCount:1,candidateRoleConceptPaths:[
  {'agent.quality.0':'sem:property.small','agent.quality.1':'sem:property.happy'}
 ]},mode:'fast',assertions:[]};
 assert.equal(runPersistedPackTests({...pack,tests:{case:example}},registry,options).passed,1);
});
