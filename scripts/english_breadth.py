"""Additional English constructions authored as *pack data*, never runtime language branches.

Each case specifies the same ordinary SyntaxPattern/GenerationPattern interfaces
used by user-created Vertax language packs. The Python file is an authoring aid:
at runtime only the persisted JSON project is loaded.
"""
from copy import deepcopy


def extend(patterns, generations, lexemes, concepts, add):
    for word, category in [
        ('not','Particle'), ('what','Pronoun'), ('who','Pronoun'),
        ('happy','Adjective'), ('girl','Noun'), ('boy','Noun'), ('food','Noun'),
        ('cook','Verb'), ('give','Verb'), ('see','Verb'), ('be','Verb'),
        ('teach','Verb'), ('tell','Verb'), ('bring','Verb'), ('send','Verb'),
        ('show','Verb'), ('offer','Verb'),
        ('do','Verb'), ('have','Verb'), ('will','Modal'), ('can','Modal'),
        ('she','Pronoun'), ('and','Conjunction'), ('by','Preposition'),
        ('in','Preposition'), ('the','Determiner'), ('good','Adjective'),
        ('tall','Adjective'), ('ready','Adjective'), ('busy','Adjective'),
        ('small','Adjective'), ('red','Adjective')
    ]:
        add(word, category)
    lexemes[('be','Verb')]['forms'].update({'presentPlural':'are','presentFirst':'am','pastPlural':'were'})
    for concept, semantic_type, label in [
        ('sem:state.copula','State','copular predication'),
        ('sem:group.coordination','Group','coordinated group'),
        ('sem:entity.unknown','Unknown','unknown/question argument'),
    ]:
        concepts[concept]={'id':concept,'label':label,'semanticType':semantic_type,'metadata':{}}

    def s(cat=None, form=None, text=None):
        out={}
        if cat is not None: out['classes']=[cat]
        if form is not None: out['formKeys']=[form] if isinstance(form,str) else form
        if text is not None: out['text']=text
        return out
    THE=s(text='the'); NOUN=s('Noun',['citation','plural']); NOUN_SING=s('Noun','citation');
    VB=lambda form:s('Verb',form)
    PERIOD=s(text='.'); Q=s(text='?')
    def obj(name, kind, slot=None, concept=None, roles=None,features=None):
        result={'id':name,'type':kind}
        if slot is not None: result['slot']=slot
        if concept is not None: result['conceptId']=concept
        if roles is not None: result['roles']=roles
        if features is not None: result['features']=features
        return result
    def event(root_slot,agent_slot,theme_slot,features,**extra):
        roles={'agent':['agent'],'theme':['theme']}
        objects=[obj('agent','Entity',agent_slot), obj('theme','Entity',theme_slot)]
        for role,detail in extra.items():
            node_id=detail.get('id',role)
            roles[role]=[node_id]
            objects.append(obj(node_id,detail.get('type','Entity'),detail.get('slot'),detail.get('conceptId'),detail.get('roles'),detail.get('features')))
        return {'root':'event','objects':[obj('event','Event',root_slot,roles=roles,features=features),*objects]}
    def pat(name,slots,meaning,constraints=None):
        entry={'id':name,'slots':deepcopy(slots),'meaning':meaning}
        if constraints: entry['slotConstraints']=constraints
        patterns.append(entry)
    def g(name, features,parts,**settings):
        generations.append({'id':name,'conceptId':'*','features':features,'requiredRoles':['agent','theme'],
                            'parts':parts,'capitalize':True,'priority':30,**settings})
    L=lambda text:{'literal':text}
    P=lambda role,form='citation':{'role':role,'formKey':form}
    PF=lambda role:{'role':role,'formKeyFrom':{'role':role,'featureId':'number',
                                             'values':{'plural':'plural'},'default':'citation'}}
    R=lambda form:{'root':True,'formKey':form}
    RP=lambda path,form='citation':{'path':[{'role':r,'index':i} for r,i in path],'formKey':form}
    agent=lambda: [L('the'),PF('agent')]
    theme=lambda: [L('the'),PF('theme')]
    end=[L('.')]

    # Future and three distinct auxiliary constructions (tense and aspect stay separate).
    pat('future',[THE,NOUN,s(text='will'),VB('citation'),THE,NOUN,PERIOD],event(3,1,5,{'tense':'future'}))
    g('future',{'tense':'future'},agent()+[L('will'),R('citation')]+theme()+end)

    pat('progressive-singular',[THE,NOUN_SING,s('Verb','present3',text='is'),VB('progressive'),THE,NOUN,PERIOD],
        event(3,1,5,{'tense':'present','aspect':'progressive'}))
    pat('progressive-plural',[THE,s('Noun','plural'),s('Verb','presentPlural',text='are'),VB('progressive'),THE,NOUN,PERIOD],
        event(3,1,5,{'tense':'present','aspect':'progressive'}))
    g('progressive-singular',{'tense':'present','aspect':'progressive'},agent()+[L('is'),R('progressive')]+theme()+end)
    g('progressive-plural',{'tense':'present','aspect':'progressive'},agent()+[L('are'),R('progressive')]+theme()+end,
      roleFeatures={'agent':{'number':'plural'}})

    pat('perfect',[THE,NOUN_SING,s('Verb','present3',text='has'),VB('participle'),THE,NOUN,PERIOD],
        event(3,1,5,{'tense':'present','aspect':'perfect'}))
    g('perfect',{'tense':'present','aspect':'perfect'},agent()+[L('has'),R('participle')]+theme()+end)

    # English negation and polar inversion require ordinary syntax rules in the pack.
    pat('negative-present',[THE,NOUN_SING,s('Verb','present3',text='does'),s(text='not'),VB('citation'),THE,NOUN,PERIOD],
        event(4,1,6,{'tense':'present','polarity':'negative'}))
    g('negative-present',{'tense':'present','polarity':'negative'},agent()+[L('does'),L('not'),R('citation')]+theme()+end)
    pat('negative-past',[THE,NOUN_SING,s('Verb','past',text='did'),s(text='not'),VB('citation'),THE,NOUN,PERIOD],
        event(4,1,6,{'tense':'past','polarity':'negative'}))
    g('negative-past',{'tense':'past','polarity':'negative'},agent()+[L('did'),L('not'),R('citation')]+theme()+end)
    pat('yesno-present',[s('Verb','present3',text='does'),THE,NOUN_SING,VB('citation'),THE,NOUN,Q],
        event(3,2,5,{'tense':'present','question':'yesno'}))
    g('yesno-present',{'tense':'present','question':'yesno'},[L('does')]+agent()+[R('citation')]+theme()+[L('?')])
    pat('yesno-past',[s('Verb','past',text='did'),THE,NOUN_SING,VB('citation'),THE,NOUN,Q],
        event(3,2,5,{'tense':'past','question':'yesno'}))
    g('yesno-past',{'tense':'past','question':'yesno'},[L('did')]+agent()+[R('citation')]+theme()+[L('?')])

    licensing_verbs=['sem:event.'+word for word in ('give','teach','tell','bring','send','show','offer')]
    pat('ditransitive',[THE,NOUN,dict(VB('past'),conceptIds=licensing_verbs),THE,NOUN,THE,NOUN,PERIOD],
        event(2,1,6,{'tense':'past'},recipient={'slot':4}))
    g('ditransitive',{'tense':'past'},agent()+[R('past'),L('the'),PF('recipient')]+theme()+end,
      requiredRoles=['agent','recipient','theme'],priority=40)

    # Passive agents are semantic agents even when English surface reverses the roles.
    pat('passive',[THE,NOUN,s('Verb','past',text='was'),VB('participle'),s(text='by'),THE,NOUN,PERIOD],
        event(3,6,1,{'tense':'past','voice':'passive'}))
    g('passive',{'tense':'past','voice':'passive'},theme()+[L('was'),R('participle'),L('by')]+agent()+end)

    pat('locative',[THE,NOUN,VB('past'),THE,NOUN,s(text='in'),THE,NOUN,PERIOD],
        event(2,1,4,{'tense':'past'},location={'slot':7}))
    g('locative',{'tense':'past'},agent()+[R('past')]+theme()+[L('in'),L('the'),PF('location')]+end,
      requiredRoles=['agent','theme','location'],priority=40)

    # Predication: State root; the adjective remains a separate semantic property.
    pat('copular-state',[THE,NOUN_SING,s('Verb','present3',text='is'),s('Adjective'),PERIOD],
        {'root':'state','objects':[obj('state','State',concept='sem:state.copula',roles={'subject':['agent'],'quality':['quality']},features={'tense':'present'}),
                                   obj('agent','Entity',1),obj('quality','Property',3)]})
    generations.append({'id':'copular-state','conceptId':'sem:state.copula','features':{'tense':'present'},
                        'requiredRoles':['subject','quality'], 'parts':[L('the'),P('subject'),L('is'),P('quality'),L('.')],
                        'capitalize':True,'priority':40})

    # Modifier is a role of the entity, not a different noun concept.
    pat('attributive-adjective',[THE,s('Adjective'),NOUN_SING,VB('past'),THE,NOUN,PERIOD],
        {'root':'event','objects':[
           obj('event','Event',3,roles={'agent':['agent'],'theme':['theme']},features={'tense':'past','syntax':'modified-subject'}),
           obj('agent','Entity',2,roles={'quality':['quality']}),obj('quality','Property',1),obj('theme','Entity',5)]})
    g('attributive-adjective',{'tense':'past','syntax':'modified-subject'},
      [L('the'),RP([('agent',0),('quality',0)]),PF('agent'),R('past')]+theme()+end)

    # Coordination is a Group and two independently addressable member entities.
    pat('coordinated-agent',[THE,NOUN_SING,s(text='and'),THE,NOUN_SING,VB('citation'),THE,NOUN,PERIOD],
        {'root':'event','objects':[
           obj('event','Event',5,roles={'agent':['group'],'theme':['theme']},features={'tense':'present','syntax':'coordinated'}),
           obj('group','Group',concept='sem:group.coordination',roles={'members':['first','second']},features={'number':'plural'}),
           obj('first','Entity',1),obj('second','Entity',4),obj('theme','Entity',7)]})
    g('coordinated-agent',{'tense':'present','syntax':'coordinated'},
      [L('the'),RP([('agent',0),('members',0)]),L('and'),L('the'),RP([('agent',0),('members',1)]),R('citation')]+theme()+end)

    # Pronoun surface is lexicon data and semantic identity is preserved.
    pat('pronoun-agent',[s('Pronoun',text='she'),VB('past'),THE,NOUN,PERIOD],
        event(1,0,3,{'tense':'past'}))
    g('pronoun-agent',{'tense':'past'},[P('agent'),R('past')]+theme()+end,
      roleConcepts={'agent':'sem:entity.she'},priority=40)

    pat('modal-ability',[THE,NOUN,s('Modal',text='can'),VB('citation'),THE,NOUN,PERIOD],
        event(3,1,5,{'tense':'present','modality':'ability'}))
    g('modal-ability',{'tense':'present','modality':'ability'},agent()+[L('can'),R('citation')]+theme()+end)

    # A requested object is an Unknown, not secretly the noun 'food'.
    pat('wh-object',[s(text='what'),s('Verb','present3',text='does'),THE,NOUN_SING,VB('citation'),Q],
        {'root':'event','objects':[
           obj('event','Event',4,roles={'agent':['agent'],'theme':['theme']},features={'tense':'present','question':'wh'}),
           obj('agent','Entity',3),obj('theme','Unknown',concept='sem:entity.unknown')]})
    g('wh-object',{'tense':'present','question':'wh'},[L('what'),L('does')]+agent()+[R('citation'),L('?')])


def acceptance_cases(lexemes):
    """Independent surface fixtures spanning grammatical families, not token permutations."""
    def noun(word, number='singular'):
        return lexemes[(word,'Noun')]['forms']['plural' if number=='plural' else 'citation']
    def verb(word, form):
        return lexemes[(word,'Verb')]['forms'][form]
    cases=[]
    def case(family,sentence,concept,features=None,roles=None,role_types=None,root_type='Event'):
        cases.append({'family':family,'sentence':sentence,'rootConcept':concept,
                      'rootType':root_type,'rootFeatures':features or {},
                      'roleConcepts':roles or {},'roleTypes':role_types or {}})
    pairs=[
        ('cook','girl','food'),('cook','boy','food'),('read','girl','book'),
        ('read','boy','book'),('buy','girl','book'),('buy','woman','house'),
        ('see','girl','boy'),('find','girl','cat'),('build','boy','house'),
        ('write','woman','book'),('see','woman','dog'),('find','boy','book')
    ]
    # These categories select independently meaningful propositions. Root features
    # and role concepts are asserted by the persisted test runner, not merely text.
    for word,who,thing in pairs[:8]:
        who_form=noun(who); thing_form=noun(thing)
        core=f'sem:event.{word}'; roles={'agent':f'sem:entity.{who}','theme':f'sem:entity.{thing}'}
        stem=verb(word,'citation');part=verb(word,'participle');prog=verb(word,'progressive')
        case('future',f'The {who_form} will {stem} the {thing_form}.',core,{'tense':'future'},roles)
        case('progressive',f'The {who_form} is {prog} the {thing_form}.',core,{'tense':'present','aspect':'progressive'},roles)
        case('perfect',f'The {who_form} has {part} the {thing_form}.',core,{'tense':'present','aspect':'perfect'},roles)
        case('negation',f'The {who_form} does not {stem} the {thing_form}.',core,{'tense':'present','polarity':'negative'},roles)
        case('past-negation',f'The {who_form} did not {stem} the {thing_form}.',core,{'tense':'past','polarity':'negative'},roles)
        case('question',f'Does the {who_form} {stem} the {thing_form}?',core,{'tense':'present','question':'yesno'},roles)
        case('past-question',f'Did the {who_form} {stem} the {thing_form}?',core,{'tense':'past','question':'yesno'},roles)
        case('passive',f'The {thing_form} was {part} by the {who_form}.',core,{'tense':'past','voice':'passive'},roles)
        case('locative',f'The {who_form} {verb(word,"past")} the {thing_form} in the house.',core,
             {'tense':'past'},{**roles,'location':'sem:entity.house'})
        case('modal',f'The {who_form} can {stem} the {thing_form}.',core,{'tense':'present','modality':'ability'},roles)
        case('wh-question',f'What does the {who_form} {stem}?',core,{'tense':'present','question':'wh'},
             {'agent':f'sem:entity.{who}'},{'theme':'Unknown'})
    for who in ('girl','boy','woman','person','child','dog'):
        for word in ('cook','read'):
            core=f'sem:event.{word}'
            case('plural-progressive',f'The {noun(who,"plural")} are {verb(word,"progressive")} the food.',core,
                 {'tense':'present','aspect':'progressive'},
                 {'agent':f'sem:entity.{who}','theme':'sem:entity.food'})
    for adj,who in [('happy','girl'),('tall','boy'),('good','person'),('ready','woman'),('busy','girl'),('small','dog'),
                    ('happy','woman'),('tall','girl')]:
        case('copula',f'The {noun(who)} is {adj}.','sem:state.copula',
             {'tense':'present'},{'subject':f'sem:entity.{who}','quality':f'sem:property.{adj}'},root_type='State')
    for adj,who,word,thing in [
        ('happy','girl','cook','food'),('tall','boy','read','book'),('good','person','buy','book'),
        ('busy','woman','write','book'),('happy','boy','see','dog'),('small','dog','find','cat'),
        ('tall','girl','build','house'),('good','woman','find','cat')]:
        case('attributive-modifier',f'The {adj} {noun(who)} {verb(word,"past")} the {noun(thing)}.',
             f'sem:event.{word}',{'tense':'past','syntax':'modified-subject'},
             {'agent':f'sem:entity.{who}','theme':f'sem:entity.{thing}'})
    for first,second,word,thing in [
        ('girl','boy','cook','food'),('woman','girl','read','book'),
        ('boy','girl','buy','book'),('girl','woman','see','dog'),
        ('boy','person','find','book'),('woman','boy','build','house'),
        ('girl','person','see','cat'),('boy','woman','cook','food')]:
        case('coordination',f'The {noun(first)} and the {noun(second)} {verb(word,"citation")} the {noun(thing)}.',
             f'sem:event.{word}',{'tense':'present','syntax':'coordinated'},
             {'agent':'sem:group.coordination','theme':f'sem:entity.{thing}'},{'agent':'Group'})
    for word,thing in [('cook','food'),('buy','book'),('see','boy'),('find','cat'),('write','book'),('read','book'),
                       ('build','house'),('see','dog')]:
        case('pronoun',f'She {verb(word,"past")} the {noun(thing)}.',f'sem:event.{word}',{'tense':'past'},
             {'agent':'sem:entity.she','theme':f'sem:entity.{thing}'})
    for word,who,recipient,thing in [
        ('give','girl','boy','book'),('bring','girl','boy','book'),('send','woman','girl','book'),
        ('show','boy','girl','book'),('offer','woman','boy','food'),('give','boy','girl','food'),
        ('bring','girl','person','food'),('send','boy','woman','book')]:
        case('ditransitive',f'The {noun(who)} {verb(word,"past")} the {noun(recipient)} the {noun(thing)}.',
             f'sem:event.{word}',{'tense':'past'},
             {'agent':f'sem:entity.{who}','recipient':f'sem:entity.{recipient}','theme':f'sem:entity.{thing}'})
    assert len(set(c['sentence'] for c in cases))==len(cases)
    return cases
