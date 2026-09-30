import test from 'node:test';import assert from 'node:assert/strict';
import {parseTypedParameter} from '../../../dist/apps/studio/src/typed-parameter.js';
const param=(kind,options)=>({id:'p',label:'Value',kind,options});
test('Inspector typed parameters validate numbers, JSON, booleans and project table references',()=>{
 assert.equal(parseTypedParameter(param('number'),'2.5'),2.5);
 assert.throws(()=>parseTypedParameter(param('number'),'abc'),/finite number/);
 assert.deepEqual(parseTypedParameter(param('json'),'["a","b"]'),['a','b']);
 assert.throws(()=>parseTypedParameter(param('json'),'oops'),/valid JSON/);
 assert.equal(parseTypedParameter(param('boolean'),true),true);
 assert.equal(parseTypedParameter(param('table'),'phonetic-spell',['phonetic-spell']), 'phonetic-spell');
 assert.throws(()=>parseTypedParameter(param('table'),'not-installed',['phonetic-spell']),/Unknown table/);
 assert.throws(()=>parseTypedParameter(param('select',['yes','no']),'maybe'),/one of/);
});
