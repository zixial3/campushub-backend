Feature: Campus resource reservation
  As a student
  I want to reserve a campus resource for a time slot
  So that the room or equipment is mine when I arrive

  # "Tomorrow" and clock times are in the browser's time zone, which the
  # Playwright config fixes to America/New_York. New bookings start as PENDING.

  Scenario: Student successfully reserves an available study room
    Given student "alice" is on the CampusHub home page
    When they filter resources by type "Rooms"
    And they select "Study Room 302"
    And they request a booking for tomorrow from "10:00 AM" to "11:00 AM"
    Then they should see a "Booked" confirmation with status "PENDING"
    And "Study Room 302" tomorrow at "10:00 AM" should appear in their "My bookings" list

  Scenario Outline: Student receives a conflict alert on double-booking
    Given "3D Printer A" is already reserved tomorrow from "2:00 PM" to "3:00 PM" by student "bob"
    And student "carol" is on the CampusHub home page
    When they request "3D Printer A" tomorrow from "<start>" to "<end>"
    Then they should see the conflict alert "Time slot unavailable"
    And the alert should say "This resource is already reserved for the selected time window."
    And no reservation should be created for student "carol"

    Examples:
      | overlap             | start   | end     |
      | the exact same slot | 2:00 PM | 3:00 PM |
      | a partial overlap   | 2:30 PM | 3:30 PM |

  Scenario: Student can book the slot that starts when another booking ends
    Given "3D Printer A" is already reserved tomorrow from "2:00 PM" to "3:00 PM" by student "bob"
    And student "carol" is on the CampusHub home page
    When they request "3D Printer A" tomorrow from "3:00 PM" to "4:00 PM"
    Then they should see a "Booked" confirmation with status "PENDING"

  Scenario: Cancelling a booking frees the time slot for other students
    Given student "alice" has booked "Group Study Room 115" tomorrow from "9:00 AM" to "10:00 AM"
    When they cancel that booking from their "My bookings" list
    Then their "My bookings" list should be empty
    And student "bob" can book "Group Study Room 115" tomorrow from "9:00 AM" to "10:00 AM"

  Scenario: An out-of-service resource cannot be booked
    Given student "alice" is on the CampusHub home page
    Then "Laser Cutter" should be marked "Out of service"
    And its booking button should be disabled

  Scenario: The booking form rejects an end time before the start time
    Given student "alice" is on the CampusHub home page
    When they select "Study Room 302"
    And they request a booking for tomorrow from "11:00 AM" to "10:00 AM"
    Then they should see the field error "End time must be after the start time."
    And no booking request should reach the server
