# Notifications

## Enable a device

1. Deploy over HTTPS and configure VAPID secrets.
2. Sign in on the device that should receive reminders.
3. On iPhone/iPad, add the app to the Home Screen and launch it there.
4. Open Settings and select **Enable this device**.
5. Grant notification permission and check the server test notification.

Repeat on each device. The interface language is saved with the subscription when enabling or testing it. Notifications contain the reminder title and due time, which may appear on the lock screen.

## Real-device acceptance test

1. Create a temporary reminder due 10–15 minutes from now.
2. Set its alert to **At the due time**.
3. Confirm that the scheduler heartbeat updates in Settings.
4. Close the app, keep the device online, and wait until the due time plus one scheduler interval.
5. Confirm that the notification appears and tapping it opens the app.
6. Mark the test complete when finished.

Automated tests mock provider responses. They verify encryption and dispatch behavior but cannot certify delivery on your phone, browser or hosting account.

## Delivery semantics

- The scheduler runs every five minutes, not at second-level precision.
- Eligibility begins at `due time − lead time`.
- The catch-up window is 24 hours after the alert time; older alerts are skipped.
- Each invocation attempts at most five device deliveries. Multiple devices count separately.
- Each reminder revision/device pair has a delivery record. Accepted jobs are not routinely resent.
- Database leases prevent overlapping runs from claiming the same job simultaneously.
- Failed deliveries retry with backoff, up to five attempts. HTTP 404/410 removes expired subscriptions.
- A crash between provider acceptance and database acknowledgement can cause a retry. Stable notification tags help coalesce duplicates; exactly-once display is not guaranteed.
- Editing the title, date or lead time, or undoing completion, starts a new revision and can notify again within the catch-up window.
- Completing/deleting a reminder prevents future selections but cannot recall messages already sent or in flight.
- Signing out does not disable push. Use **Disable this device** before leaving a shared device.

## Local scheduler

With `npm run preview` or `npm run dev` running, trigger the development scheduler from another terminal:

```sh
curl "http://localhost:8787/__scheduled?cron=*/5%20*%20*%20*%20*"
```

Use `curl.exe` in PowerShell if `curl` is an alias. This is Wrangler's development route, not a public application endpoint. Local tests with real subscriptions can send real notifications.

## Troubleshooting

| Symptom                                | Check                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Enable button disabled                 | Runtime VAPID secrets are present.                                        |
| No permission prompt                   | Browser support, site permissions and iOS Home Screen installation.       |
| Server test fails                      | Subscription, matching VAPID keys, provider rejection and Worker logs.    |
| Test works but scheduled alerts do not | Cron propagation, heartbeat, date, lead time and completion state.        |
| Late delivery                          | Connectivity, Focus mode, power settings, scheduling interval or backlog. |
| Delivery stops after rotation          | Disable and re-enable devices with the new public key.                    |
| Unsupported endpoint                   | Review `safeEndpoint` before adding another legitimate push provider.     |

Calendar export is an alternative: import the `.ics` file and verify your calendar honors its alarms. Imports are snapshots and do not synchronize later changes.

[Apple Web Push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
