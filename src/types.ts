export type Household = {
  id: string;
  name: string;
  ownerEmail: string;
  memberEmails: string[];
};

export type ItemInput = {
  name: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  minimum: number;
  /** YYYY-MM-DD；没有保质期时为 null。 */
  expiryDate: string | null;
};

export type Item = ItemInput & { id: string };

export type Account = {
  uid: string;
  email: string;
  verified: boolean;
};

export type ExpenseInput = {
  /** 金额以分保存，避免浮点误差。 */
  amountCents: number;
  category: string;
  note: string;
  /** YYYY-MM-DD */
  date: string;
  paidBy: string;
};

export type Expense = ExpenseInput & { id: string };
