"""Build a *bounded* editable English demo pack using lexical reference data.

The script is an authoring aid; generated JSON is checked in and runs without Python.
Lexical tagging source: TextBlob/Pattern English lexicon (Brill tagger; MIT + CC-BY).
Frequency source: TextBlob English spelling frequencies (Norvig / public-domain texts).
Generated forms remain preliminary and must be individually reviewed for a full pack.
"""
from collections import defaultdict
from pathlib import Path
import json
from textblob.en.inflect import pluralize

OUT=Path('language-packs/english.vertax')
LEX_SOURCE=Path('/opt/pyvenv/lib/python3.13/site-packages/textblob/en/en-lexicon.txt')
FREQ_SOURCE=Path('/opt/pyvenv/lib/python3.13/site-packages/textblob/en/en-spelling.txt')
def write(rel,obj):
 p=OUT/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')

POS={'NN':'Noun','VB':'Verb','JJ':'Adjective','RB':'Adverb','DT':'Determiner','PRP':'Pronoun','IN':'Preposition','CC':'Conjunction','MD':'Modal','RP':'Particle','CD':'Numeral','WDT':'Determiner','WP':'Pronoun','WRB':'Adverb'}
frequencies={}
for raw in FREQ_SOURCE.read_text().splitlines():
 if raw.startswith(';;;'):continue
 parts=raw.split()
 if len(parts)==2 and parts[1].isdigit():frequencies[parts[0]]=int(parts[1])
tags=defaultdict(set)
for raw in LEX_SOURCE.read_text().splitlines():
 parts=raw.split()
 if len(parts)!=2:continue
 word,tag=parts
 if word.isalpha() and word.islower() and 2<=len(word)<=24 and tag in POS:tags[word].add(POS[tag])

CORE={
 'the':'Determiner','a':'Determiner','an':'Determiner','this':'Determiner','that':'Determiner',
 'i':'Pronoun','you':'Pronoun','he':'Pronoun','she':'Pronoun','it':'Pronoun','we':'Pronoun','they':'Pronoun','me':'Pronoun','him':'Pronoun','her':'Pronoun','us':'Pronoun','them':'Pronoun',
 'my':'Determiner','your':'Determiner','his':'Determiner','our':'Determiner','their':'Determiner',
 'with':'Preposition','to':'Preposition','from':'Preposition','in':'Preposition','at':'Preposition','of':'Preposition','on':'Preposition','into':'Preposition','by':'Preposition','for':'Preposition','through':'Preposition',
 'and':'Conjunction','or':'Conjunction','but':'Conjunction','because':'Conjunction','if':'Conjunction',
 'cook':'Verb','see':'Verb','go':'Verb','take':'Verb','make':'Verb','do':'Verb','have':'Verb','be':'Verb','give':'Verb','write':'Verb','buy':'Verb','speak':'Verb','get':'Verb','find':'Verb','think':'Verb','know':'Verb','run':'Verb','come':'Verb','eat':'Verb','say':'Verb','teach':'Verb','bring':'Verb','leave':'Verb','build':'Verb',
 'person':'Noun','food':'Noun','book':'Noun','man':'Noun','woman':'Noun','girl':'Noun','brother':'Noun','telescope':'Noun','child':'Noun','city':'Noun','house':'Noun','dog':'Noun','cat':'Noun','water':'Noun','time':'Noun',
}
IRREG={
 'be':('was','been','is','being'),'have':('had','had','has','having'),'do':('did','done','does','doing'),
 'go':('went','gone','goes','going'),'take':('took','taken','takes','taking'),'make':('made','made','makes','making'),
 'see':('saw','seen','sees','seeing'),'give':('gave','given','gives','giving'),'write':('wrote','written','writes','writing'),
 'buy':('bought','bought','buys','buying'),'speak':('spoke','spoken','speaks','speaking'),'get':('got','gotten','gets','getting'),
 'find':('found','found','finds','finding'),'think':('thought','thought','thinks','thinking'),'know':('knew','known','knows','knowing'),
 'run':('ran','run','runs','running'),'come':('came','come','comes','coming'),'eat':('ate','eaten','eats','eating'),
 'say':('said','said','says','saying'),'teach':('taught','taught','teaches','teaching'),'bring':('brought','brought','brings','bringing'),
 'leave':('left','left','leaves','leaving'),'build':('built','built','builds','building'),
 'let':('let','let','lets','letting'),'tell':('told','told','tells','telling'),
 'put':('put','put','puts','putting'),'understand':('understood','understood','understands','understanding'),
 'become':('became','become','becomes','becoming'),'read':('read','read','reads','reading'),
 'cut':('cut','cut','cuts','cutting'),'hear':('heard','heard','hears','hearing'),
 'meet':('met','met','meets','meeting'),'feel':('felt','felt','feels','feeling'),
 'send':('sent','sent','sends','sending'),'show':('showed','shown','shows','showing'),
 'keep':('kept','kept','keeps','keeping'),'lead':('led','led','leads','leading'),
 'pay':('paid','paid','pays','paying'),'hold':('held','held','holds','holding'),
 'sleep':('slept','slept','sleeps','sleeping'),'occur':('occurred','occurred','occurs','occurring'),
 'don':('donned','donned','dons','donning'),
}
# Bounded vocabulary anchored in observed English words, not fabricated lexeme labels.
ranked=[w for w,f in sorted(frequencies.items(),key=lambda kv:(-kv[1],kv[0])) if w in tags and f>=35 and len(w)>1]
selected=list(dict.fromkeys([*CORE,*ranked]))[:750]
selected=list(dict.fromkeys([*CORE,*selected]))
concepts={};lexemes={}
def add(word,cls):
 if (word,cls) in lexemes:return
 kind={'Noun':'entity','Pronoun':'entity','Verb':'event','Adjective':'property','Adverb':'property'}.get(cls,'function')
 if cls=='Pronoun' and word=='i':concept='sem:entity.speaker'
 elif cls=='Pronoun' and word=='you':concept='sem:entity.listener'
 else:concept=f'sem:{kind}.{word}'
 concepts[concept]={'id':concept,'label':word,'semanticType':{'entity':'Entity','event':'Event','property':'Property','function':'Relation'}[kind], 'metadata':{}}
 forms={'citation':word}
 if cls=='Noun':forms['plural']=pluralize(word)
 if cls=='Noun':
  forms['possessive']=word+"'s"
  forms['pluralPossessive']=forms['plural']+("'" if forms['plural'].endswith('s') else "'s")
 if cls=='Adjective':
  reviewed={'good':('better','best'),'bad':('worse','worst'),
            'happy':('happier','happiest'),'tall':('taller','tallest'),
            'small':('smaller','smallest'),'busy':('busier','busiest'),
            'red':('redder','reddest'),'ready':('readier','readiest')}
  if word in reviewed:forms.update({'comparative':reviewed[word][0],'superlative':reviewed[word][1]})
 if cls=='Verb':
  if word in IRREG:
   past,participle,present3,progressive=IRREG[word]
  else:
   past=word+'d' if word.endswith('e') else word[:-1]+'ied' if word.endswith('y') and len(word)>1 and word[-2] not in 'aeiou' else word+'ed'
   participle=past
   present3=word[:-1]+'ies' if word.endswith('y') and len(word)>1 and word[-2] not in 'aeiou' else word+'es' if word.endswith(('s','sh','ch','x','z','o')) else word+'s'
   progressive=word[:-1]+'ing' if word.endswith('e') and not word.endswith('ee') else word+'ing'
  forms.update({'past':past,'participle':participle,'present3':present3,'progressive':progressive})
 if cls=='Pronoun' and word=='i':forms['citation']='I'
 lid=f'lex:en:{word}:{cls.lower()}'
 lexemes[(word,cls)]={'id':lid,'conceptId':concept,'lexicalClass':cls,'forms':forms,'features':{'values':{}},'valency':[], 'relatedLexemes':{},'irregularRuleIds':[],'metadata':{'frequency':frequencies.get(word,0),'formStatus':'irregular-reviewed' if word in IRREG else 'generated-unverified' if cls=='Verb' else 'citation' if cls not in ('Noun',) else 'plural-derived'}}
for word in selected:
 cls=CORE.get(word,sorted(tags[word])[0] if tags[word] else 'Noun')
 add(word,cls)
# Deliberate homographs/cross-category entries.
for word,cls in [('cook','Noun'),('saw','Noun'),('book','Verb'),('can','Modal'),('can','Noun'),('cooked','Adjective')]:add(word,cls)
for word,cls in CORE.items(): add(word,cls)

# Generic syntax templates are JSON data, not source-code special cases.
def slot(cls=None,form=None,text=None):
 d={}
 if cls:d['classes']=[cls]
 if form:d['formKeys']=[form]
 if text:d['text']=text
 return d
period=slot(text='.')
THE=slot(text='the');I=slot(text='i')
def base(root='sem:event.cook',tense='present',speaker=False):
 return {'root':'event','objects':[
  {'id':'event','type':'Event','conceptId':root,'roles':{'agent':['person'],'theme':['food']},'features':{'tense':tense}},
  {'id':'person','type':'Entity','slot':0 if speaker else 1},
  {'id':'food','type':'Entity','slot':3 if speaker else 4},
 ]}
pattern_rules=[
 {'id':'transitive-present-3', 'slots':[THE,{'classes':['Noun'],'formKeys':['citation','plural']},{'classes':['Verb'],'formKeys':['citation','present3']},THE,{'classes':['Noun'],'formKeys':['citation','plural']},period], 'slotConstraints':[{'leftSlot':1,'rightSlot':2,'allowedPairs':[['citation','present3'],['plural','citation']]}],
  'meaning':{'root':'event','objects':[{'id':'event','type':'Event','slot':2,'roles':{'agent':['person'],'theme':['food']},'features':{'tense':'present'}},{'id':'person','type':'Entity','slot':1},{'id':'food','type':'Entity','slot':4}]}},
 {'id':'transitive-past', 'slots':[THE,{'classes':['Noun'],'formKeys':['citation','plural']},slot('Verb','past'),THE,{'classes':['Noun'],'formKeys':['citation','plural']},period],
  'meaning':{'root':'event','objects':[{'id':'event','type':'Event','slot':2,'roles':{'agent':['person'],'theme':['food']},'features':{'tense':'past'}},{'id':'person','type':'Entity','slot':1},{'id':'food','type':'Entity','slot':4}]}},
 {'id':'transitive-first-person','slots':[I,slot('Verb','citation'),THE,{'classes':['Noun'],'formKeys':['citation','plural']},period],
  'meaning':{'root':'event','objects':[{'id':'event','type':'Event','slot':1,'roles':{'agent':['person'],'theme':['food']},'features':{'tense':'present','person':'first'}},{'id':'person','type':'Entity','slot':0},{'id':'food','type':'Entity','slot':3}]}}
]
# Structural PP ambiguity retained as two independent graph interpretations.
slots=[I,slot('Verb','past'),THE,slot('Noun','citation'),slot(text='with'),THE,slot('Noun','citation'),period]
slots[1]['conceptIds']=['sem:event.see'];slots[3]['conceptIds']=['sem:entity.man'];slots[6]['conceptIds']=['sem:entity.telescope']
shared=[{'id':'person','type':'Entity','slot':0},{'id':'telescope','type':'Entity','slot':6}]
pattern_rules.append({'id':'see-instrument-attachment','slots':slots,'meaning':{'root':'event','objects':[
 {'id':'event','type':'Event','conceptId':'sem:event.see','features':{'tense':'past'},'roles':{'agent':['person'],'patient':['man'],'instrument':['telescope']}},
 {'id':'man','type':'Entity','slot':3},*shared]}})
pattern_rules.append({'id':'see-nominal-attachment','slots':slots,'meaning':{'root':'event','objects':[
 {'id':'event','type':'Event','conceptId':'sem:event.see','features':{'tense':'past'},'roles':{'agent':['person'],'patient':['man']}},
 {'id':'man','type':'Entity','slot':3,'roles':{'with':['telescope']}},*shared]}})
# Role-based realization data. This first recovery slice covers an explicit subset only.
gen_patterns=[
 {'id':'transitive-present-3','conceptId':'*','features':{'tense':'present'},'requiredRoles':['agent','theme'],'parts':[{'literal':'the'},{'role':'agent','formKeyFrom':{'role':'agent','featureId':'number','values':{'plural':'plural'},'default':'citation'}},{'root':True,'formKeyFrom':{'role':'agent','featureId':'number','values':{'plural':'citation'},'default':'present3'}},{'literal':'the'},{'role':'theme','formKeyFrom':{'role':'theme','featureId':'number','values':{'plural':'plural'},'default':'citation'}},{'literal':'.'}],'capitalize':True,'priority':10},
 {'id':'transitive-past','conceptId':'*','features':{'tense':'past'},'requiredRoles':['agent','theme'],'parts':[{'literal':'the'},{'role':'agent','formKeyFrom':{'role':'agent','featureId':'number','values':{'plural':'plural'},'default':'citation'}},{'root':True,'formKey':'past'},{'literal':'the'},{'role':'theme','formKeyFrom':{'role':'theme','featureId':'number','values':{'plural':'plural'},'default':'citation'}},{'literal':'.'}],'capitalize':True,'priority':10},
 {'id':'transitive-first-person','conceptId':'*','features':{'tense':'present','person':'first'},'requiredRoles':['agent','theme'],'roleConcepts':{'agent':'sem:entity.speaker'},'parts':[{'role':'agent','formKey':'citation'},{'root':True,'formKey':'citation'},{'literal':'the'},{'role':'theme','formKeyFrom':{'role':'theme','featureId':'number','values':{'plural':'plural'},'default':'citation'}},{'literal':'.'}],'capitalize':True,'priority':20}
]

# Additional grammatical families are authored as the same persisted pattern
# data as the original transitive subset. No English runtime logic is added.
from english_breadth import extend as add_english_constructions, acceptance_cases as english_acceptance_cases
add_english_constructions(pattern_rules,gen_patterns,lexemes,concepts,add)
from english_advanced import extend as add_english_advanced, acceptance_cases as advanced_acceptance_cases
add_english_advanced(pattern_rules,gen_patterns,lexemes,concepts,add)

def stage(label,kind,in_t,out_t,params={}):
 s=label[0].lower()+label[1:];graph_id='en-'+s.lower();node_id='node-'+s.lower();
 graph={'id':graph_id,'nodes':[{'id':node_id,'typeId':kind,'params':params}],'edges':[],'exposedInputs':[{'graphPortId':'value','nodeId':node_id,'nodePortId':'value'}],'exposedOutputs':[{'graphPortId':'value','nodeId':node_id,'nodePortId':'value'}]};
 return {'schema_version':1,'stage':label,'graph':graph,'rules':[{'id':'rule-'+s.lower(),'stage':label,'matcher':{'kind':'type','type':in_t},'graphId':graph_id,'priority':1,'fallback':False}]}

stages={
 'OrthographyAnalysis':stage('OrthographyAnalysis','analysis.tokenize','SourceText','OrthographicTokenSequence'),
 'MorphologyAnalysis':stage('MorphologyAnalysis','analysis.lexeme-lookup','OrthographicTokenSequence','MorphAnalysis',{'allowProperNames':False}),
 'GrammarAnalysis':stage('GrammarAnalysis','analysis.match-pattern','MorphAnalysis','SyntacticAnalysis',{'patterns':pattern_rules}),
 'MeaningAnalysis':stage('MeaningAnalysis','analysis.to-meaning','SyntacticAnalysis','SemanticGraphValue',{'formFeatureMap':{'Noun':{'plural':{'number':'plural'},'citation':{'number':'singular'},'possessive':{'number':'singular'},'pluralPossessive':{'number':'plural'}}}}),
 'Grammar':stage('Grammar','analysis.realize-template','Event','MorphCandidate',{'patterns':gen_patterns}),
 'Morphology':stage('Morphology','morph.root','MorphCandidate','MorphSequence'),
 'Surface':stage('Surface','surface.join','MorphSequence','SurfaceForm',{'separator':''})
}
stages['Grammar']['rules'].append({'id':'rule-state','stage':'Grammar','matcher':{'kind':'type','type':'State'},'graphId':stages['Grammar']['graph']['id'],'priority':1,'fallback':False})
manifest={'schema_version':2,'id':'english-pack','name':'English (bounded working subset)','version':'0.1.0','default_language':'en',
 'graphs':{},'lexicons':['lexicon/lexicon.json'],'features':['features/features.json'],'concepts':['concepts/concepts.json'],
 'tables':[],'node_groups':[],'tests':[],'settings':'settings.json','layouts':[],'dependencies':[],
 'language':{'tag':'en','display_name':'English','autonym':'English','direction':'ltr','capabilities':['analyze','generate']}}
for stage_name,doc in stages.items():
 p=f'graphs/{stage_name.lower()}/{doc["graph"]["id"]}.json';write(p,doc);manifest['graphs'][stage_name]=[p]
# Persisted corpus: lexical productivity within bounded transitive English syntax.
# It deliberately does NOT claim to test English relatives, passives, clitics, etc.
case_paths=[];sentences=set()
verbs=['see','find','take','make','buy','give','write','cook','build']
subjects=['person','girl','man','woman','child','dog','cat','brother']
themes=['book','food','house','city','telescope','dog','cat','person']
for verb in verbs:
 for subject in subjects:
  for theme in themes:
   for tense in ['present','past']:
    for subplural in [False,True]:
     for objplural in [False,True]:
      subj=lexemes[(subject,'Noun')]['forms']['plural' if subplural else 'citation']
      obj=lexemes[(theme,'Noun')]['forms']['plural' if objplural else 'citation']
      form='past' if tense=='past' else 'citation' if subplural else 'present3'
      predicate=lexemes[(verb,'Verb')]['forms'][form]
      sentence=f'The {subj} {predicate} the {obj}.'
      if sentence in sentences:continue
      sentences.add(sentence)
      index=len(case_paths)+1;path=f'tests/en-transitive-{index:03}.json'
      write(path,{'schema_version':1,'id':f'test:en:transitive:{index:03}',
        'name':f'Productive transitive: {sentence}','input_stage':'OrthographyAnalysis','input':{'text':sentence},
        'expected_stage':'Surface','expected_output':{'success':True,'candidateCount':1,'rootConcept':f'sem:event.{verb}','surface':sentence},
        'mode':'fast','assertions':[{'family':'transitive','tense':tense,'subject_plural':subplural,'object_plural':objplural}]})
      case_paths.append(path)
      if len(case_paths)==160:break
     if len(case_paths)==160:break
    if len(case_paths)==160:break
   if len(case_paths)==160:break
  if len(case_paths)==160:break
 if len(case_paths)==160:break
for case_id,sentence,success,n in [
 ('telescope-ambiguity','I saw the man with the telescope.',True,2),
 ('unknown-source','The person flibbertigibbets the food.',False,0)]:
 path=f'tests/en-{case_id}.json'
 write(path,{'schema_version':1,'id':f'test:en:{case_id}','name':case_id,
 'input_stage':'OrthographyAnalysis','input':{'text':sentence},'expected_stage':'MeaningAnalysis',
 'expected_output':{'success':success,'candidateCount':n},'mode':'fast','assertions':[{'family':case_id}]})
 case_paths.append(path)
for index,case in enumerate(english_acceptance_cases(lexemes),1):
 path=f'tests/en-grammar-{index:03}.json'
 expected={'success':True,'candidateCount':1,'surface':case['sentence'],
           'rootConcept':case['rootConcept'],'rootType':case['rootType'],
           'rootFeatures':case['rootFeatures'],'roleConcepts':case['roleConcepts'],
           'roleTypes':case['roleTypes']}
 write(path,{'schema_version':1,'id':f'test:en:grammar:{index:03}',
        'name':f"{case['family']}: {case['sentence']}",
        'input_stage':'OrthographyAnalysis','input':{'text':case['sentence']},
        'expected_stage':'Surface','expected_output':expected,
        'mode':'fast','assertions':[{'family':case['family']}]})
 case_paths.append(path)
for index,case in enumerate(advanced_acceptance_cases(lexemes),1):
 path=f'tests/en-advanced-{index:03}.json'
 expected={'success':True,'candidateCount':1,'surface':case['sentence'],
           'rootConcept':case['rootConcept'],'rootType':case['rootType'],
           'rootFeatures':case['rootFeatures'],'roleConcepts':case['roleConcepts']}
 write(path,{'schema_version':1,'id':f'test:en:advanced:{index:03}',
        'name':f"{case['family']}: {case['sentence']}",
        'input_stage':'OrthographyAnalysis','input':{'text':case['sentence']},
        'expected_stage':'Surface','expected_output':expected,
        'mode':'fast','assertions':[{'family':case['family']}]})
 case_paths.append(path)
manifest['tests']=case_paths
write('project.json',manifest);write('lexicon/lexicon.json',sorted(lexemes.values(),key=lambda x:x['id']));write('features/features.json',[]);write('concepts/concepts.json',sorted(concepts.values(),key=lambda x:x['id']));write('settings.json',{'note':'Bounded English natural-language proof. Not unrestricted English.'});
Path('language-packs').mkdir(exist_ok=True)
Path('language-packs/index.json').write_text(json.dumps([{'id':'english-pack','path':'english.vertax','capabilities':['analyze','generate']}],indent=2)+'\n')
print('Lexemes:',len(lexemes),'Concepts:',len(concepts),'Patterns:',len(pattern_rules))
