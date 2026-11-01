# Report formats

Column layouts of the eight reports the Upload Data page accepts. Layouts only, no data.
Update this file when a report changes. Keys match `src/lib/data-center/analyzers.ts`.

## Federal Return Summary (`efin_summary`, `ptin_summary`)
CSV or XLSX, one row per return, 113 columns. File name carries the pull date as DD_MM_YYYY.
Kept after sanitising (51): Group Name, customerId, EFIN, Dashboard Office Id, Company Name, Contact Name, Preparer,
Preparer Name, PTIN, First Name, Last Name, Last Four, ReturnID, 1040Type, Product, Bank, Return Type, Transmit Date,
Process Date, Ack Date, Ack Code, Funded Date, Refund, Advance Amount Requested/Approved/Paid, Advance Paid Date,
Return Tags, Referrer, Prep Fee, Calc Fee, Preparer Fee Paid (+ date), Efile Fee (+ paid), Document Prep Fee,
SBF Fee, SBF Paid (+ date), Total Transmission Fee, Transmission Fee Paid (+ date), audit fee fields, EroName,
Office Identifier, Doc Prep Fee Paid (+ date).
Dropped: SSN, Routing Number, Account Number, TP DOB, phones, address fields, email, AGI, filing status, dependents, form flags.
Bank codes seen: V, F (bank products), D, E, P (non-bank). Ack Code: A accepted, R rejected.
The two pulls overlap on the company's own EFINs; deduplicate.

## Refund Advantage disbursement listing (`refund_disbursements`)
XLSX, one sheet, one row per disbursed return, 54 columns, header on row 1. Maps directly to the dashboard `ra` rows:
EFIN, Parent EFIN, Group EFIN, PTIN, Disbursement Type, Application Date, Funding Date, Funding Type (Federal/State),
Expected Refund, Actual Refund, Customer Disbursement Amount, Refund Offset, Advance Repayment, Prior Year Loan Debt,
Refund Product Fee, Expected/Received Tax Prep Fee(s), High Prep Fee, Tax Prep After HP Fee, E-File Fee(s),
Service Bureau Fee (+ receiving EFIN), Transmitter Fee, Royalty Fee, Check Status, Check Fee, Check Fee Rebate, Doc Prep Fee.
Taxpayer SSN arrives masked (last 4). Dropped: bank account/routing, card, address, DOB, spouse fields.
The listing has no office names; offices come from the EFIN -> office list and the PTIN reference.

## Clients Balances (`clients_balances`)
Hand-built XLSX with sheets that have different layouts: "PTIN owed" (name, email, amount, disabled, invoiced link, notes),
"Taxx Pro owed" (client, name, email, no. of returns, amount; contains sub-headings and shifted rows),
"Invoiced" (name, email, notes, amount, invoiced link, disabled, notes), "Sheet2" (non-bank summary copy).
Parse per sheet; report rows that do not fit.

## EFIN non-bank invoice summary (`efin_invoices`)
Title rows, then header: ERO Name, Email, Preparer Name, EFIN, PTIN, Rate per Return ($), Old paid, Total Returns,
Billable Returns, Invoice Total ($). One row per office. Invoice = billable x rate - old paid.
Detail tabs per office (when present) are authoritative over the summary row.

## PTIN Client Reference (`ptin_clients`)
Hand-built XLSX with five sheets and different columns: "Cleaned" (company, full name, PTIN, email),
"10x and MSB" (company, name, PTIN, email, segment tag such as Taxx 10X), "2025 update", "Updated", "Emails" (several PTINs per row).
Used to map PTINs to offices and segments.

## Stripe Payments (`stripe_payments`)
One sheet, ~2,500 rows: Created date (UTC), Amount, Converted Amount, Description, Fee, Statement Descriptor, Status,
Seller Message, Customer Description, Customer Email, Invoice ID. Payments are matched to offices by customer email.
Statement descriptors separate non-bank returns, corporate returns, amended returns, season fees and subscriptions.

## TAP payments (`tap_payments`)
One sheet, one row per AMP charge: Company Name, Email address, Paid From (EFIN), Paid To, Create, Payment, Amount Due,
Amount Paid, Description, Invoice Number, Status, Date. May contain repeated header rows, blank rows and invalid dates.
