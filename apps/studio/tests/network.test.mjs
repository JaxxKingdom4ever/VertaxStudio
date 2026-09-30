import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveListenHost} from '../network.mjs';
test('Studio dev server binds to loopback by default because it has a writable project endpoint',()=>{
 assert.equal(resolveListenHost({}),'127.0.0.1');
 assert.equal(resolveListenHost({VERTAX_BIND_HOST:'localhost'}),'localhost');
});
test('external binding requires an explicitly supplied environment setting',()=>{
 assert.equal(resolveListenHost({VERTAX_BIND_HOST:'0.0.0.0'}),'0.0.0.0');
});
