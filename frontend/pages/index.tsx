import { Client } from "@xmtp/xmtp-js";
import { useAccount, useWalletClient} from "wagmi";
import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const MRU_SERVER_URL = "http://localhost:3000";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (isConnected && walletClient && !xmtpClient) {
      initializeXMTP();
    }
  }, [isConnected, walletClient, xmtpClient]);

  async function initializeXMTP() {
    if (walletClient) {
      try {
        const client = await Client.create(walletClient, { env: "dev" });
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

  async function subscribeToMRU() {
    if (!address || !xmtpClient) return;

    try {
      const response = await fetch(`${MRU_SERVER_URL}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'actionSubmit',
          address: address,
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        console.log('Subscribed to MRU events');
      } else {
        console.error('Failed to subscribe');
      }
    } catch (error) {
      console.error('Error subscribing to MRU:', error);
    }
  }

  async function unsubscribeFromMRU() {
    if (!address) return;

    try {
      const response = await fetch(`${MRU_SERVER_URL}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'actionSubmit',
          address: address,
        }),
      });

      if (response.ok) {
        setIsSubscribed(false);
        console.log('Unsubscribed from MRU events');
      } else {
        console.error('Failed to unsubscribe');
      }
    } catch (error) {
      console.error('Error unsubscribing from MRU:', error);
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
            <button onClick={subscribeToMRU}>Subscribe to MRU Events</button>
            <button onClick={unsubscribeFromMRU}>
              Unsubscribe from MRU Events
            </button>
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
