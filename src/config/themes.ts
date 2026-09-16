export type PortalTheme = {
  id: 'dry-eye' | 'refraction' | 'vision-archive' | 'time-mirror';
  english: string;
  chinese: string;
  position: { x: number; y: number };
  className: string;
  delay: string;
};

export const portalThemes: PortalTheme[] = [
  { id: 'dry-eye', english: 'DRY EYE', chinese: '眼中的湖', position: { x: 20, y: 22 }, className: 'portal-node--dry-eye', delay: '.85s' },
  { id: 'refraction', english: 'REFRACTION', chinese: '失焦世界', position: { x: 80, y: 22 }, className: 'portal-node--refraction', delay: '1.05s' },
  { id: 'vision-archive', english: 'VISION ARCHIVE', chinese: '视觉档案', position: { x: 20, y: 59 }, className: 'portal-node--vision-archive', delay: '1.25s' },
  { id: 'time-mirror', english: 'TIME MIRROR', chinese: '时间之镜', position: { x: 80, y: 59 }, className: 'portal-node--time-mirror', delay: '1.45s' },
];
