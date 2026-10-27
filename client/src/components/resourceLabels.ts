import type { ResourceType } from '../api/types';

export const RESOURCE_TYPE_LABELS: Readonly<Record<ResourceType, string>> = {
  ROOM: 'Study room',
  EQUIPMENT: 'Equipment',
  LAB: 'Lab',
};
