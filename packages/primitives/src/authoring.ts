import type {NodeRegistry,NodeAuthoring,NodeParameterDescriptor} from '../../runtime/src/index.js';
const text=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'text'});
const bool=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'boolean'});
const json=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'json'});
const table=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'table'});
const choice=(id:string,label:string,options:string[]):NodeParameterDescriptor=>({id,label,kind:'select',options});
const crossings=[bool('crossMorpheme','Cross morphemes'),bool('crossSyllable','Cross syllables'),bool('crossWord','Cross words')];
const context=[text('target','Target phoneme'),text('left','Left context'),text('right','Right context'),...crossings];
const entries:Record<string,NodeAuthoring>={
 'phon.from-morphs':{label:'Morphs to phonemes',category:'Phonology',description:'Convert a morph sequence into phonological tokens.'},
 'phon.output':{label:'Phonology output',category:'Phonology'},
 'phon.environment-match':{label:'Environment match',category:'Phonology',keywords:['context','boundary'],description:'Pass only phonological forms matching this environment.',parameters:context},
 'phon.replace':{label:'Replace phoneme',category:'Phonology',keywords:['sound change','substitution'],parameters:[...context,text('replaceWith','Replacement')]},
 'phon.delete':{label:'Delete phoneme',category:'Phonology',keywords:['elision','deletion'],parameters:context},
 'phon.insert':{label:'Insert phoneme',category:'Phonology',keywords:['epenthesis'],parameters:[...context,text('insert','Insert'),choice('position','Position',['before','after'])]},
 'phon.metathesize':{label:'Metathesize',category:'Phonology',keywords:['swap','transposition'],parameters:[text('left','First phoneme'),text('right','Second phoneme'),...crossings]},
 'phon.assimilate':{label:'Assimilate',category:'Phonology',keywords:['nasal','place','feature'],parameters:[...context,json('mapping','Target:neighbor → replacement'),choice('direction','Neighbor side',['left','right'])]},
 'phon.stress':{label:'Assign stress',category:'Phonology',keywords:['accent','primary','secondary'],parameters:[...context,choice('level','Stress level',['Primary','Secondary'])]},
 'phon.syllabify':{label:'Syllabify',category:'Phonology',keywords:['syllable boundary'],parameters:[json('beforeSymbols','Syllable onsets')]},
 'phon.harmony':{label:'Vowel harmony',category:'Phonology',keywords:['vowels','agreement'],parameters:[text('trigger','Trigger vowel'),json('mapping','Harmony mapping')]},
 'phon.lenition':{label:'Lenite',category:'Phonology',keywords:['weakening'],parameters:[json('mapping','Sound mapping')]},
 'phon.fortition':{label:'Fortify',category:'Phonology',keywords:['strengthening'],parameters:[json('mapping','Sound mapping')]},
 'surface.spell':{label:'Spell phonemes',category:'Surface',keywords:['orthography','grapheme','spelling'],parameters:[table('tableId','Spelling table'),json('boundaries','Boundary spelling'),json('stress','Stress spelling'),choice('unmapped','Unknown phonemes',['error','preserve'])]},
 'surface.join':{label:'Join morphs',category:'Surface',parameters:[text('separator','Separator')]},
 'surface.space':{label:'Space words',category:'Surface'},
 'surface.capitalize':{label:'Capitalize',category:'Surface',parameters:[choice('style','Capitalization',['sentence','upper','lower'])]},
 'surface.punctuate':{label:'Punctuate',category:'Surface',parameters:[text('prefix','Prefix'),text('suffix','Suffix')]},
 'surface.rewrite':{label:'Rewrite spelling',category:'Surface',parameters:[text('from','Find'),text('to','Replace with')]},
 'surface.output':{label:'Surface output',category:'Surface'}
};
export function registerRealizationAuthoring(registry:NodeRegistry):void{
 for(const [type,authoring] of Object.entries(entries))if(registry.get(type))registry.setAuthoring(type,authoring);
}
