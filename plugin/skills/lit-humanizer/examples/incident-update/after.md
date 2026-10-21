# Payment page outage, 14:05 to 14:55

From 14:05 local time the payment page returned errors for card payments. Bank transfers kept working. An expired certificate on the connection to the card processor caused the failure.

The certificate was renewed at 14:52, and card payments resumed at 14:55. During those 50 minutes, 312 card payments failed. Customers were charged only for payments that went through.

Orders placed during the outage stay in the basket for 24 hours, so customers who saw an error can retry the payment. The team will add an alert that fires 30 days before any certificate expires.

No further errors have been reported since the fix. The team is still watching the payment page.
