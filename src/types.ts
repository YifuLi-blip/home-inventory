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
