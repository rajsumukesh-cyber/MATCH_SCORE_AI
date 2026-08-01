/**
 * Browser-side x402 wallet flow: connect an EIP-1193 wallet, sign an
 * EIP-3009 `transferWithAuthorization`, and produce the X-PAYMENT header.
 */
import {
  CHAIN_ID,
  encodePaymentHeader,
  type X402Network,
  type X402PaymentPayload,
  type X402PaymentRequirements,
} from "./x402";

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function hasWallet(): boolean {
  return getProvider() !== null;
}

export class WalletError extends Error {}

const CHAIN_METADATA: Record<
  X402Network,
  { chainName: string; rpcUrls: string[]; blockExplorerUrls: string[] }
> = {
  "base-sepolia": {
    chainName: "Base Sepolia",
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  base: {
    chainName: "Base",
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
};

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new WalletError(
      "No crypto wallet detected. Install a browser wallet such as MetaMask or Coinbase Wallet to pay.",
    );
  }
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new WalletError("No wallet account was shared.");
  return accounts[0];
}

export async function getConnectedAccount(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

async function ensureNetwork(network: X402Network) {
  const provider = getProvider();
  if (!provider) throw new WalletError("Wallet unavailable.");
  const target = `0x${CHAIN_ID[network].toString(16)}`;
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === target) return;

  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: target }] });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 4902) {
      const meta = CHAIN_METADATA[network];
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: target,
            chainName: meta.chainName,
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: meta.rpcUrls,
            blockExplorerUrls: meta.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw new WalletError(`Please switch your wallet to ${CHAIN_METADATA[network].chainName}.`);
    }
  }
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Sign the payment requirements and return the base64 X-PAYMENT header. */
export async function signPayment(
  requirements: X402PaymentRequirements,
): Promise<{ header: string; payer: string }> {
  const provider = getProvider();
  if (!provider) throw new WalletError("No crypto wallet detected.");

  const from = await connectWallet();
  await ensureNetwork(requirements.network);

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    validAfter: String(now - 60),
    validBefore: String(now + requirements.maxTimeoutSeconds),
    nonce: randomNonce(),
  };

  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    domain: {
      name: requirements.extra.name,
      version: requirements.extra.version,
      chainId: CHAIN_ID[requirements.network],
      verifyingContract: requirements.asset,
    },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  };

  let signature: string;
  try {
    signature = (await provider.request({
      method: "eth_signTypedData_v4",
      params: [from, JSON.stringify(typedData)],
    })) as string;
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 4001) throw new WalletError("You rejected the payment signature.");
    throw new WalletError("Your wallet could not sign this payment.");
  }

  const payload: X402PaymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: requirements.network,
    payload: { signature, authorization },
  };

  return { header: encodePaymentHeader(payload), payer: from };
}
