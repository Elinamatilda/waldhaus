import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';
import { loadModule } from './load-module.mjs';

const user = { id: 'user-1', email: 'user@example.invalid' };
const organization = { id: 'org-1', name: 'Test organization' };
const profile = { id: user.id, is_active: true, is_system_admin: false };
const membership = {
  id: 'membership-1', user_id: user.id, organization_id: organization.id,
  is_active: true, organizations: organization,
  roles: { code: 'ADMIN', scope: 'ORGANIZATION', is_active: true },
};

function fixture(options = {}) {
  const calls = [];
  const auth = {
    async getUser() {
      calls.push(['getUser']);
      if (options.thrown) throw options.thrown;
      return options.authResult ?? { data: { user }, error: null };
    },
    async getSession() { assert.fail('Unverified session must never be used'); },
  };
  const client = {
    auth,
    from(table) {
      calls.push(['from', table]);
      const result = table === 'profiles'
        ? options.profileResult ?? { data: options.profile ?? profile, error: null }
        : options.membershipResult ?? { data: [options.membership ?? membership], error: null };
      const query = {
        select(columns) { calls.push(['select', table, columns]); return query; },
        eq(...args) { calls.push(['eq', table, ...args]); return query; },
        order() { return query; }, limit() { return query; },
        maybeSingle() { return Promise.resolve(result); },
        then(resolve) { return Promise.resolve(result).then(resolve); },
      };
      return query;
    },
  };
  const session = loadModule('src/lib/auth/session.ts', {
    '@/lib/supabase/server': { createClient: async () => client },
    'next/navigation': {
      unauthorized() { throw new Error('HTTP 401'); },
      forbidden() { throw new Error('HTTP 403'); },
    },
  });
  return { session, calls, auth };
}

for (const error of [
  new AuthSessionMissingError(),
  ...['bad_jwt', 'no_authorization', 'session_not_found', 'session_expired',
    'refresh_token_not_found', 'refresh_token_already_used', 'user_not_found',
    'user_banned', 'unexpected_audience'].map(code => new AuthApiError(code, 401, code)),
  new AuthApiError('Unauthorized', 401),
]) {
  test(`invalid session: ${error.code ?? error.name}`, async () => {
    const {session, calls} = fixture({authResult: {data: {user: null}, error}});
    assert.equal(await session.getCurrentAuthContext(), null);
    assert.deepEqual(calls, [['getUser']]);
    await assert.rejects(session.requireUser(), /HTTP 401/);
  });
}

test('no verified user is unauthenticated', async () => {
  const {session} = fixture({authResult: {data: {user: null}, error: null}});
  assert.equal(await session.getCurrentAuthContext(), null);
});

test('a thrown missing-session error is also unauthenticated', async () => {
  const {session} = fixture({thrown: new AuthSessionMissingError()});
  assert.equal(await session.getCurrentAuthContext(), null);
});

for (const error of [
  new AuthRetryableFetchError('fetch failed', 0),
  new AuthApiError('Service failure', 503, 'unexpected_failure'),
  new AuthApiError('Rate limited', 429, 'over_request_rate_limit'),
  new AuthApiError('Service failure mentioning token', 500, 'bad_jwt'),
  new AuthApiError('Request timeout', 408, 'request_timeout'),
  new AuthApiError('Unknown forbidden response', 403),
]) {
  test(`returned service failure propagates: ${error.status} ${error.code ?? error.name}`, async () => {
    const {session, calls} = fixture({authResult: {data: {user}, error}});
    await assert.rejects(session.getCurrentAuthContext(), err => err.cause === error);
    assert.deepEqual(calls, [['getUser']]);
  });
}

test('thrown network/socket failure remains explicit', async () => {
  const error = new TypeError('fetch failed: socket exhaustion');
  const {session} = fixture({thrown: error});
  await assert.rejects(session.requireUser(), err => err === error);
});

for (const [error, detail] of [
  [new AuthRetryableFetchError('private upstream detail', 0), 'no HTTP response'],
  [new AuthApiError('private upstream detail', 503, 'unexpected_failure'), 'HTTP 503'],
  [new AuthApiError('private upstream detail', 429, 'over_request_rate_limit'), 'HTTP 429'],
]) {
  test(`verification failure gives safe diagnostics: ${detail}`, async () => {
    const {session, calls} = fixture({authResult: {data: {user}, error}});
    await assert.rejects(session.requireUser(), err => {
      assert.equal(err.cause, error);
      assert.ok(err.message.includes(detail));
      assert.ok(!err.message.includes('private upstream detail'));
      return true;
    });
    assert.deepEqual(calls, [['getUser']]);
  });
}

test('verified organization admin uses active own membership and role catalog', async () => {
  const {session, calls} = fixture();
  const context = await session.requireRole('admin');
  assert.equal(context.membership.role, 'admin');
  assert.equal(context.organization.id, 'org-1');
  assert.ok(calls.some(c => c.join('|') === 'eq|organization_members|user_id|user-1'));
  assert.ok(calls.some(c => c.join('|') === 'eq|organization_members|is_active|true'));
});

test('system admin works without a membership query', async () => {
  const {session, calls} = fixture({profile: {...profile, is_system_admin: true}});
  const context = await session.requireRole('admin');
  assert.equal(context.membership, null);
  assert.equal(context.profile.is_system_admin, true);
  assert.ok(!calls.some(c => c[0] === 'from' && c[1] === 'organization_members'));
});

test('employee cannot obtain admin authorization from legacy or user metadata roles', async () => {
  const {session} = fixture({
    profile: {...profile, role: 'admin'},
    authResult: {data: {user: {...user, user_metadata: {is_system_admin: true, role: 'ADMIN'}}}, error: null},
    membership: {...membership, roles: {...membership.roles, code: 'EMPLOYEE'}},
  });
  assert.equal((await session.requireRole('employee')).membership.role, 'employee');
  await assert.rejects(session.requireRole('admin'), /HTTP 403/);
});

for (const altered of [
  {...membership, roles: null},
  {...membership, roles: {...membership.roles, is_active: false}},
  {...membership, roles: {...membership.roles, scope: 'PLATFORM'}},
  {...membership, roles: {...membership.roles, code: 'UNKNOWN'}},
  {...membership, roles: {...membership.roles, code: 'admin'}},
  {...membership, is_active: false},
  {...membership, organization_id: 'other-org'},
  {...membership, user_id: 'other-user'},
]) {
  test(`invalid membership fails closed: ${JSON.stringify(altered)}`, async () => {
    await assert.rejects(fixture({membership: altered}).session.requireRole('admin'), /HTTP 403/);
  });
}

test('inactive system admin is forbidden', async () => {
  const {session} = fixture({profile: {...profile, is_active: false, is_system_admin: true}});
  await assert.rejects(session.requireRole('admin'), /HTTP 403/);
  assert.equal(await session.isCurrentUserSystemAdmin(), false);
});

test('missing membership does not become an admin', async () => {
  const {session} = fixture({membershipResult: {data: [], error: null}});
  await assert.rejects(session.requireRole('admin'), /HTTP 403/);
});

for (const stage of ['profileResult', 'membershipResult']) {
  for (const error of [{message:'fetch failed'}, {code:'42703', message:'missing schema column'}]) {
    test(`${stage} failure is explicit without legacy-schema fallback`, async () => {
      const {session} = fixture({[stage]: {data: null, error}});
      await assert.rejects(session.getCurrentAuthContext(), err => err.cause === error);
    });
  }
}

test('verified user without profile is a provisioning error, not signed out', async () => {
  const {session} = fixture({profileResult: {data: null, error: null}});
  await assert.rejects(session.getCurrentAuthContext(), /no application profile/);
});
