import { Types } from 'mongoose';
import { ResourceModel } from '../../models/Resource.model';
import type { Resource } from '../../../shared/contract';
import { getHealthReport } from '../health.service';
import { listResources } from '../resource.service';

const ROOM = new Types.ObjectId('000000000000000000000101');
const LASER = new Types.ObjectId('000000000000000000000202');

describe('listResources', () => {
  beforeEach(async (): Promise<void> => {
    await ResourceModel.create([
      {
        _id: LASER,
        name: 'Laser Cutter',
        type: 'EQUIPMENT',
        location: 'EXP',
        isAvailable: false,
      },
      {
        _id: ROOM,
        name: 'Study Room 302',
        type: 'ROOM',
        location: 'Snell 3',
        isAvailable: true,
      },
    ]);
  });

  it('maps documents to the contract shape, ordered by id', async (): Promise<void> => {
    const resources: Resource[] = await listResources({});
    expect(resources).toEqual([
      {
        id: ROOM.toHexString(),
        name: 'Study Room 302',
        type: 'ROOM',
        location: 'Snell 3',
        isAvailable: true,
      },
      {
        id: LASER.toHexString(),
        name: 'Laser Cutter',
        type: 'EQUIPMENT',
        location: 'EXP',
        isAvailable: false,
      },
    ]);
  });

  it('combines the type and availability filters with AND', async (): Promise<void> => {
    await expect(
      listResources({ type: 'EQUIPMENT', isAvailable: false }),
    ).resolves.toHaveLength(1);
    await expect(
      listResources({ type: 'EQUIPMENT', isAvailable: true }),
    ).resolves.toEqual([]);
    await expect(listResources({ isAvailable: true })).resolves.toMatchObject([
      { name: 'Study Room 302' },
    ]);
  });

  it('returns nothing for an unknown type without querying for it', async (): Promise<void> => {
    const find = jest.spyOn(ResourceModel, 'find');
    try {
      await expect(listResources({ type: 'STUDY_ROOM' })).resolves.toEqual([]);
      expect(find).not.toHaveBeenCalled();
    } finally {
      find.mockRestore();
    }
  });
});

describe('getHealthReport', () => {
  it('reports ok with a non-negative uptime and a UTC timestamp', (): void => {
    const report = getHealthReport();
    expect(report.status).toBe('ok');
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(report.uptimeSeconds)).toBe(true);
    expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
  });
});
