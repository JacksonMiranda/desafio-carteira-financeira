'use client';

import { useEffect, useState } from 'react';
import type { Contact } from '@/lib/types';

// Combobox de destinatário: o usuário busca por nome/e-mail e seleciona.
// O id (UUID) selecionado vai num input oculto `receiverId` — a UI nunca
// exige que o usuário conheça o UUID.
export function RecipientPicker() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) return;

    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    // Debounce + abort para não disparar uma busca por tecla digitada.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? (res.json() as Promise<Contact[]>) : []))
        .then((data) => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => {
          /* requisição abortada/substituída */
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">Destinatário</span>
      <input type="hidden" name="receiverId" value={selected?.id ?? ''} />

      {selected ? (
        <div className="flex items-center justify-between rounded-md border border-gray-300 px-3 py-2">
          <span>
            {selected.name}{' '}
            <span className="text-gray-500">({selected.email})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery('');
            }}
            className="text-xs text-gray-600 underline"
          >
            trocar
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busque por nome ou e-mail"
            autoComplete="off"
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />

          {open && results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow">
              {results.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(contact);
                      setOpen(false);
                      setResults([]);
                    }}
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-xs text-gray-500">{contact.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {open && query.trim().length >= 2 && results.length === 0 && (
            <p className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow">
              Nenhum usuário encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
