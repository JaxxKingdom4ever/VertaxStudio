import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

/** The source generator is a repeatable authoring aid; it must not erase authored grammar. */
test('reference pack regeneration preserves the persisted comparison and coordination acceptance set',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vertax-reference-generator-'));
  try{
    await mkdir(join(dir,'scripts'),{recursive:true});
    await copyFile('scripts/generate_reference_pack.py',join(dir,'scripts','generate_reference_pack.py'));
    const result=spawnSync('python3',[join(dir,'scripts','generate_reference_pack.py')],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const root=join(dir,'examples/reference-language.vertax');
    const manifest=JSON.parse(await readFile(join(root,'project.json'),'utf8'));
    const group=JSON.parse(await readFile(join(root,'node-groups/reference-clause.json'),'utf8'));
    const lexicon=JSON.parse(await readFile(join(root,'lexicon/lexicon.json'),'utf8'));
    const concepts=JSON.parse(await readFile(join(root,'concepts/concepts.json'),'utf8'));
    assert.equal(manifest.tests.length,59);
    assert.ok(manifest.tests.includes('tests/coordination-add-three.json'));
    assert.ok(manifest.tests.includes('tests/superlative-lowest.json'));
    assert.ok(group.parameters[0].defaultValue.some(p=>p.id==='dynamic-coordination-add'));
    assert.ok(group.parameters[0].defaultValue.some(p=>p.id==='comparison-more'));
    assert.ok(group.inputs[0].acceptedTypes.includes('SemanticList'));
    assert.ok(lexicon.some(x=>x.conceptId==='sem:compare.equal'&&x.forms.citation==='ga'));
    assert.ok(concepts.some(x=>x.id==='sem:list.coordination'));
    const canonical=JSON.parse(await readFile(join(root,'tests/comparison-more.json'),'utf8'));
    assert.equal(canonical.expected_output.surface,"person'pu ⟦TALL⟧ food");
    // Generator output is authoritative: a future regeneration must not silently
    // reorder or erase a committed project concept, pattern or corpus case.
    for(const resource of ['project.json','concepts/concepts.json','lexicon/lexicon.json',
       'node-groups/reference-clause.json','graphs/grammar/reference-grammar.json',...manifest.tests]){
      assert.deepEqual(JSON.parse(await readFile(join(root,resource),'utf8')),
        JSON.parse(await readFile(join('examples/reference-language.vertax',resource),'utf8')),resource);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
