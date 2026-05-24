'use client';

// BIS-43: When restaurant-tables endpoint is available, replace the table number
// text input with a Select that fetches from GET /api/v1/restaurant-tables.
// For now, tableId is not used — the create order button is DISABLED
// with a tooltip "En attente de BIS-43 — tables non disponibles".

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { lockScroll, unlockScroll } from '../../../lib/scroll-lock';
import { useMenuItems } from '../../../hooks/use-menu-items';
import type { Shift } from '../../../types/shift';
import type { MenuItem } from '../../../types/menu-item';

// ── Label / input styles ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--st-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontSize: 10,
  color: '#5A6485',
  fontWeight: 500,
  marginBottom: 5,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  background: '#141A2B',
  border: '1px solid #252D45',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#5A6485',
  fontFamily: 'var(--st-font-ui)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'not-allowed',
  opacity: 0.6,
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface SelectedItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CreateOrderDialog({ open, onOpenChange, shift }: CreateOrderDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  const { data: menuItems = [] } = useMenuItems({ active: true });

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.category.name.toLowerCase().includes(q),
    );
  }, [menuItems, search]);

  const orderTotal = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedItems([]);
    }
  }, [open]);

  // Escape key + body scroll lock (reference-counted via scroll-lock.ts — ROB-H2)
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', h);
    lockScroll();
    return () => {
      window.removeEventListener('keydown', h);
      unlockScroll();
    };
  }, [open, onOpenChange]);

  // Item management (logic preserved even though currently disabled)
  const addItem = (item: MenuItem) => {
    setSelectedItems((prev) => {
      const ex = prev.find((i) => i.menuItemId === item.id);
      if (ex)
        return prev.map((i) => (i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1 },
      ];
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((i) => (i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (menuItemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  if (!open) return null;

  return (
    <div
      onClick={() => onOpenChange(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,7,15,.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="shifts-fade-up"
        style={{
          width: 640,
          maxWidth: '100%',
          maxHeight: '90vh',
          background: '#0F1422',
          border: '1px solid #252D45',
          borderRadius: 14,
          boxShadow: '0 24px 60px -20px rgba(0,0,0,.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 16px',
            borderBottom: '1px solid #1B2236',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Shift · Commande</div>
            <h2
              id="dialog-title"
              className="font-display"
              style={{ fontSize: 22, color: '#F4F6FB', margin: 0, lineHeight: 1.15 }}
            >
              Nouvelle commande
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              background: 'transparent',
              border: 0,
              color: '#8892B0',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#141A2B';
              (e.currentTarget as HTMLButtonElement).style.color = '#F4F6FB';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#8892B0';
            }}
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px' }}>
          {/* BIS-43 warning */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 14px',
              background: 'rgba(245,158,11,.06)',
              border: '1px solid rgba(245,158,11,.25)',
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p
              style={{
                fontSize: 12,
                color: '#C5CCE0',
                fontFamily: 'var(--st-font-ui)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              <span style={{ fontWeight: 600, color: '#F59E0B' }}>
                La gestion des tables n&apos;est pas encore disponible (BIS-43).
              </span>{' '}
              La création de commandes est temporairement désactivée.
            </p>
          </div>

          {/* Form fields — all disabled */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}
          >
            <div>
              <label style={labelStyle}>Serveur</label>
              <select disabled style={{ ...inputStyle }}>
                <option>Sélectionner un serveur…</option>
                {shift.assignments
                  .filter((a) => a.employee.active)
                  .map((a) => (
                    <option key={a.employeeId}>
                      {a.employee.firstName} {a.employee.lastName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Couverts</label>
              <input type="number" placeholder="1" disabled style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Numéro de table</label>
            <input type="text" placeholder="En attente de BIS-43…" disabled style={inputStyle} />
            <span
              style={{
                fontSize: 10.5,
                color: '#5A6485',
                fontFamily: 'var(--st-font-ui)',
                marginTop: 4,
                display: 'block',
              }}
            >
              La sélection de table sera disponible via BIS-43.
            </span>
          </div>

          {/* Menu items search */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Articles du menu</label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5A6485"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un article…"
                disabled
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
            <div
              style={{
                maxHeight: 176,
                overflow: 'auto',
                background: '#141A2B',
                border: '1px solid #252D45',
                borderRadius: 8,
              }}
            >
              {filteredItems.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: '#5A6485',
                    fontSize: 12,
                    fontFamily: 'var(--st-font-ui)',
                  }}
                >
                  Aucun article trouvé
                </div>
              ) : (
                filteredItems.slice(0, 40).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderBottom: '1px solid #1B2236',
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: '#F4F6FB',
                          fontFamily: 'var(--st-font-ui)',
                          marginBottom: 1,
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#5A6485' }}>{item.category.name}</div>
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--st-font-mono)',
                        fontSize: 11.5,
                        color: '#8892B0',
                        marginRight: 10,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Number(item.price).toFixed(2)} $
                    </span>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: '#252D45',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#5A6485"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected items (empty state placeholder) */}
          {selectedItems.length > 0 && (
            <div>
              <label style={labelStyle}>Articles sélectionnés ({selectedItems.length})</label>
              <div style={{ background: '#141A2B', border: '1px solid #252D45', borderRadius: 8 }}>
                {selectedItems.map((item) => (
                  <div
                    key={item.menuItemId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderBottom: '1px solid #1B2236',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12.5,
                        color: '#F4F6FB',
                        fontFamily: 'var(--st-font-ui)',
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--st-font-mono)',
                        fontSize: 11.5,
                        color: '#8892B0',
                      }}
                    >
                      {item.price.toFixed(2)} $
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                        disabled
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: '#252D45',
                          border: 0,
                          color: '#5A6485',
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        >
                          <path d="M5 12h14" />
                        </svg>
                      </button>
                      <span
                        style={{
                          fontFamily: 'var(--st-font-mono)',
                          fontSize: 11.5,
                          color: '#F4F6FB',
                          minWidth: 18,
                          textAlign: 'center',
                        }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                        disabled
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          background: '#252D45',
                          border: 0,
                          color: '#5A6485',
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--st-font-mono)',
                        fontSize: 12,
                        color: '#F4F6FB',
                        minWidth: 56,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {(item.price * item.quantity).toFixed(2)} $
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.menuItemId)}
                      disabled
                      style={{
                        color: '#5A6485',
                        background: 'none',
                        border: 0,
                        cursor: 'not-allowed',
                        padding: 4,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: '#8892B0',
                      fontFamily: 'var(--st-font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                    }}
                  >
                    Sous-total
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--st-font-mono)',
                      fontSize: 14,
                      color: '#F4F6FB',
                      fontWeight: 600,
                    }}
                  >
                    {orderTotal} $
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #1B2236',
            background: '#0A0E1A',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{ flex: 1, fontSize: 11.5, color: '#5A6485', fontFamily: 'var(--st-font-ui)' }}
          >
            Disponible après la livraison de BIS-43.
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{
              background: 'transparent',
              border: '1px solid #252D45',
              borderRadius: 10,
              padding: '7px 14px',
              color: '#F4F6FB',
              fontSize: 12,
              fontFamily: 'var(--st-font-ui)',
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
          <button
            type="button"
            disabled
            title="En attente de BIS-43 — tables non disponibles"
            style={{
              background: '#4F46E5',
              border: '1px solid transparent',
              borderRadius: 10,
              padding: '7px 14px',
              color: 'white',
              fontSize: 12,
              fontFamily: 'var(--st-font-ui)',
              cursor: 'not-allowed',
              opacity: 0.4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Créer la commande
          </button>
        </div>
      </div>
    </div>
  );
}
