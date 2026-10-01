"""Extended English rule data: genitives, degree, embedded clauses, and agreement.

This file is an authoring module, never imported by the TypeScript runtime.
Every pattern becomes standard JSON stored in the editable English pack.
"""
from copy import deepcopy

def extend(patterns,generations,lexemes,concepts,add):
    for word,category in [
        ('quickly','Adverb'),('slowly','Adverb'),('quietly','Adverb'),
        ('say','Verb'),('think','Verb'),('believe','Verb'),
        ('he','Pronoun'),('they','Pronoun'),('good','Adjective'),
        ('red','Adjective'),('tall','Adjective'),('girl','Noun'),
        ('book','Noun'),('boy','Noun')
    ]:
        add(word,category)
    def s(cls=None,form=None,text=None):
        result={}
        if cls:result['classes']=[cls]
        if form:result['formKeys']=[form] if isinstance(form,str) else form
        if text:result['text']=text
        return result
    THE=s(text='the');NOUN=s('Noun',['citation','plural']);SING=s('Noun','citation');PERIOD=s(text='.')
    VB=lambda form:s('Verb',form)
    def obj(id,kind,slot=None,concept=None,roles=None,features=None):
        result={'id':id,'type':kind}
        if slot is not None:result['slot']=slot
        if concept is not None:result['conceptId']=concept
        if roles is not None:result['roles']=roles
        if features is not None:result['features']=features
        return result
    def pat(name,slots,objects,root='event'):
        patterns.append({'id':name,'slots':deepcopy(slots),'meaning':{'root':root,'objects':objects}})
    L=lambda literal:{'literal':literal}
    P=lambda role,form='citation':{'role':role,'formKey':form}
    F=lambda role:{'role':role,'formKeyFrom':{'role':role,'featureId':'number','values':{'plural':'plural'},'default':'citation'}}
    R=lambda form:{'root':True,'formKey':form}
    S=lambda role,form='citation':{'path':[{'role':step} for step in role],'formKey':form}
    NP=lambda role:[L('the'),F(role)]
    END=[L('.')]
    def g(name,concept,features,required,parts,**extra):
        generations.append({'id':name,'conceptId':concept,'features':features,'requiredRoles':required,
                            'parts':parts,'capitalize':True,'priority':45,**extra})
    def transitive(root_slot,agent_slot,theme_slot,features,extra_roles=None,extra_objects=None):
        roles={'agent':['agent'],'theme':['theme'],**(extra_roles or {})}
        return [obj('event','Event',root_slot,roles=roles,features=features),
                obj('agent','Entity',agent_slot),obj('theme','Entity',theme_slot),*(extra_objects or [])]

    # Genitives are lexical forms and possession is a semantic relationship.
    for name,form in [('singular-possessor','possessive'),('plural-possessor','pluralPossessive')]:
        pat(name,[THE,s('Noun',form),SING,s('Verb','present3',text='is'),s('Adjective'),PERIOD],[
            obj('state','State',concept='sem:state.copula',roles={'subject':['subject'],'quality':['quality']},
                features={'tense':'present','syntax':'possessed-subject'}),
            obj('subject','Entity',2,roles={'possessor':['possessor']}),
            obj('possessor','Entity',1),obj('quality','Property',4)],root='state')
    possessive_path=[{'role':'subject'},{'role':'possessor'}]
    g('possessed-subject','sem:state.copula',{'tense':'present','syntax':'possessed-subject'},['subject','quality'],
      [L('the'),{'path':possessive_path,'formKeyFrom':{'path':possessive_path,'featureId':'number',
         'values':{'plural':'pluralPossessive'},'default':'possessive'}},P('subject'),L('is'),P('quality'),L('.')])

    pat('comparative',[THE,SING,s('Verb','present3',text='is'),s('Adjective','comparative'),s(text='than'),THE,SING,PERIOD],[
        obj('state','State',concept='sem:state.copula',roles={'subject':['subject'],'quality':['quality'],'comparison':['comparison']},
            features={'tense':'present','degree':'comparative'}),
        obj('subject','Entity',1),obj('quality','Property',3),obj('comparison','Entity',6)],root='state')
    g('comparative','sem:state.copula',{'tense':'present','degree':'comparative'},['subject','quality','comparison'],
      NP('subject')+[L('is'),P('quality','comparative'),L('than')]+NP('comparison')+END)
    pat('superlative',[THE,SING,s('Verb','present3',text='is'),THE,s('Adjective','superlative'),PERIOD],[
        obj('state','State',concept='sem:state.copula',roles={'subject':['subject'],'quality':['quality']},
            features={'tense':'present','degree':'superlative'}),
        obj('subject','Entity',1),obj('quality','Property',4)],root='state')
    g('superlative','sem:state.copula',{'tense':'present','degree':'superlative'},['subject','quality'],
      NP('subject')+[L('is'),L('the'),P('quality','superlative')]+END)

    pat('adverbial',[THE,SING,s('Adverb'),VB('past'),THE,NOUN,PERIOD],
        transitive(3,1,5,{'tense':'past','syntax':'adverbial'},{'manner':['manner']},
                   [obj('manner','Property',2)]))
    g('adverbial','*',{'tense':'past','syntax':'adverbial'},['agent','theme','manner'],
      NP('agent')+[P('manner'),R('past')]+NP('theme')+END)

    # Complement Event carries its own independent semantic arguments.
    pat('complement-clause',[THE,SING,dict(VB('past'),conceptIds=['sem:event.say','sem:event.think','sem:event.believe']),
        s(text='that'),THE,SING,VB('past'),THE,NOUN,PERIOD],[
        obj('event','Event',2,roles={'agent':['agent'],'complement':['embedded']},
            features={'tense':'past','syntax':'complement'}),
        obj('agent','Entity',1),
        obj('embedded','Event',6,roles={'agent':['embeddedAgent'],'theme':['embeddedTheme']},features={'tense':'past'}),
        obj('embeddedAgent','Entity',5),obj('embeddedTheme','Entity',8)])
    g('complement-clause','*',{'tense':'past','syntax':'complement'},['agent','complement'],
      NP('agent')+[R('past'),L('that'),
          {'embeddedRole':'complement','lowercaseInitial':True,'dropFinalPunctuation':True},L('.')])

    # Relative verb shares agent ID with matrix verb. This is actual coreference.
    pat('relative-subject',[THE,SING,s(text='who'),VB('past'),THE,NOUN,VB('past'),THE,NOUN,PERIOD],[
        obj('event','Event',6,roles={'agent':['agent'],'theme':['theme']},
            features={'tense':'past','syntax':'relative-subject'}),
        obj('agent','Entity',1,roles={'relative':['relative']}),
        obj('relative','Event',3,roles={'agent':['agent'],'theme':['relativeTheme']},
            features={'tense':'past','syntax':'relative-predicate'}),
        obj('relativeTheme','Entity',5),obj('theme','Entity',8)])
    g('relative-subject','*',{'tense':'past','syntax':'relative-subject'},['agent','theme'],
      NP('agent')+[L('who'),{'embeddedPath':[{'role':'agent'},{'role':'relative'}],
                           'dropFinalPunctuation':True},R('past')]+NP('theme')+END)
    g('relative-predicate','*',{'tense':'past','syntax':'relative-predicate'},['agent','theme'],
      [R('past')]+NP('theme')+END,capitalize=False)

    pat('past-perfect',[THE,SING,s('Verb','past',text='had'),VB('participle'),THE,NOUN,PERIOD],
        transitive(3,1,5,{'tense':'past','aspect':'perfect'}))
    g('past-perfect','*',{'tense':'past','aspect':'perfect'},['agent','theme'],
      NP('agent')+[L('had'),R('participle')]+NP('theme')+END)
    pat('future-perfect',[THE,SING,s(text='will'),s('Verb','citation',text='have'),VB('participle'),THE,NOUN,PERIOD],
        transitive(4,1,6,{'tense':'future','aspect':'perfect'}))
    g('future-perfect','*',{'tense':'future','aspect':'perfect'},['agent','theme'],
      NP('agent')+[L('will'),L('have'),R('participle')]+NP('theme')+END)
    pat('perfect-progressive',[THE,SING,s('Verb','present3',text='has'),s('Verb','participle',text='been'),VB('progressive'),THE,NOUN,PERIOD],
        transitive(4,1,6,{'tense':'present','aspect':'perfect-progressive'}))
    g('perfect-progressive','*',{'tense':'present','aspect':'perfect-progressive'},['agent','theme'],
      NP('agent')+[L('has'),L('been'),R('progressive')]+NP('theme')+END)

    pat('indefinite-agent',[s(text='a'),SING,VB('past'),THE,NOUN,PERIOD],[
        obj('event','Event',2,roles={'agent':['agent'],'theme':['theme']},features={'tense':'past'}),
        obj('agent','Entity',1,features={'definiteness':'indefinite'}),obj('theme','Entity',4)])
    g('indefinite-agent','*',{'tense':'past'},['agent','theme'],
      [L('a'),F('agent'),R('past')]+NP('theme')+END,
      roleFeatures={'agent':{'definiteness':'indefinite'}})

    for pronoun,form in [('he','past'),('they','citation')]:
        features={'tense':'past' if form=='past' else 'present'}
        pat('pronoun-'+pronoun,[s('Pronoun',text=pronoun),VB(form),THE,NOUN,PERIOD],[
            obj('event','Event',1,roles={'agent':['agent'],'theme':['theme']},features=features),
            obj('agent','Entity',0,features={'number':'plural'} if pronoun=='they' else None),
            obj('theme','Entity',3)])
        g('pronoun-'+pronoun,'*',features,['agent','theme'],
          [P('agent'),R(form)]+NP('theme')+END,roleConcepts={'agent':'sem:entity.'+pronoun})


def acceptance_cases(lexemes):
    """Reviewed surface examples that exercise *different* English structures."""
    def n(word,form='citation'):
        return lexemes[(word,'Noun')]['forms'][form]
    def v(word,form):
        return lexemes[(word,'Verb')]['forms'][form]
    def adjective(word,form):
        return lexemes[(word,'Adjective')]['forms'][form]
    examples=[]
    def add(family,text,concept,features=None,roles=None,root_type='Event'):
        examples.append({'family':family,'sentence':text,'rootConcept':concept,
                         'rootFeatures':features or {},'roleConcepts':roles or {},'rootType':root_type})
    for possessor,possessed,property in [
        ('girl','book','red'),('boy','book','red'),('woman','book','red'),('child','book','red'),
        ('girl','house','small'),('woman','house','small')]:
        roles={'subject':'sem:entity.'+possessed,'quality':'sem:property.'+property}
        add('possessive',f"The {n(possessor,'possessive')} {n(possessed)} is {property}.",
            'sem:state.copula',{'tense':'present','syntax':'possessed-subject'},roles,'State')
        add('plural-possessive',f"The {n(possessor,'pluralPossessive')} {n(possessed)} is {property}.",
            'sem:state.copula',{'tense':'present','syntax':'possessed-subject'},roles,'State')
    for subject,other,property in [
        ('girl','boy','tall'),('boy','girl','tall'),('woman','girl','good'),
        ('girl','woman','good'),('person','boy','small'),('child','girl','happy')]:
        base={'subject':'sem:entity.'+subject,'quality':'sem:property.'+property}
        add('comparative',f'The {n(subject)} is {adjective(property,"comparative")} than the {n(other)}.',
            'sem:state.copula',{'tense':'present','degree':'comparative'},
            {**base,'comparison':'sem:entity.'+other},'State')
        add('superlative',f'The {n(subject)} is the {adjective(property,"superlative")}.',
            'sem:state.copula',{'tense':'present','degree':'superlative'},base,'State')
    for who,how,word,thing in [
        ('girl','quickly','cook','food'),('woman','slowly','read','book'),
        ('boy','quietly','buy','book'),('girl','slowly','build','house'),
        ('woman','quickly','see','dog'),('boy','quietly','find','cat')]:
        add('adverbial',f'The {n(who)} {how} {v(word,"past")} the {n(thing)}.',
            'sem:event.'+word,{'tense':'past','syntax':'adverbial'},
            {'agent':'sem:entity.'+who,'theme':'sem:entity.'+thing,'manner':'sem:property.'+how})
    for say,who,subject,verb,thing in [
        ('say','girl','boy','cook','food'),('think','boy','girl','read','book'),
        ('believe','woman','boy','find','cat'),('say','girl','woman','buy','book'),
        ('think','woman','girl','see','dog'),('believe','boy','woman','build','house')]:
        add('complement',f'The {n(who)} {v(say,"past")} that the {n(subject)} {v(verb,"past")} the {n(thing)}.',
            'sem:event.'+say,{'tense':'past','syntax':'complement'},
            {'agent':'sem:entity.'+who,'complement':'sem:event.'+verb})
    for who,verb,thing,main,other in [
        ('girl','cook','food','see','boy'),('boy','read','book','see','girl'),
        ('woman','buy','house','see','dog'),('girl','find','cat','see','woman'),
        ('boy','write','book','see','girl'),('woman','build','house','see','boy')]:
        add('relative',f'The {n(who)} who {v(verb,"past")} the {n(thing)} {v(main,"past")} the {n(other)}.',
            'sem:event.'+main,{'tense':'past','syntax':'relative-subject'},
            {'agent':'sem:entity.'+who,'theme':'sem:entity.'+other})
    for word,who,thing in [('cook','girl','food'),('read','boy','book'),('buy','woman','book'),
                            ('see','girl','dog'),('build','boy','house'),('write','woman','book')]:
        roles={'agent':'sem:entity.'+who,'theme':'sem:entity.'+thing}
        add('past-perfect',f'The {n(who)} had {v(word,"participle")} the {n(thing)}.',
            'sem:event.'+word,{'tense':'past','aspect':'perfect'},roles)
        add('future-perfect',f'The {n(who)} will have {v(word,"participle")} the {n(thing)}.',
            'sem:event.'+word,{'tense':'future','aspect':'perfect'},roles)
        add('perfect-progressive',f'The {n(who)} has been {v(word,"progressive")} the {n(thing)}.',
            'sem:event.'+word,{'tense':'present','aspect':'perfect-progressive'},roles)
        add('indefinite-determiner',f'A {n(who)} {v(word,"past")} the {n(thing)}.',
            'sem:event.'+word,{'tense':'past'},roles)
        add('pronoun-he',f'He {v(word,"past")} the {n(thing)}.',
            'sem:event.'+word,{'tense':'past'},
            {'agent':'sem:entity.he','theme':'sem:entity.'+thing})
        add('pronoun-they',f'They {v(word,"citation")} the {n(thing)}.',
            'sem:event.'+word,{'tense':'present'},
            {'agent':'sem:entity.they','theme':'sem:entity.'+thing})
    assert len(set(e['sentence'] for e in examples))==len(examples)
    return examples
