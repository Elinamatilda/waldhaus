import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModule } from './load-module.mjs';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(selectedOrganizationId, pending = false, path = '/sales/planning', query = '') {
  const {OrganizationSwitcher} = loadModule('src/components/layout/organization-switcher.tsx', {
    'next/navigation': {usePathname:() => path, useSearchParams:() => new URLSearchParams(query)},
    'react-dom': {useFormStatus:() => ({pending})},
    '@/app/actions/organization-context': {selectOrganizationAction:async () => {}},
    '@/components/ui': {Select:props => createElement('select',props)},
  });
  return OrganizationSwitcher({locale:'fi', organizations:[{id,name:'Waldhaus',slug:'waldhaus'}], selectedOrganizationId});
}
test('SSR explicitly selects placeholder without a persisted organization', () => {
  const html = renderToStaticMarkup(fixture(null));
  assert.match(html, /<option value="" selected="">Valitse organisaatio<\/option>/);
  assert.doesNotMatch(html, /selected="">Waldhaus/);
});
test('SSR explicitly selects the organization resolved by the server', () => {
  assert.match(renderToStaticMarkup(fixture(id)), /selected="">Waldhaus<\/option>/);
});
test('change submits the form immediately and pending state prevents repeated selection', () => {
  const selectComponent = fixture(null).props.children[2];
  const select = selectComponent.type(selectComponent.props);
  assert.equal(select.props.value,'');
  let submitted = false;
  select.props.onChange({currentTarget:{form:{requestSubmit:() => {submitted = true;}}}});
  assert.equal(submitted,true);
  const pendingComponent = fixture(id,true).props.children[2];
  assert.equal(pendingComponent.type(pendingComponent.props).props.disabled,true);
});

test('customer analysis switcher submits year/scenario without entity filters', () => {
  const tree = fixture(id, false, '/sales/customers', 'year=2028&scenario=ACTUAL&customer=old&org=old');
  assert.equal(tree.props.children[0].props.value, '/sales/customers?year=2028&scenario=ACTUAL');
});
