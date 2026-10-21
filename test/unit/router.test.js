import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../../app/ui/router.js';

const routes = [
  { name: 'list', path: '/' },
  { name: 'new', path: '/new' },
  { name: 'recipe', path: '/recipes/:id' },
  { name: 'edit', path: '/recipes/:id/edit' },
];

test('an empty or bare hash is the home route', () => {
  for (const hash of ['', '#', '#/']) {
    assert.deepEqual(matchRoute(routes, hash), { name: 'list', params: {}, query: {} }, hash);
  }
});

test('fixed paths match exactly, ignoring a trailing slash', () => {
  assert.deepEqual(matchRoute(routes, '#/new'), { name: 'new', params: {}, query: {} });
  assert.deepEqual(matchRoute(routes, '#/new/'), { name: 'new', params: {}, query: {} });
});

test('parameters are captured and decoded', () => {
  assert.deepEqual(matchRoute(routes, '#/recipes/abc-123'), { name: 'recipe', params: { id: 'abc-123' }, query: {} });
  assert.deepEqual(matchRoute(routes, '#/recipes/p%C3%A3o/edit'), { name: 'edit', params: { id: 'pão' }, query: {} });
});

test('a query after "?" comes along, decoded', () => {
  assert.deepEqual(matchRoute(routes, '#/?q=p%C3%A3o%20de%20queijo'), { name: 'list', params: {}, query: { q: 'pão de queijo' } });
  assert.deepEqual(matchRoute(routes, '#?q=pao'), { name: 'list', params: {}, query: { q: 'pao' } });
});

test('anything else matches nothing', () => {
  for (const hash of ['#/nope', '#/recipes', '#/recipes/a/b', '#/recipes/%E0%A4%A']) {
    assert.equal(matchRoute(routes, hash), null, hash);
  }
});
