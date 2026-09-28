import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { loadModule } from './load-module.mjs';

function actions(error = null) {
  return loadModule('src/app/actions/auth.ts', {
    '@/lib/supabase/server': {createClient: async () => ({auth: {
      signInWithPassword: async () => ({data: {user: null, session: null}, error}),
      signOut: async () => ({error}),
    }})},
    'next/navigation': {redirect: path => {throw new Error(`redirect:${path}`);}},
  });
}
function form() {
  const data = new FormData();
  data.set('email', 'test@example.invalid'); data.set('password', 'test-password');
  return data;
}

test('invalid credentials are a form error', async () => {
  const api = actions(new AuthApiError('Invalid credentials', 400, 'invalid_credentials'));
  assert.deepEqual(await api.loginAction({error:null}, form()), {error:'Invalid email or password.'});
});
for (const error of [
  new AuthRetryableFetchError('fetch failed', 0),
  new AuthApiError('Unavailable', 503, 'unexpected_failure'),
  new AuthApiError('Rate limit', 429, 'over_request_rate_limit'),
]) {
  test(`login and logout preserve service failure: ${error.status}`, async () => {
    const api = actions(error);
    await assert.rejects(api.loginAction({error:null}, form()), e => e.cause === error);
    await assert.rejects(api.logoutAction(), e => e.cause === error);
  });
}
test('successful login and logout keep existing destinations', async () => {
  const api = actions();
  await assert.rejects(api.loginAction({error:null}, form()), /redirect:\/dashboard/);
  await assert.rejects(api.logoutAction(), /redirect:\/login/);
});
