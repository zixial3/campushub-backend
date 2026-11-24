// Executable form of e2e/scenarios/reservation.feature. Each test is named after
// its Gherkin scenario and each step after its Given/When/Then line, so the
// Playwright report reads like the feature file. The final test fails if the
// two drift apart.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Request } from '@playwright/test';
import { activeReservations, clearBookings, reserve } from './support/api';
import { CampusHubPage } from './support/campushub-page';
import { clockPattern, tomorrow } from './support/time';

const SCENARIOS = {
  reserve: 'Student successfully reserves an available study room',
  conflict: 'Student receives a conflict alert on double-booking',
  backToBack: 'Student can book the slot that starts when another booking ends',
  cancel: 'Cancelling a booking frees the time slot for other students',
  outOfService: 'An out-of-service resource cannot be booked',
  validation: 'The booking form rejects an end time before the start time',
} as const;

// Rows of the conflict Scenario Outline's Examples table.
const CONFLICT_EXAMPLES = [
  { overlap: 'the exact same slot', start: '2:00 PM', end: '3:00 PM' },
  { overlap: 'a partial overlap', start: '2:30 PM', end: '3:30 PM' },
] as const;

test.beforeEach(async ({ request }): Promise<void> => {
  await clearBookings(request);
});

test(SCENARIOS.reserve, async ({ page }): Promise<void> => {
  const app = new CampusHubPage(page);
  const date: string = tomorrow();

  await test.step('Given student "alice" is on the CampusHub home page', async (): Promise<void> => {
    await app.open('alice');
  });
  await test.step('When they filter resources by type "Rooms"', async (): Promise<void> => {
    await app.filterBy('Rooms');
    await expect(app.resources().getByRole('listitem')).toHaveCount(2);
    await expect(app.resourceCard('Study Room 302')).toBeVisible();
    await expect(app.resourceCard('3D Printer A')).toHaveCount(0);
  });
  await test.step('And they select "Study Room 302"', async (): Promise<void> => {
    await app.select('Study Room 302');
  });
  await test.step('And they request a booking for tomorrow from "10:00 AM" to "11:00 AM"', async (): Promise<void> => {
    await app.requestBooking('Study Room 302', date, '10:00 AM', '11:00 AM');
  });
  await test.step('Then they should see a "Booked" confirmation with status "PENDING"', async (): Promise<void> => {
    const confirmation = app.bookingForm('Study Room 302').getByRole('status');
    await expect(confirmation).toContainText('Booked');
    await expect(confirmation).toContainText(clockPattern('10:00 AM'));
    await expect(confirmation).toContainText('Status: PENDING');
  });
  await test.step('And "Study Room 302" tomorrow at "10:00 AM" should appear in their "My bookings" list', async (): Promise<void> => {
    const row = app.booking('Study Room 302');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(clockPattern('10:00 AM'));
    await expect(row).toContainText(/pending/i);
  });
});

for (const example of CONFLICT_EXAMPLES) {
  test(`${SCENARIOS.conflict} (${example.overlap})`, async ({
    page,
    request,
  }): Promise<void> => {
    const app = new CampusHubPage(page);
    const date: string = tomorrow();

    await test.step('Given "3D Printer A" is already reserved tomorrow from "2:00 PM" to "3:00 PM" by student "bob"', async (): Promise<void> => {
      await reserve(request, {
        resource: '3D Printer A',
        student: 'bob',
        date,
        from: '2:00 PM',
        to: '3:00 PM',
      });
    });
    await test.step('And student "carol" is on the CampusHub home page', async (): Promise<void> => {
      await app.open('carol');
    });
    await test.step(`When they request "3D Printer A" tomorrow from "${example.start}" to "${example.end}"`, async (): Promise<void> => {
      await app.select('3D Printer A');
      await app.requestBooking('3D Printer A', date, example.start, example.end);
    });
    await test.step('Then they should see the conflict alert "Time slot unavailable"', async (): Promise<void> => {
      await expect(app.bookingForm('3D Printer A').getByRole('alert')).toContainText(
        'Time slot unavailable',
      );
    });
    await test.step('And the alert should say "This resource is already reserved for the selected time window."', async (): Promise<void> => {
      await expect(app.bookingForm('3D Printer A').getByRole('alert')).toContainText(
        'This resource is already reserved for the selected time window.',
      );
    });
    await test.step('And no reservation should be created for student "carol"', async (): Promise<void> => {
      await expect(app.bookingForm('3D Printer A').getByRole('status')).toHaveCount(0);
      await expect(app.myBookings()).toContainText('No active bookings for carol');
      expect(await activeReservations(request, 'carol')).toEqual([]);
      // Bob's original booking is untouched.
      expect(await activeReservations(request, 'bob')).toHaveLength(1);
    });
  });
}

test(SCENARIOS.backToBack, async ({ page, request }): Promise<void> => {
  const app = new CampusHubPage(page);
  const date: string = tomorrow();

  await test.step('Given "3D Printer A" is already reserved tomorrow from "2:00 PM" to "3:00 PM" by student "bob"', async (): Promise<void> => {
    await reserve(request, {
      resource: '3D Printer A',
      student: 'bob',
      date,
      from: '2:00 PM',
      to: '3:00 PM',
    });
  });
  await test.step('And student "carol" is on the CampusHub home page', async (): Promise<void> => {
    await app.open('carol');
  });
  await test.step('When they request "3D Printer A" tomorrow from "3:00 PM" to "4:00 PM"', async (): Promise<void> => {
    await app.select('3D Printer A');
    await app.requestBooking('3D Printer A', date, '3:00 PM', '4:00 PM');
  });
  await test.step('Then they should see a "Booked" confirmation with status "PENDING"', async (): Promise<void> => {
    const confirmation = app.bookingForm('3D Printer A').getByRole('status');
    await expect(confirmation).toContainText('Booked');
    await expect(confirmation).toContainText('Status: PENDING');
    await expect(app.booking('3D Printer A')).toContainText(clockPattern('3:00 PM'));
  });
});

test(SCENARIOS.cancel, async ({ page, request }): Promise<void> => {
  const app = new CampusHubPage(page);
  const date: string = tomorrow();

  await test.step('Given student "alice" has booked "Group Study Room 115" tomorrow from "9:00 AM" to "10:00 AM"', async (): Promise<void> => {
    await app.open('alice');
    await app.select('Group Study Room 115');
    await app.requestBooking('Group Study Room 115', date, '9:00 AM', '10:00 AM');
    await expect(app.booking('Group Study Room 115')).toHaveCount(1);
  });
  await test.step('When they cancel that booking from their "My bookings" list', async (): Promise<void> => {
    await app
      .myBookings()
      .getByRole('button', { name: 'Cancel reservation for Group Study Room 115' })
      .click();
  });
  await test.step('Then their "My bookings" list should be empty', async (): Promise<void> => {
    await expect(app.booking('Group Study Room 115')).toHaveCount(0);
    await expect(app.myBookings()).toContainText('No active bookings for alice');
    expect(await activeReservations(request, 'alice')).toEqual([]);
  });
  await test.step('And student "bob" can book "Group Study Room 115" tomorrow from "9:00 AM" to "10:00 AM"', async (): Promise<void> => {
    await app.open('bob');
    await app.select('Group Study Room 115');
    await app.requestBooking('Group Study Room 115', date, '9:00 AM', '10:00 AM');
    await expect(
      app.bookingForm('Group Study Room 115').getByRole('status'),
    ).toContainText('Status: PENDING');
  });
});

test(SCENARIOS.outOfService, async ({ page }): Promise<void> => {
  const app = new CampusHubPage(page);

  await test.step('Given student "alice" is on the CampusHub home page', async (): Promise<void> => {
    await app.open('alice');
  });
  await test.step('Then "Laser Cutter" should be marked "Out of service"', async (): Promise<void> => {
    await expect(app.resourceCard('Laser Cutter')).toContainText('Out of service');
  });
  await test.step('And its booking button should be disabled', async (): Promise<void> => {
    await expect(app.resourceCard('Laser Cutter').getByRole('button')).toBeDisabled();
    await expect(app.resourceCard('Laser Cutter').getByRole('button')).toHaveText(
      'Unavailable',
    );
  });
});

test(SCENARIOS.validation, async ({ page }): Promise<void> => {
  const app = new CampusHubPage(page);
  const date: string = tomorrow();
  const bookingRequests: string[] = [];
  page.on('request', (req: Request): void => {
    if (req.method() === 'POST' && req.url().includes('/api/v1/reservations')) {
      bookingRequests.push(req.url());
    }
  });

  await test.step('Given student "alice" is on the CampusHub home page', async (): Promise<void> => {
    await app.open('alice');
  });
  await test.step('When they select "Study Room 302"', async (): Promise<void> => {
    await app.select('Study Room 302');
  });
  await test.step('And they request a booking for tomorrow from "11:00 AM" to "10:00 AM"', async (): Promise<void> => {
    await app.requestBooking('Study Room 302', date, '11:00 AM', '10:00 AM');
  });
  await test.step('Then they should see the field error "End time must be after the start time."', async (): Promise<void> => {
    const form = app.bookingForm('Study Room 302');
    await expect(form.getByText('End time must be after the start time.')).toBeVisible();
    await expect(form.getByLabel('End')).toHaveAttribute('aria-invalid', 'true');
  });
  await test.step('And no booking request should reach the server', async (): Promise<void> => {
    await expect(app.bookingForm('Study Room 302').getByRole('status')).toHaveCount(0);
    expect(bookingRequests).toEqual([]);
  });
});

test('the feature file and this spec describe the same scenarios', ({
  browserName,
}): void => {
  test.skip(browserName !== 'chromium', 'File check; one browser is enough.');
  const feature: string = readFileSync(
    join(__dirname, 'scenarios', 'reservation.feature'),
    'utf8',
  );
  const titles: string[] = [
    ...feature.matchAll(/^\s*Scenario(?: Outline)?: (.+)$/gm),
  ].map((match: RegExpMatchArray): string => (match[1] ?? '').trim());
  expect(titles).toEqual(Object.values(SCENARIOS));

  const exampleRows: string[][] = feature
    .slice(feature.indexOf('Examples:'))
    .split('\n')
    .filter((line: string): boolean => line.trim().startsWith('|'))
    .slice(1)
    .map((line: string): string[] =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell: string): string => cell.trim()),
    );
  expect(exampleRows).toEqual(
    CONFLICT_EXAMPLES.map((row) => [row.overlap, row.start, row.end]),
  );
});
