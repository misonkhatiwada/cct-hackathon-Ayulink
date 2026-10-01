# AyuLink Security, eSewa UAT & Real-Time Event Architecture

## 1. eSewa UAT Cryptographic Verification Flow
- **Secret Isolation**: `ESEWA_SECRET_KEY` (`8gBm/:&EnhH.1/q`) and `ESEWA_PRODUCT_CODE` (`EPAYTEST`) reside strictly on the Node.js backend (`server/services/esewaService.ts`).
- **Initiation (`POST /api/payments/esewa/initiate`)**: Generates an HMAC-SHA256 signature over `total_amount,transaction_uuid,product_code` and places an atomic 5-minute lock (`HELD`) on the appointment slot.
- **Verification (`POST /api/payments/esewa/verify`)**: Recomputes the HMAC-SHA256 signature on the server, verifies `status === 'COMPLETE'`, updates `paymentStatus = 'VERIFIED'`, transitions the slot from `HELD` to `CONFIRMED`, assigns sequential token `A-24`, and broadcasts `appointment:created` via Socket.IO.

## 2. Socket.IO Real-Time Events
- `appointment:created`
- `appointment:updated`
- `queue:updated`
- `queue:called`
- `patient:checked-in`
- `prescription:created`
- `lab:order-created`
- `lab:report-ready`
- `notification:new`
- `doctor:availability-updated`
