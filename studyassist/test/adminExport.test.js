import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, usersCsv } from '../src/utils/adminExport.js';
test('CSV prevents spreadsheet formulas and preserves quotes',()=>{
 assert.equal(csvCell('=1+1'), '"\'=1+1"');
 assert.equal(csvCell('a"b'), '"a""b"');
 assert.ok(csvCell('  @SUM(A1)').startsWith('"\''));
 assert.ok(usersCsv([{email:'a@example.com'}]).includes('a@example.com'));
});
