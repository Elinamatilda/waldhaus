import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';
import { loadModule } from './load-module.mjs';

function fixture(error) {
  const request = {cookies: {getAll: () => [], set: () => {}}};
  const response = {cookies: {set: () => {}}, headers: {set: () => {}}};
  const proxy = loadModule('src/lib/supabase/proxy.ts', {
    '@supabase/ssr': {createServerClient: () => ({auth: {
      getUser: async () => ({data: {user: null}, error}),
      getSession: () => assert.fail('Proxy must not trust storage identity'),
    }})},
    './env': {getSupabaseEnv: () => ({supabaseUrl:'https://example.invalid',supabasePublishableKey:'test'})},
    'next/server': {NextResponse: {next: () => response}},
  });
  return {proxy, request, response};
}
test('proxy allows a missing session to reach login/access handling', async () => {
  const {proxy, request, response} = fixture(new AuthSessionMissingError());
  assert.equal(await proxy.updateSession(request), response);
});
test('proxy does not swallow a transport failure before server authorization', async () => {
  const error = new AuthRetryableFetchError('socket failure', 0);
  const {proxy, request} = fixture(error);
  await assert.rejects(proxy.updateSession(request), e => e.cause === error);
});
