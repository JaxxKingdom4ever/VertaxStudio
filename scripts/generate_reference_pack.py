"""Author a bounded reference-conlang recovery pack with normal Vertax JSON APIs.

This is not the lost Phase-6 complete grammar: it is the verified initial
persisted generative subset. All language-specific choices live in the pack.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'examples' / 'reference-language.vertax'

def dump(path, value):
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

shared = [('sem:entity.person','Person','Entity','person'),('sem:entity.food','Food','Entity','food'),('sem:event.cook','Cook','Event','cook')]
private = [
    ('sem:op.question','Question search operator','Operator','vo'),
    ('sem:verb.duru','Active relational marker','Operator','duru'),
    ('sem:aspect.continuous','Continuous aspect','Operator','esi'),
    ('sem:aspect.complete','Completed aspect','Operator','ino'),
    ('sem:tense.past','Past suffix','Operator','in'),
    ('sem:tense.future','Future suffix','Operator','as'),
    ('sem:polarity.negative','Negation','Operator','zar'),
    ('sem:entity.he','Third-person male pronoun','Entity','muko'),
    ('sem:entity.she','Third-person female pronoun','Entity','nuko'),
    ('sem:entity.they','Third-person plural pronoun','Entity','ukolo'),
    ('sem:entity.we','First-person plural pronoun','Entity','kolo'),
    ('sem:entity.it','Third-person inanimate pronoun','Entity','oko'),
    ('sem:entity.you','Second-person pronoun','Entity','uko'),
    ('sem:entity.first_person','First-person singular pronoun','Entity','ko'),
    ('sem:event.put','Put/place event','Event','ekumet'),
    ('sem:entity.book','Book','Entity','lubik'),
    ('sem:entity.table','Table','Entity','besato'),
    ('sem:adposition.on','On/at relation','Operator','wudo'),
    ('sem:op.possession','Possessive relation','Operator','lez'),
    ('sem:op.conditional','Subordinate conditional suffix','Operator','sa'),
    ('sem:modality.necessity','Necessity modality','Modality','yudek'),
    ('sem:modality.probability','Probability modality','Modality','owit'),
]
# The operator stems and example adjective are intentionally *unconfirmed*.
# The comparative suffixes, unlike those lexical stems, are established.
additional = [
    ('sem:coord.add','Addition-tail lexical verb','Operator','⟦ADD⟧'),
    ('sem:coord.alternative','Alternative-tail lexical verb','Operator','⟦OR⟧'),
    ('sem:coord.contrast','Contrast-tail lexical verb','Operator','⟦BUT⟧'),
    ('sem:compare.more','More-comparative suffix','Operator','pu'),
    ('sem:compare.less','Less-comparative suffix','Operator','mo'),
    ('sem:compare.equal','Equal-comparative suffix','Operator','ga'),
    ('sem:property.tall','Illustrative height property','Property','⟦TALL⟧'),
]
entries = shared + private + additional
concepts = [{'id':id,'label':label,'semanticType':kind,'metadata':{'status':'provisional-stem' if form.startswith('⟦') else 'attested-marker'} if id.startswith(('sem:coord.','sem:compare.','sem:property.tall')) else {}} for id,label,kind,form in entries]
# This structural relation is a semantic concept, not a spoken word.
concepts.append({'id':'sem:relation.conditional','label':'Conditional relation','semanticType':'Relation','metadata':{}})
concepts.extend([
    {'id':'sem:list.coordination','label':'Dynamic coordination list','semanticType':'SemanticList','metadata':{}},
    {'id':'sem:relation.comparison','label':'Scalar comparison','semanticType':'Relation','metadata':{}},
])
lexemes = [{
  'id': f'lex:{id.removeprefix("sem:")}', 'conceptId':id,
  'lexicalClass':'Verb' if kind=='Event' else 'Noun' if kind=='Entity' else 'Property' if kind=='Property' else 'Operator',
  'forms': {'citation':form}, 'features':{'values':{}},
  'valency':[], 'relatedLexemes':{}, 'irregularRuleIds':[], 'metadata':({'status':'provisional' if form.startswith('⟦') else 'attested-marker'} if id.startswith(('sem:coord.','sem:compare.','sem:property.tall')) else {})
} for id,_,kind,form in entries]

def segment(*,role=None,root=False,concept=None,kind=None,join=None):
    value = {'role':role} if role is not None else {'root':True} if root else {'conceptId':concept}
    if kind is not None: value['kind']=kind
    if join is not None: value['joinBefore']=join
    return value

agent=segment(role='agent')
patient=segment(role='theme')
root=segment(root=True)
question=segment(concept='sem:op.question',kind='Suffix',join="'")
duru=segment(concept='sem:verb.duru')
esi=segment(concept='sem:aspect.continuous')
ino=segment(concept='sem:aspect.complete')
past=segment(concept='sem:tense.past',kind='Suffix',join='')
future=segment(concept='sem:tense.future',kind='Suffix',join='')
negative=segment(concept='sem:polarity.negative')
theme_expansion={'expandRole':'theme'}
possession_expansion={'expandRole':'possessor','suffix':[segment(concept='sem:op.possession',kind='Suffix',join="'")]}
scope_expansion={'expandRole':'scope','scopeType':'ModalScope','acceptedTypes':['Event','Modality']}
# Clause-level semantic relations carry their subordinate clauses explicitly.
# The relation itself contributes no word: its child marks conditional mood.
conditional={'expandRole':'condition','scopeType':'ConditionalScope','acceptedTypes':['Event'],
  'requiredFeatures':{'clause':'conditional'}}
consequence={'expandRole':'consequence','scopeType':'ConsequenceScope','acceptedTypes':['Event','Relation']}
complement={'expandRole':'complement','scopeType':'Complement','acceptedTypes':['Event','Relation']}
conditional_suffix=segment(concept='sem:op.conditional',kind='Suffix',join='')
conditional_subject={'expandRole':'agent','suffix':[conditional_suffix]}

def rule(id, *,features=None, agent_type='Entity',role_types=None,concept_id='sem:event.cook',required_roles=None,words):
    return {'id':id,'conceptId':concept_id,'features':features or {},'requiredRoles':required_roles if required_roles is not None else ['agent','theme'],
        'roleTypes':role_types if role_types is not None else {'agent':agent_type},'words':words}

patterns=[
 # A complement caller must emit its verb before opening the child scope.
 rule('complement-call',concept_id='sem:verb.duru',required_roles=['agent','complement'],words=[[agent],[root],complement]),
 rule('complement-call-negative',concept_id='sem:verb.duru',features={'polarity':'negative'},
      required_roles=['agent','complement'],words=[[agent],[negative],[root],complement]),
 # The conditional relation first resolves its subordinate scope and only
 # then its consequent. This ordering is authored, not built into core.
 {'id':'conditional-relation','conceptId':'sem:relation.conditional','valueTypes':['Relation'],
  'requiredRoles':['condition','consequence'],'words':[conditional,consequence]},
 # -sa is affixed to the subordinate subject; impersonal clauses attach it
 # to the verb instead. Polarity belongs to that clause, never its parent.
 rule('conditional-subject-negative',features={'clause':'conditional','polarity':'negative'},
      words=[conditional_subject,[negative],[root],theme_expansion]),
 rule('conditional-subject-past',features={'clause':'conditional','tense':'past'},
      words=[conditional_subject,[root,past],theme_expansion]),
 rule('conditional-subject',features={'clause':'conditional'},
      words=[conditional_subject,[root],theme_expansion]),
 rule('conditional-impersonal-negative',features={'clause':'conditional','impersonal':True,'polarity':'negative'},
      required_roles=['theme'],role_types={},words=[[negative],[root,conditional_suffix],theme_expansion]),
 rule('conditional-impersonal',features={'clause':'conditional','impersonal':True},
      required_roles=['theme'],role_types={},words=[[root,conditional_suffix],theme_expansion]),
 rule('question-continuous',features={'aspect':'continuous'},agent_type='Unknown',words=[[agent,question],[duru],[esi,segment(root=True,join="'")],theme_expansion]),
 rule('question-progressive',features={'aspect':'progressive'},agent_type='Unknown',words=[[agent,question],[duru],[esi,segment(root=True,join="'")],theme_expansion]),
 rule('statement-continuous',features={'aspect':'continuous'},words=[[agent],[duru],[esi,segment(root=True,join="'")],theme_expansion]),
 rule('statement-progressive',features={'aspect':'progressive'},words=[[agent],[duru],[esi,segment(root=True,join="'")],theme_expansion]),
 rule('statement-complete',features={'aspect':'complete'},words=[[agent],[ino,segment(root=True,join="'")],theme_expansion]),
 rule('statement-past',features={'tense':'past'},words=[[agent],[root,past],theme_expansion]),
 rule('statement-future',features={'tense':'future'},words=[[agent],[root,future],theme_expansion]),
 rule('statement-negative',features={'polarity':'negative'},words=[[agent],[negative],[root],theme_expansion]),
 rule('statement-perfect',features={'aspect':'perfect'},words=[[agent],[ino,segment(root=True,join="'")],theme_expansion]),
 rule('question-object',role_types={'agent':'Entity','theme':'Unknown'},words=[[agent],[root],[patient,question]]),
 rule('question-polar',features={'question':'yesno'},words=[[agent],[root,question],theme_expansion]),
 rule('imperative-put',concept_id='sem:event.put',required_roles=['theme','location'],role_types={},features={'mood':'imperative'},words=[theme_expansion,[root],[segment(role='location'),segment(concept='sem:adposition.on',kind='Suffix',join="'")]]),
 rule('question-agent',agent_type='Unknown',words=[[agent,question],[root],theme_expansion]),
 rule('statement-simple',words=[[agent],[root],theme_expansion]),
 {'id':'recursive-noun-possession','conceptId':'*','valueTypes':['Entity','Reference'],'requiredRoles':['possessor'],
   'roleTypes':{'possessor':'Entity'},'words':[possession_expansion,[root]]},
 {'id':'necessity-modality','conceptId':'sem:modality.necessity','requiredRoles':['scope'],
   'words':[[root],scope_expansion]},
 {'id':'probability-modality','conceptId':'sem:modality.probability','requiredRoles':['scope'],
   'words':[[root],scope_expansion]},
]
# A tail operator is a project lexeme attached to the *next* realized member.
# The generic role expander enforces item cardinality and handles any depth.
for mode,operator in [('add','sem:coord.add'),('alternative','sem:coord.alternative'),('contrast','sem:coord.contrast')]:
    patterns.append({'id':f'dynamic-coordination-{mode}','conceptId':'sem:list.coordination',
        'valueTypes':['SemanticList'],'features':{'mode':mode},'requiredRoles':['members'],
        'words':[{'expandRole':'members','minItems':2,'prefix':[segment(concept=operator)],'prefixBoundary':"'"}]})
# The first comparison subject is the attachment site, even if it has a
# recursive possessor; superlatives instead attach to the property itself.
for degree,operator in [('more','sem:compare.more'),('less','sem:compare.less'),('equal','sem:compare.equal')]:
    patterns.append({'id':f'comparison-{degree}','conceptId':'sem:relation.comparison',
        'valueTypes':['Relation'],'features':{'degree':degree},
        'requiredRoles':['first','property','second'],
        'words':[{'expandRole':'first','suffix':[segment(concept=operator,kind='Suffix',join="'")]},
                 {'expandRole':'property'},{'expandRole':'second'}]})
for grade,operator in [('highest','sem:compare.more'),('lowest','sem:compare.less')]:
    patterns.append({'id':f'superlative-{grade}','conceptId':'sem:property.tall',
        'valueTypes':['Property'],'features':{'degree':grade},
        'words':[[root,segment(concept=operator,kind='Suffix',join="'")]]})
patterns.append({'id':'property-tall-plain','conceptId':'sem:property.tall',
    'valueTypes':['Property'],'features':{},'words':[[root]]})

main_graph={'id':'reference-grammar','nodes':[{'id':'realize-clause','typeId':'node-group:reference-clause','params':{}}],
  'edges':[],'exposedInputs':[{'graphPortId':'value','nodeId':'realize-clause','nodePortId':'value'}],
  'exposedOutputs':[{'graphPortId':'value','nodeId':'realize-clause','nodePortId':'value'}]}
internal={'id':'reference-clause-internal','nodes':[{'id':'realize-authored-words','typeId':'grammar.realize-words','params':{'patterns':{'$groupParam':'patterns'}}}],
  'edges':[],'exposedInputs':[{'graphPortId':'value','nodeId':'realize-authored-words','nodePortId':'value'}],
  'exposedOutputs':[{'graphPortId':'value','nodeId':'realize-authored-words','nodePortId':'value'}]}
group={'schema_version':1,'id':'reference-clause','name':'Reference Clause & Phrase Realization','version':'0.2.0',
  'description':'Project-owned tense, aspect, recursive possession, nested complement/conditional scopes and interrogative constructions over shared semantic concepts.',
  'inputs':[{'id':'value','direction':'input','acceptedTypes':['Event','Entity','Modality','Relation','SemanticList','Property'],'cardinality':'ONE','required':True}],
  'outputs':[{'id':'value','direction':'output','acceptedTypes':['MorphCandidate'],'cardinality':'MANY','required':False}],
  'parameters':[{'id':'patterns','label':'Authored word patterns','valueType':'json','required':False,'defaultValue':patterns}],
  'internal_graph':internal,'test_ids':[]}

def stage(stage_name,id,node_type,matcher_type,params=None):
    g={'id':id,'nodes':[{'id':'realize','typeId':node_type,'params':params or {}}], 'edges':[],
        'exposedInputs':[{'graphPortId':'value','nodeId':'realize','nodePortId':'value'}],
        'exposedOutputs':[{'graphPortId':'value','nodeId':'realize','nodePortId':'value'}]}
    return {'schema_version':1,'stage':stage_name,'graph':g,'rules':[{'id':f'{id}-rule','stage':stage_name,
      'matcher':{'kind':'type','type':matcher_type},'graphId':id,'priority':100,'fallback':False}]}

graphs={
 'Grammar': {'schema_version':1,'stage':'Grammar','graph':main_graph,'rules':[
   {'id':'reference-grammar-rule' if type=='Event' else f'reference-grammar-{type.lower()}','stage':'Grammar','matcher':{'kind':'type','type':type},'graphId':'reference-grammar','priority':100,'fallback':False}
   for type in ['Event','Entity','Modality','Relation','SemanticList','Property']]},
 'Morphology':stage('Morphology','reference-morphology','morph.lexical','MorphCandidate'),
 'Phonology':stage('Phonology','reference-phonology','phon.from-morphs','MorphSequence'),
 'Surface':stage('Surface','reference-surface','surface.spell','PhonologicalForm',{'boundaries':{'Morpheme':"'",'Affix':''}})
}
manifest={
 'schema_version':2,'id':'reference-conlang-recovery','name':'Reference conlang (recovery subset)','version':'0.1.0','default_language':'x-vertax-reference',
 'graphs':{name:[f'graphs/{name.lower()}/{doc["graph"]["id"]}.json'] for name,doc in graphs.items()},
 'lexicons':['lexicon/lexicon.json'],'features':['features/features.json'],'concepts':['concepts/concepts.json'],
 'tables':[],'node_groups':['node-groups/reference-clause.json'], 'tests':[], 'settings':'settings.json', 'layouts':[],'dependencies':[],
 'language':{'tag':'x-vertax-reference','display_name':'Reference conlang recovery subset','autonym':'Reference conlang','direction':'ltr','capabilities':['generate']}
}

dump('concepts/concepts.json',concepts)
dump('features/features.json',[])
dump('lexicon/lexicon.json',lexemes)
dump('settings.json',{'traceDefault':False,'note':'Bounded recovered subset; not full Phase 6 reference grammar.'})
dump('node-groups/reference-clause.json',group)
for name,doc in graphs.items():dump(f'graphs/{name.lower()}/{doc["graph"]["id"]}.json',doc)

def meaning(tense=None,aspect=None,polarity=None,unknown=False,agent_concept='sem:entity.person',theme_unknown=False,question_feature=None):
    features={name:value for name,value in [('tense',tense),('aspect',aspect),('polarity',polarity),('question',question_feature)] if value is not None}
    return {'roots':['cook'],'objects':{
      'agent':{'id':'agent','type':'Unknown' if unknown else 'Entity','conceptId':agent_concept,'roles':{},'features':{'values':{}}},
      'food':{'id':'food','type':'Unknown' if theme_unknown else 'Entity','conceptId':'sem:entity.food','roles':{},'features':{'values':{}}},
      'cook':{'id':'cook','type':'Event','conceptId':'sem:event.cook','roles':{'agent':['agent'],'theme':['food']},'features':{'values':features}}
    }}

cases=[
 ('question-continuous',meaning(aspect='continuous',unknown=True),"person'vo duru esi'cook food"),
 ('statement-present',meaning(tense='present'),'person cook food'),
 ('statement-continuous',meaning(aspect='continuous'),"person duru esi'cook food"),
 ('statement-complete',meaning(aspect='complete'),"person ino'cook food"),
 ('statement-past',meaning(tense='past'),'person cookin food'),
 ('statement-future',meaning(tense='future'),'person cookas food'),
 ('statement-negative',meaning(polarity='negative'),'person zar cook food'),
 ('question-agent',meaning(unknown=True),"person'vo cook food"),
 ('statement-progressive',meaning(aspect='progressive'),"person duru esi'cook food"),
 ('statement-perfect',meaning(aspect='perfect'),"person ino'cook food"),
 ('question-object',meaning(tense='present',theme_unknown=True),"person cook food'vo"),
 ('question-polar',meaning(tense='present',question_feature='yesno'),"person cook'vo food"),
 *[(f'pronoun-{id.rsplit(".",1)[-1]}',meaning(tense='present',agent_concept=id),f'{form} cook food') for id,form in [('sem:entity.he','muko'),('sem:entity.she','nuko'),('sem:entity.they','ukolo'),('sem:entity.we','kolo'),('sem:entity.it','oko'),('sem:entity.you','uko'),('sem:entity.first_person','ko')]],
 ('imperative-put',{'roots':['put'],'objects':{'book':{'id':'book','type':'Entity','conceptId':'sem:entity.book','roles':{},'features':{'values':{}}},'table':{'id':'table','type':'Entity','conceptId':'sem:entity.table','roles':{},'features':{'values':{}}},'put':{'id':'put','type':'Event','conceptId':'sem:event.put','roles':{'theme':['book'],'location':['table']},'features':{'values':{'mood':'imperative'}}}}},"lubik ekumet besato'wudo")
]
def possession_graph(depth, owner='sem:entity.first_person', use='standalone'):
    objects={'owner':{'id':'owner','type':'Entity','conceptId':owner,'roles':{},'features':{'values':{}}}}
    previous='owner'
    for level in range(1,depth+1):
        key=f'book{level}'
        objects[key]={'id':key,'type':'Entity','conceptId':'sem:entity.book','roles':{'possessor':[previous]},'features':{'values':{}}}
        previous=key
    if use=='imperative':
        objects['table']={'id':'table','type':'Entity','conceptId':'sem:entity.table','roles':{},'features':{'values':{}}}
        objects['put']={'id':'put','type':'Event','conceptId':'sem:event.put','roles':{'theme':[previous],'location':['table']},'features':{'values':{'mood':'imperative'}}}
        return {'roots':['put'],'objects':objects}
    if use=='statement':
        objects['person']={'id':'person','type':'Entity','conceptId':'sem:entity.person','roles':{},'features':{'values':{}}}
        objects['cook']={'id':'cook','type':'Event','conceptId':'sem:event.cook','roles':{'agent':['person'],'theme':[previous]},'features':{'values':{'tense':'present'}}}
        return {'roots':['cook'],'objects':objects}
    return {'roots':[previous],'objects':objects}

for depth in [1,2,3,4,5,6]:
    stem="ko'lez "+"'lez ".join(['lubik']*depth)
    cases.append((f'possessive-{["zero","one","two","three","four","five","six"][depth]}',possession_graph(depth),stem))
cases.extend([
    ('imperative-possessive',possession_graph(2,use='imperative'),"ko'lez lubik'lez lubik ekumet besato'wudo"),
    ('declarative-possessive',possession_graph(2,use='statement'),"person cook ko'lez lubik'lez lubik"),
])
def modal_graph(stacked=False):
    base=meaning(tense='present')
    base['objects']['must']={'id':'must','type':'Modality','conceptId':'sem:modality.necessity','roles':{'scope':['cook']},'features':{'values':{}}}
    if stacked:
        base['objects']['maybe']={'id':'maybe','type':'Modality','conceptId':'sem:modality.probability','roles':{'scope':['must']},'features':{'values':{}}}
    base['roots']=['maybe' if stacked else 'must']
    return base
cases.extend([
  ('modal-necessity',modal_graph(),'yudek person cook food'),
  ('modal-stacked',modal_graph(True),'owit yudek person cook food'),
])

# Explicit semantic propositions for complement calls and conditionals.
# `duru` is an attested lexical form reused here to exercise the calling
# position; the semantics of this *sample usage* are provisional pending
# the author's conlang review. No unconfirmed vocabulary is introduced.
def complement_graph(depth=1,negative=False,past=False):
    m=meaning(tense='past' if past else 'present')
    m['objects']['me']={'id':'me','type':'Entity','conceptId':'sem:entity.first_person','roles':{},'features':{'values':{}}}
    previous='cook'
    for level in range(1,depth+1):
        key=f'caller{level}'
        m['objects'][key]={'id':key,'type':'Event','conceptId':'sem:verb.duru',
          'roles':{'agent':['me'],'complement':[previous]},
          'features':{'values':{'polarity':'negative'} if negative and level==depth else {}}}
        previous=key
    m['roots']=[previous]
    return m

def conditional_graph(impersonal=False,negative_condition=False,negative_main=False,
                      past_condition=False,nested=False,possessed=False,complement_call=False):
    m=meaning(tense='present' if not negative_main else None,polarity='negative' if negative_main else None)
    m['objects']['me']={'id':'me','type':'Entity','conceptId':'sem:entity.first_person','roles':{},'features':{'values':{}}}
    condition_agent='me'
    if possessed:
        condition_agent='owned'
        m['objects']['owned']={'id':'owned','type':'Entity','conceptId':'sem:entity.book',
            'roles':{'possessor':['me']},'features':{'values':{}}}
    cond_roles={'theme':['food']}
    if not impersonal:cond_roles['agent']=[condition_agent]
    cond_features={'clause':'conditional'}
    if impersonal:cond_features['impersonal']=True
    if negative_condition:cond_features['polarity']='negative'
    if past_condition:cond_features['tense']='past'
    m['objects']['cond']={'id':'cond','type':'Event','conceptId':'sem:event.cook',
                         'roles':cond_roles,'features':{'values':cond_features}}
    consequence='cook'
    if nested:
        m['objects']['cond2']={'id':'cond2','type':'Event','conceptId':'sem:event.cook',
          'roles':{'agent':['agent'],'theme':['food']},'features':{'values':{'clause':'conditional'}}}
        m['objects']['if2']={'id':'if2','type':'Relation','conceptId':'sem:relation.conditional',
          'roles':{'condition':['cond2'],'consequence':['cook']},'features':{'values':{}}}
        consequence='if2'
    m['objects']['if1']={'id':'if1','type':'Relation','conceptId':'sem:relation.conditional',
       'roles':{'condition':['cond'],'consequence':[consequence]},'features':{'values':{}}}
    m['roots']=['if1']
    if complement_call:
        m['objects']['caller']={'id':'caller','type':'Event','conceptId':'sem:verb.duru',
          'roles':{'agent':['me'],'complement':['if1']},'features':{'values':{}}}
        m['roots']=['caller']
    return m

cases.extend([
    ('complement-basic',complement_graph(),'ko duru person cook food'),
    ('complement-nested',complement_graph(depth=2),'ko duru ko duru person cook food'),
    ('complement-negative',complement_graph(negative=True),'ko zar duru person cook food'),
    ('complement-past',complement_graph(past=True),'ko duru person cookin food'),
    ('condition-personal',conditional_graph(),'kosa cook food person cook food'),
    ('condition-impersonal',conditional_graph(impersonal=True),'cooksa food person cook food'),
    ('condition-negative',conditional_graph(negative_condition=True),'kosa zar cook food person cook food'),
    ('condition-negative-consequence',conditional_graph(negative_main=True),'kosa cook food person zar cook food'),
    ('condition-negative-impersonal',conditional_graph(impersonal=True,negative_condition=True),'zar cooksa food person cook food'),
    ('condition-past',conditional_graph(past_condition=True),'kosa cookin food person cook food'),
    ('condition-possessed-subject',conditional_graph(possessed=True),"ko'lez lubiksa cook food person cook food"),
    ('condition-nested',conditional_graph(nested=True),'kosa cook food personsa cook food person cook food'),
    ('complement-conditional',conditional_graph(complement_call=True),'ko duru kosa cook food person cook food'),
])
# Corpus cases exercise tail semantics, recursive member expansion,
# comparison attachment, and the distinct property superlative route.
def nominal(id,concept='sem:entity.person',roles=None):
    return {'id':id,'type':'Entity','conceptId':concept,'roles':roles or {},'features':{'values':{}}}
def property_value(id,degree=None):
    return {'id':id,'type':'Property','conceptId':'sem:property.tall',
        'roles':{},'features':{'values':{'degree':degree} if degree else {}}}
def simple_event(id,theme='food'):
    return {'id':id,'type':'Event','conceptId':'sem:event.cook',
        'roles':{'agent':['person'],'theme':[theme]},'features':{'values':{'tense':'present'}}}
def coordinated(id,mode,members):
    return {'id':id,'type':'SemanticList','conceptId':'sem:list.coordination',
        'roles':{'members':members},'features':{'values':{'mode':mode}}}
def compared(id,degree):
    return {'id':id,'type':'Relation','conceptId':'sem:relation.comparison',
        'roles':{'first':['person'],'property':['tall'],'second':['food']},
        'features':{'values':{'degree':degree}}}
lexical_base={'me':nominal('me','sem:entity.first_person'),'person':nominal('person'),
    'food':nominal('food','sem:entity.food'),'book':nominal('book','sem:entity.book')}
subjects={name:value for name,value in lexical_base.items() if name!='me'}
base_comparison={'person':lexical_base['person'],'food':lexical_base['food'],'tall':property_value('tall')}
additional_cases={
 'coordination-add-three':('coord',dict(lexical_base,coord=coordinated('coord','add',['me','person','food'])),"ko ⟦ADD⟧'person ⟦ADD⟧'food"),
 'coordination-add-four':('coord',dict(lexical_base,coord=coordinated('coord','add',['me','person','food','book'])),"ko ⟦ADD⟧'person ⟦ADD⟧'food ⟦ADD⟧'lubik"),
 'coordination-add-possession':('coord',dict(lexical_base,book=nominal('book','sem:entity.book',{'possessor':['me']}),coord=coordinated('coord','add',['person','book'])),"person ⟦ADD⟧'ko'lez lubik"),
 'coordination-add-nested':('coord',dict(lexical_base,inner=coordinated('inner','add',['food','book']),coord=coordinated('coord','add',['person','inner'])),"person ⟦ADD⟧'food ⟦ADD⟧'lubik"),
 'coordination-alternative-two':('coord',dict(subjects,coord=coordinated('coord','alternative',['person','food'])),"person ⟦OR⟧'food"),
 'coordination-alternative-three':('coord',dict(subjects,coord=coordinated('coord','alternative',['person','food','book'])),"person ⟦OR⟧'food ⟦OR⟧'lubik"),
 'coordination-contrast-clauses':('coord',dict(subjects,first=simple_event('first'),second=simple_event('second','book'),coord=coordinated('coord','contrast',['first','second'])),"person cook food ⟦BUT⟧'person cook lubik"),
 'coordination-contrast-three':('coord',dict(subjects,first=simple_event('first'),second=simple_event('second','book'),third=simple_event('third'),coord=coordinated('coord','contrast',['first','second','third'])),"person cook food ⟦BUT⟧'person cook lubik ⟦BUT⟧'person cook food"),
 'comparison-more':('compare',dict(base_comparison,compare=compared('compare','more')),"person'pu ⟦TALL⟧ food"),
 'comparison-less':('compare',dict(base_comparison,compare=compared('compare','less')),"person'mo ⟦TALL⟧ food"),
 'comparison-equal':('compare',dict(base_comparison,compare=compared('compare','equal')),"person'ga ⟦TALL⟧ food"),
 'comparison-possessed-first':('compare',dict(base_comparison,owner=nominal('owner','sem:entity.first_person'),person=nominal('person','sem:entity.person',{'possessor':['owner']}),compare=compared('compare','more')),"ko'lez person'pu ⟦TALL⟧ food"),
 'comparison-possessed-second':('compare',dict(base_comparison,owner=nominal('owner','sem:entity.first_person'),food=nominal('food','sem:entity.book',{'possessor':['owner']}),compare=compared('compare','more')),"person'pu ⟦TALL⟧ ko'lez lubik"),
 'comparison-coordinated-second':('compare',dict(base_comparison,food=coordinated('food','add',['person','other']),other=nominal('other','sem:entity.food'),compare=compared('compare','more')),"person'pu ⟦TALL⟧ person ⟦ADD⟧'food"),
 'superlative-highest':('tall',{'tall':property_value('tall','highest')},"⟦TALL⟧'pu"),
 'superlative-lowest':('tall',{'tall':property_value('tall','lowest')},"⟦TALL⟧'mo"),
}
for name,(root_id,objects,expected) in additional_cases.items():
    cases.append((name,{'roots':[root_id],'objects':objects},expected))

for id,source,target in cases:
    path=f'tests/{id}.json'
    manifest['tests'].append(path)
    dump(path,{'schema_version':1,'id':id,'name':id.replace('-',' ')+(' (provisional stems where bracketed)' if id in additional_cases else ''),'input_stage':'Meaning','input':source,'expected_stage':'Surface','expected_output':{'surface':target},'mode':'trace','assertions':[]})
dump('project.json',manifest)
print('Wrote',ROOT,'with',len(patterns),'grammar constructions and',len(cases),'persisted Meaning→Surface tests')
