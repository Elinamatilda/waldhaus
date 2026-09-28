import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './load-module.mjs';

const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const idB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const organizations = [{id:idA, name:'Waldhaus', slug:'waldhaus'}, {id:idB, name:'Second', slug:'second'}];

function fixture({ selected, admin = true, found = true } = {}) {
  const jar = new Map(selected ? [['waldhaus-selected-organization', selected]] : []);
  const writes = []; const invalidations = [];
  const profile = {profile:{is_system_admin:admin}, membership:{role:'employee', organization:organizations[1]}};
  const mocks = {
    '@/lib/auth/session': {requireProfile:async () => profile},
    'next/headers': {cookies:async () => ({
      get: key => jar.has(key) ? {value:jar.get(key)} : undefined,
      set: (key, value, options) => {jar.set(key,value);writes.push({key,value,options});},
      delete: key => jar.delete(key),
    })},
    'next/navigation': {forbidden:() => {throw Error('forbidden');}, RedirectType:{replace:'replace'},
      redirect:(path,type) => {throw Error(`redirect:${path}:${type}`);}},
    'next/cache': {revalidatePath:(...args) => invalidations.push(args)},
    '@/lib/supabase/server': {createClient:async () => ({from:() => ({select:() => ({
      order:async () => ({data:organizations,error:null}),
      eq:(_key,id) => ({maybeSingle:async () => ({data:found ? organizations.find(org => org.id === id) : null,error:null})}),
    })})})},
  };
  return {
    jar, writes, invalidations,
    context:loadModule('src/lib/organization-context.ts',mocks),
    scope:loadModule('src/lib/sales/scope.ts',mocks),
    action:loadModule('src/app/actions/organization-context.ts',mocks).selectOrganizationAction,
  };
}
function form(id, path='/sales/planning') {
  const data = new FormData(); data.set('organization_id',id); data.set('redirect_to',path); return data;
}

test('no cookie or stale cookie never silently selects first organization', async () => {
  for (const selected of [undefined,'invalid','cccccccc-cccc-4ccc-8ccc-cccccccccccc']) {
    const f = fixture({selected});
    const context = await f.context.getOrganizationContext();
    assert.equal(context.isSystemAdmin,true);
    assert.equal(context.selectedOrganizationId,null);
    assert.equal(context.selectedOrganization,null);
    assert.equal((await f.scope.resolveSalesScope()).organizationId,null);
  }
});

test('selection persists validated UUID; fresh context and Sales scope agree after switch', async () => {
  const f = fixture();
  for (const org of organizations) {
    await assert.rejects(f.action(form(org.id)), /redirect:\/sales\/planning:replace/);
    const context = await f.context.getOrganizationContext();
    assert.equal(context.selectedOrganizationId,org.id);
    assert.equal(context.selectedOrganization.name,org.name);
    assert.equal((await f.scope.resolveSalesScope()).organizationId,org.id);
    // Simulate a subsequent request carrying the persisted cookie.
    assert.equal((await fixture({selected:f.jar.get('waldhaus-selected-organization')}).scope.resolveSalesScope()).organizationId,org.id);
  }
  assert.deepEqual(f.invalidations,[['/','layout'],['/','layout']]);
  assert.equal(f.writes[0].options.httpOnly,true);
  assert.equal(f.writes[0].options.path,'/');
  assert.equal(f.writes[0].options.sameSite,'lax');
  // Existing policy: browser-session preference, preserved across auth sign-out.
  assert.equal(f.writes[0].options.maxAge,undefined);
});

for (const [path, expected] of [
  ['/dashboard?year=2027&org=old&customer=old','/dashboard?year=2027'],
  ['/dashboard?year=wrong','/dashboard'], ['/dashboard?year=2026&year=2027','/dashboard'],
  ['/dashboard?year=2101','/dashboard'],
  ['/sales/customers?year=2028&scenario=FORECAST&org=old','/sales/customers?year=2028&scenario=FORECAST'],
  [`/sales/customers/${idA}?year=2028&scenario=ACTUAL&product=old`,'/sales/customers?year=2028&scenario=ACTUAL'],
  ['/sales/customers?year=bad&scenario=ALL','/sales/customers'],
  ['/sales/customers?scenario=BUDGET&scenario=ACTUAL','/sales/customers'],
  ['/sales','/sales'], ['/sales/customers','/sales/customers'], ['/sales/products','/sales/products'],
  ['/sales/planning?scenario=old&customer=old&product=old&variant=old','/sales/planning'],
  ['/sales/actuals?org=old','/sales/actuals'],
  [`/sales/customers/${idA}?product=old`,'/sales/customers'],
  [`/sales/products/${idA}`,'/sales/products'],
  ['https://evil.invalid','/dashboard'], ['//evil.invalid','/dashboard'],
  ['/\\evil.invalid','/dashboard'], ['/%2f%2fevil.invalid','/dashboard'],
]) {
  test(`tenant switch clears entity IDs and safely redirects: ${path}`, async () => {
    const f = fixture();
    await assert.rejects(f.action(form(idA,path)), error => error.message === `redirect:${expected}:replace`);
  });
}

test('clear selection removes cookie and invalidates server UI', async () => {
  const f = fixture({selected:idA});
  await assert.rejects(f.action(form('')), /redirect:/);
  assert.equal((await f.scope.resolveSalesScope()).organizationId,null);
  assert.deepEqual(f.invalidations,[['/','layout']]);
});

test('normal member cannot change organization and ignores admin cookie', async () => {
  const f = fixture({selected:idA,admin:false});
  await assert.rejects(f.action(form(idA)),/forbidden/);
  assert.equal(f.writes.length,0);
  assert.equal((await f.scope.resolveSalesScope()).organizationId,idB);
});

test('invalid or inaccessible organization never persists', async () => {
  for (const id of ['Waldhaus',idA]) {
    const f = fixture({found:false});
    await assert.rejects(f.action(form(id)), /Invalid organization ID|not accessible/);
    assert.equal(f.writes.length,0);
    assert.equal(f.invalidations.length,0);
  }
});
