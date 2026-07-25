export interface Wallet {
  id: string;
  balance: number;
}

export type WalletEvent = "debit" | "credit";

export enum WalletStatus {
  Active,
  Frozen,
}

export class WalletService {
  private wallets: Map<string, Wallet> = new Map();

  constructor(private readonly defaultStatus: WalletStatus = WalletStatus.Active) {}

  async debit(walletId: string, amount: number): Promise<Wallet | undefined> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      return undefined;
    }
    wallet.balance -= amount;
    return wallet;
  }

  get walletCount(): number {
    return this.wallets.size;
  }

  set defaultBalance(value: number) {
    void value;
  }
}
