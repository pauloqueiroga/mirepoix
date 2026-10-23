import { test } from 'node:test';
import { fingerprint } from '../../app/domain/fingerprint.js';
import { newRecipe } from '../../app/domain/recipe.js';
import { scenarios, tools } from '../contract/recipe-store.js';
import { createMemoryStore } from '../support/memory-store.js';

for (const [name, scenario] of Object.entries(scenarios)) {
  test(`memory store: ${name}`, () => scenario(createMemoryStore(), tools(newRecipe, fingerprint)));
}
