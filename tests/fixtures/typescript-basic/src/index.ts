import { WalletService, WalletStatus } from "./wallet.js";

export function createDefaultService(): WalletService {
  return new WalletService(WalletStatus.Active);
}

export { WalletService, WalletStatus };
