import type {NodeRegistry,NodeAuthoring,NodeParameterDescriptor} from '../../runtime/src/index.js';
const text=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'text'});
const bool=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'boolean'});
const json=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'json'});
const table=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'table'});
const choice=(id:string,label:string,options:string[]):NodeParameterDescriptor=>({id,label,kind:'select',options});
const crossings=[bool('crossMorpheme','Cross morphemes'),bool('crossSyllable','Cross syllables'),bool('crossWord','Cross words')];
const context=[text('target','Target phoneme'),text('left','Left context'),text('right','Right context'),...crossings];
const numeric=(id:string,label=id):NodeParameterDescriptor=>({id,label,kind:'number'});
const morphTarget=[numeric('targetIndex','Morph index (0-based)'),text('targetId','Morph ID (optional)')];
const entries:Record<string,NodeAuthoring>={
 'morph.root':{label:'Root morph',category:'Morphology',keywords:['stem','lexeme'],description:'Create an abstract root from a grammar morph candidate.',parameters:[text('form','Form override')]},
 'morph.affix':{label:'Attach affix',category:'Morphology',keywords:['prefix','suffix','bound'],description:'Attach a prefix or suffix as a separate morph without inserting spelling punctuation.',parameters:[choice('position','Position',['Prefix','Suffix']),text('form','Form'),text('sourceObjectId','Meaning source')]},
 'morph.prefix':{label:'Prefix',category:'Morphology',parameters:[text('form','Prefix form'),text('sourceObjectId','Meaning source')]},
 'morph.suffix':{label:'Suffix',category:'Morphology',parameters:[text('form','Suffix form'),text('sourceObjectId','Meaning source')]},
 'morph.circumfix':{label:'Circumfix',category:'Morphology',description:'Linked prefix and suffix carrying one meaning/source identity.',parameters:[text('prefix','Prefix'),text('suffix','Suffix'),text('sourceObjectId','Meaning source')]},
 'morph.zero':{label:'Zero morph',category:'Morphology',keywords:['null','unmarked'],description:'Preserve a feature marker that contributes no phonemes.',parameters:[text('featureId','Feature ID')]},
 'morph.select-allomorph':{label:'Select allomorph',category:'Morphology',keywords:['allomorphy','irregular','variants','conditional'],description:'Select from project-table rows or JSON candidates using specificity → priority → non-fallback; unresolved ties produce an error.',parameters:[table('tableId','Allomorph table'),json('candidates','Candidate rules'),...morphTarget,text('featureId','Feature for zero form')]},
 'morph.order':{label:'Order morphs',category:'Morphology',keywords:['linearization','permutation'],description:'Reorder morphs using each index exactly once.',parameters:[json('order','Index permutation')]},
 'morph.fuse':{label:'Fuse morphs',category:'Morphology',keywords:['portmanteau','merger'],description:'Fuse adjacent nonzero morphs, preserving all sources and rejecting feature conflicts.',parameters:[numeric('start','First morph index'),numeric('count','Number of morphs'),text('form','Fused form (optional)')]},
 'morph.reduplicate':{label:'Reduplicate',category:'Morphology',keywords:['copy','repeat','full','partial'],parameters:[choice('mode','Extent',['full','partial']),choice('position','Side',['Prefix','Suffix']),numeric('length','Partial length'),...morphTarget]},
 'morph.mutate':{label:'Mutate morph',category:'Morphology',keywords:['internal change','ablaut','vowel mutation'],parameters:[text('from','Find'),text('to','Replacement'),bool('all','All occurrences'),...morphTarget]},
 'morph.agreement':{label:'Agreement',category:'Morphology',keywords:['concord','controller','inflection'],description:'Copy selected typed features from a semantic controller to one morph.',parameters:[json('features','Target feature → controller feature'),text('controllerId','Controller meaning ID'),...morphTarget]},
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
