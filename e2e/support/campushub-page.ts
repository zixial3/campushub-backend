// User-facing interactions with the CampusHub UI. Every locator is role-, label-
// or text-based, the way a person (or a screen reader) finds things; there are
// no CSS classes, XPath, or test IDs.

import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Student } from './api';
import { localInput } from './time';

export class CampusHubPage {
  constructor(private readonly page: Page) {}

  /** Opens the home page and switches the header's Student ID to `student`. */
  async open(student: Student): Promise<void> {
    await this.page.goto('/');
    await this.page.getByLabel('Student ID').fill(student);
    await this.page.getByRole('button', { name: 'Switch' }).click();
    // The bookings panel reloads for the new student; wait until it settles.
    await expect(this.myBookings()).not.toContainText('Loading');
    await expect(this.myBookings()).toContainText(
      new RegExp(`No active bookings for ${student}|Cancel`),
    );
  }

  resources(): Locator {
    return this.page.getByRole('region', { name: 'Campus resources' });
  }

  /** A resource card, named after its resource via aria-labelledby. */
  resourceCard(name: string): Locator {
    return this.resources().getByRole('listitem', { name, exact: true });
  }

  async filterBy(label: string): Promise<void> {
    const filter: Locator = this.page
      .getByRole('group', { name: 'Filter by type' })
      .getByRole('button', { name: label, exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
  }

  async select(resource: string): Promise<void> {
    await this.resourceCard(resource).getByRole('button', { name: 'Book' }).click();
    await expect(this.bookingForm(resource)).toBeVisible();
  }

  bookingForm(resource: string): Locator {
    return this.page.getByRole('region', { name: `Book ${resource}` });
  }

  async requestBooking(
    resource: string,
    date: string,
    from: string,
    to: string,
  ): Promise<void> {
    const form: Locator = this.bookingForm(resource);
    await form.getByLabel('Start').fill(localInput(date, from));
    await form.getByLabel('End').fill(localInput(date, to));
    await form.getByRole('button', { name: 'Request booking' }).click();
  }

  myBookings(): Locator {
    return this.page.getByRole('region', { name: 'My bookings' });
  }

  booking(resource: string): Locator {
    return this.myBookings().getByRole('listitem').filter({ hasText: resource });
  }
}
