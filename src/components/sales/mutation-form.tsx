"use client";
import { useState, useTransition, type ReactNode } from 'react';
import type { AppLocale } from '@/lib/i18n/config';
import { tApp } from '@/lib/i18n/app-ui';
import type { MutationResult } from '@/lib/sales/validation';

export function SalesMutationForm({action,onSuccess,children,className,locale='en'}:{
 action:(data:FormData)=>Promise<MutationResult>;onSuccess?:(result:Extract<MutationResult,{ok:true}>)=>void;children:ReactNode;className?:string;locale?:AppLocale;
}) {
 const [pending,startTransition]=useTransition();
 const [result,setResult]=useState<MutationResult|null>(null);
 return <form className={className} onSubmit={event=>{
  event.preventDefault();if(pending)return;
  const data=new FormData(event.currentTarget);
  startTransition(async()=>{
   try {const response=await action(data);setResult(response);if(response.ok)onSuccess?.(response);}
   catch {setResult({ok:false,code:'DATABASE_ERROR',message:tApp(locale,'mutation.failed')});}
  });
 }}>
  <fieldset disabled={pending} aria-busy={pending} className={className}>{children}</fieldset>
  {pending ? <p role="status" className="text-body-small text-text-secondary">{tApp(locale,'mutation.saving')}</p> : null}
  {result && !result.ok ? <p role="alert">{result.message}</p> : null}
 </form>;
}
