import 'server-only';
import { requireRole } from '@/lib/auth/session';
import { getOrganizationContext } from '@/lib/organization-context';
import { identifier } from './model';

export async function requireProductOrganization(organizationId:string) {
  await requireRole('admin');
  const context=await getOrganizationContext();
  identifier(organizationId);
  if((!context.isSystemAdmin&&context.role!=='admin')||!context.selectedOrganizationId||context.selectedOrganizationId!==organizationId)throw Object.assign(new Error('Forbidden'),{databaseCode:'42501'});
  return context;
}
