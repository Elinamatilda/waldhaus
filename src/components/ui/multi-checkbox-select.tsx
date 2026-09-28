'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button, Card, Checkbox } from './core';
import { Icon } from './icon';

export function MultiCheckboxSelect({id, name, label, placeholder, emptyLabel, options, value, onChange, disabled = false}: {
  id?: string; name: string; label: string; placeholder: string; emptyLabel: string;
  options: {id: string; name: string; disabled?: boolean}[];
  value: string[]; onChange: (value: string[]) => void; disabled?: boolean;
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const panelId = `${controlId}-options`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const selected = options.filter(option => value.includes(option.id)).map(option => option.name);
  return <div ref={root} className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
      root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }}>
    <Button id={controlId} type="button" variant="secondary" className="w-full justify-between" disabled={disabled} aria-label={`${label}: ${selected.join(', ') || placeholder}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(current => !current)}>
      <span className="truncate">{selected.join(', ') || placeholder}</span><Icon name="chevronDown" className="h-4 w-4" />
    </Button>
    {/* Form values stay present while the dropdown is closed. */}
    {value.map(selectedId => <input key={selectedId} type="hidden" name={name} value={selectedId} disabled={disabled} />)}
    {open ? <Card id={panelId} role="group" aria-label={label} className="absolute inset-x-0 z-30 mt-2 max-h-60 overflow-y-auto p-2">
      {!options.length ? <p className="p-2 text-body-small text-text-secondary">{emptyLabel}</p> : options.map(option => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-body hover:bg-surface-hover">
        <Checkbox checked={value.includes(option.id)} disabled={disabled || option.disabled} onChange={event => onChange(event.target.checked ? [...value, option.id] : value.filter(item => item !== option.id))} />
        <span>{option.name}</span>
      </label>)}
    </Card> : null}
  </div>;
}
