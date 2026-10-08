import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, importance, label } from './qfd.js';

test('buildTree merges names case-insensitively and importance sums |score|', () => {
  const statements = [
    { id: 0, text: 'Booking online is great', score: 0.9 },
    { id: 1, text: 'Long time on hold', score: -0.6 },
    { id: 2, text: 'Website easy', score: 0.5 },
    { id: 3, text: 'Unassigned', score: 1 },
  ];
  const assignments = new Map([
    [0, { primary: 'Scheduling', secondary: 'Ease', tertiary: 'Online Booking' }],
    [1, { primary: 'Phone Access', secondary: 'Wait', tertiary: 'Hold Time' }],
    [2, { primary: ' scheduling ', secondary: 'ease', tertiary: 'online  booking' }],
  ]);
  const tree = buildTree(statements, assignments);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].children[0].children[0].statements.length, 2);
  assert.deepEqual(importance(tree), { Scheduling: 70, 'Phone Access': 30 });
  assert.deepEqual([label(-0.3), label(0.29), label(0.3)], ['Negative', 'Neutral', 'Positive']);
});
