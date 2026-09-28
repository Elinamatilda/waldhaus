import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// These validate supplied catalog evidence, NOT live RLS execution or role inheritance.
const report = JSON.parse(readFileSync(new URL('../../docs/database/deployed-schema-observation-2026-09-25.json', import.meta.url), 'utf8'));

test('observed authorization foundation has RLS enabled and forced', () => {
  for (const name of ['profiles','organizations','organization_members','roles']) {
    const table = report.tables_columns_rls_grants.find(t => t.table === name);
    assert.ok(table?.rls_enabled && table.rls_forced, name);
  }
});
test('observed legacy authorization objects are already absent', () => {
  assert.deepEqual(report.legacy_objects, []);
  assert.deepEqual(report.legacy_dependencies, []);
  assert.ok(!report.tables_columns_rls_grants.find(t => t.table === 'profiles').columns.some(c => c.name === 'role'));
  assert.ok(!report.functions.some(f => f.signature === 'is_admin()'));
  assert.ok(!report.policies.some(p => ['profiles_select_admin','profiles_update_admin'].includes(p.name)));
});
test('observed direct profile grants cannot self-grant system admin', () => {
  const profile = report.tables_columns_rls_grants.find(t => t.table === 'profiles');
  assert.deepEqual(profile.explicit_table_acl.filter(acl => acl.startsWith('authenticated=')), ['authenticated=r/postgres']);
  assert.deepEqual(profile.columns.filter(c => c.explicit_column_acl?.includes('authenticated=w/postgres')).map(c => c.name).sort(), ['avatar_url','full_name']);
  assert.equal(profile.columns.find(c => c.name === 'is_system_admin').default, 'false');
});
test('missing migration ledger is explicit; observation is not fabricated history', () => {
  assert.equal(report.migration_history.table_exists, false);
  assert.deepEqual(report.migration_history.rows, []);
});
