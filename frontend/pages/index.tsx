import { Client } from "@xmtp/xmtp-js";
import { useAccount, useWalletClient, usePublicClient} from "wagmi";
import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Signer } from "@xmtp/xmtp-js";

const MRU_SERVER_URL = "http://localhost:3000";

export default function Home() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (isConnected && walletClient && !xmtpClient) {
      initializeXMTP();
    }
  }, [isConnected, walletClient, xmtpClient]);

  async function initializeXMTP() {
    if (walletClient && publicClient) {
      try {
        const signer: Signer = {
          getAddress: () => Promise.resolve(walletClient.account.address),
          signMessage: (message: string) => walletClient.signMessage({ message }),
        };

        const client = await Client.create(signer, { env: "dev" });
        setXmtpClient(client);
        startMessageStream(client);
      } catch (error) {
        console.error('Error initializing XMTP client:', error);
      }
    }
  }

  async function startMessageStream(client: Client) {
    const stream = await client.conversations.stream();
    for await (const conversation of stream) {
      for await (const message of await conversation.streamMessages()) {
        setMessages((prevMessages) => [...prevMessages, message.content]);
      }
    }
  }

  return (
    <div>
      <div>
        <h1>MRU XMTP Client</h1>
        <ConnectButton />
        {isConnected && !xmtpClient && <button onClick={initializeXMTP}>Connect to XMTP</button>}
        {isConnected && xmtpClient && (
          <div>
            <h2>MRU Events:</h2>
            <ul>
              {messages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
