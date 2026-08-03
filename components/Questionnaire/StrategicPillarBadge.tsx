'use client';

import { Badge } from 'react-bootstrap';
import { strategicPillarShortLabel } from '@/lib/strategic-plan';

/** Compact yellow chip for strategic pillar (same axis as SDS P1…P6). */
export default function StrategicPillarBadge({
  pillar,
  code,
  showUnassigned = false,
}: {
  pillar?: string | null;
  code?: string | null;
  showUnassigned?: boolean;
}) {
  if (!pillar) {
    if (!showUnassigned) return null;
    return (
      <Badge bg="light" text="dark" className="border" style={{ fontSize: '0.65rem', fontWeight: 600 }}>
        Unassigned pillar
      </Badge>
    );
  }
  const short = strategicPillarShortLabel(pillar);
  return (
    <Badge
      bg="warning"
      text="dark"
      title={pillar}
      style={{ fontSize: '0.65rem', fontWeight: 600 }}
    >
      {code ? `${code} · ${short}` : short}
    </Badge>
  );
}
