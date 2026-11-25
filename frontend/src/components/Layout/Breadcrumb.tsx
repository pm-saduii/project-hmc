import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { C } from '../Common';

export interface Crumb {
  label: string;
  to?: string;
}

/** "Projects › ABC-01 › Plan › Tasks" — every crumb except the last is a link. */
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, minWidth: 0 }}>
      <ol style={{ display: 'flex', alignItems: 'center', gap: 4, listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              {item.to && !last ? (
                <Link to={item.to} style={{ color: C.text2, textDecoration: 'none', whiteSpace: 'nowrap' }}>{item.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} style={{ color: last ? C.text : C.text2, fontWeight: last ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight size={12} color={C.text3} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
