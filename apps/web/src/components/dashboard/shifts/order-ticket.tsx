'use client';

import type { Order, OrderStatus } from '../../../types/order';

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OrderStatus, { label: string; color: string }> = {
  OPEN: { label: 'Ouvert', color: '#818CF8' },
  SENT: { label: 'Envoyé', color: '#D4A574' },
  PAID: { label: 'Encaissé', color: '#34D399' },
  VOIDED: { label: 'Annulé', color: '#5A6485' },
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface OrderTicketProps {
  order: Order;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function OrderTicket({ order }: OrderTicketProps) {
  const statusCfg = STATUS_CFG[order.status] ?? STATUS_CFG.OPEN;
  const total = Number(order.totalAmount);
  const items = order.items ?? [];
  const itemCount = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <div
      className="shifts-ticket shifts-fade-up"
      style={{ padding: 14, marginLeft: 8, marginRight: 8 }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          paddingBottom: 10,
          borderBottom: '1px dashed #1B2236',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: 'var(--st-font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 12.5,
              color: '#F4F6FB',
              fontWeight: 600,
            }}
          >
            {order.orderNumber}
          </span>
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: '#3A4366',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              color: '#8892B0',
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16M4 7v12M20 7v12M8 7v4M16 7v4M4 11h16" />
            </svg>
            {order.table?.tableNumber ? `Table ${order.table.tableNumber}` : '—'}
          </span>
        </div>
        <span
          style={{
            fontSize: 10.5,
            color: statusCfg.color,
            fontFamily: 'var(--st-font-mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          ● {statusCfg.label}
        </span>
      </div>

      {/* Server */}
      {order.server && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {(order.server.firstName?.[0] ?? '') + (order.server.lastName?.[0] ?? '')}
          </div>
          <span style={{ fontSize: 11.5, color: '#8892B0' }}>
            {order.server.firstName} {order.server.lastName}
          </span>
        </div>
      )}

      {/* Items */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}
            >
              <span
                style={{
                  fontFamily: 'var(--st-font-mono)',
                  color: '#5A6485',
                  minWidth: 22,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ×{item.quantity}
              </span>
              <span style={{ flex: 1, color: '#C5CCE0' }}>{item.menuItem?.name ?? '—'}</span>
              <span
                style={{
                  fontFamily: 'var(--st-font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  color: '#8892B0',
                  fontSize: 11.5,
                }}
              >
                ${Number(item.subtotal).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px dashed #1B2236',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--st-font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            fontSize: 9.5,
            fontWeight: 500,
            color: '#8892B0',
          }}
        >
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
        <span
          style={{
            fontFamily: 'var(--st-font-mono)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            fontSize: 16,
            color: '#F4F6FB',
            fontWeight: 500,
          }}
        >
          ${total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
