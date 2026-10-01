import crypto from 'crypto';

/**
 * eSewa UAT / Test Environment Payment Cryptographic Service
 * Secrets stay strictly on the Node.js backend.
 */

const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
const ESEWA_BASE_URL =
  process.env.ESEWA_BASE_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';

export interface EsewaInitiatePayload {
  amount: number;
  taxAmount: number;
  totalAmount: number;
  transactionUuid: string;
  productCode: string;
  signedFieldNames: string;
  signature: string;
  gatewayUrl: string;
}

export function createEsewaSignedRequest(amount: number, transactionUuid: string): EsewaInitiatePayload {
  const taxAmount = 0;
  const totalAmount = amount + taxAmount;
  const signedFieldNames = 'total_amount,transaction_uuid,product_code';
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_PRODUCT_CODE}`;

  const signature = crypto
    .createHmac('sha256', ESEWA_SECRET_KEY)
    .update(message)
    .digest('base64');

  return {
    amount,
    taxAmount,
    totalAmount,
    transactionUuid,
    productCode: ESEWA_PRODUCT_CODE,
    signedFieldNames,
    signature,
    gatewayUrl: ESEWA_BASE_URL,
  };
}

export function verifyEsewaTransactionPayload(params: {
  transactionUuid: string;
  totalAmount: number;
  productCode: string;
  clientSignature: string;
  status: string;
}): { verified: boolean; expectedSignature: string; esewaRefId: string; reason?: string } {
  const { transactionUuid, totalAmount, productCode, clientSignature, status } = params;

  if (productCode !== ESEWA_PRODUCT_CODE) {
    return {
      verified: false,
      expectedSignature: '',
      esewaRefId: '',
      reason: `Product code mismatch: expected ${ESEWA_PRODUCT_CODE}`,
    };
  }

  if (status !== 'COMPLETE') {
    return {
      verified: false,
      expectedSignature: '',
      esewaRefId: '',
      reason: `Transaction status is ${status}, expected COMPLETE`,
    };
  }

  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_PRODUCT_CODE}`;
  const expectedSignature = crypto
    .createHmac('sha256', ESEWA_SECRET_KEY)
    .update(message)
    .digest('base64');

  if (clientSignature !== expectedSignature) {
    return {
      verified: false,
      expectedSignature,
      esewaRefId: '',
      reason: 'Cryptographic HMAC-SHA256 signature verification failed',
    };
  }

  const esewaRefId = `ESW-UAT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  return {
    verified: true,
    expectedSignature,
    esewaRefId,
  };
}
