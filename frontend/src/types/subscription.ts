export type Subscription = {
  id: string;
  customer: string;
  description: string;
  billingType: string;
  value: number;
  cycle: "MONTHLY" | "YEARLY";
  status: string;
  nextDueDate: string;
  dateCreated: string;
  externalReference?: string | null;
};

export type Payment = {
  id: string;
  description: string;
  dueDate: string;
  value: number;
  status: string;
  billingType: string;
  invoiceUrl?: string | null;
};

export type PixQRCode = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
};
