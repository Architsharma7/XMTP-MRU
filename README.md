# XMTP Event Notifier for Stack's Micro Rollup

## Overview

This guide is for building an Event Notifier for Stackr’s Micro-rollup using XMTP. We will be integrating Stackr’s Micro-rollup with XMTP to leverage the capabilities and utility of micro-rollup and XMTP.

## Pre-requisites

Before you begin this guide, please ensure you already know or go through the following:

- Basics of Stackr’s Micro rollups: [Stackr Micro-rollup](https://docs.stf.xyz/build/zero-to-one/getting-started)
- Basics of XMTP:  [XMTP Docs](https://docs.xmtp.org/)

## What is it?

The event notifier implements XMTP as a communication layer for MRU events and updates. When significant events occur in the MRU, trigger XMTP messages. MRU node uses XMTP to broadcast event notifications to the wallet performing action on the rollup.

## **Project Structure**

```markdown
├── frontend
│   ├── pages
│   │   └── index.ts
│   ├── public
│   └── styles
└── rollup
    ├── Dockerfile
    ├── deployment.json
    ├── genesis-state.json
    ├── src
    │   ├── index.ts
    │   └── stackr
    ├── stackr.config.ts
```

## How to build it?

1. To enable the MRU to send messages to the user using XMTP, a client is required along with functions to create conversations and send messages.
    
    ```jsx
    class XMTPNotifier {
      xmtpClient: Client;
      // mapping to store XMTP conversations, keyed by msg sender address.
      conversations: Map<string, Conversation> = new Map();
    
      constructor(xmtpClient: Client) {
        this.xmtpClient = xmtpClient;
      }
    
      async getOrCreateConversation(address: string): Promise<Conversation> {
        if (!this.conversations.has(address)) {
          const conversation = await this.xmtpClient.conversations.newConversation(
            address
          );
          this.conversations.set(address, conversation);
        }
        return this.conversations.get(address)!;
      }
    
      async notifyUser(address: string, message: string) {
        try {
          const conversation = await this.getOrCreateConversation(address);
          await conversation.send(message);
          console.log(`Sent message to ${address}:`, message);
        } catch (error) {
          console.error(`Failed to send message to ${address}:`, error);
        }
      }
    }
    
    let xmtpNotifier: XMTPNotifier;
    
    async function initializeXMTP() {
      const wallet = new Wallet(process.env.PRIVATE_KEY!);
      const xmtpClient = await Client.create(wallet);
      xmtpNotifier = new XMTPNotifier(xmtpClient);
      console.log("XMTP client initialized");
    }
    ```
    

Here the XMTPNotifier class is defined which initialises the XMTP client and contains functions for creating conversations (`newConversation`) and sending messages to `the` user(`send(message)`).

1. Also on the client side, we need to do the same.
    
    ```tsx
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
            console.log("Received message:", message);
          }
        }
      }
    ```
    

## How to run?

First, run the Micro rollup using the command inside the `/rollup` directory

```markdown
bun run src/index.ts
```

and if everything works, you will see this in the CLI

```jsx
Starting server...

XX    XX MM    MM TTTTTT PPPPPP   DDDDD   EEEEEEE VV     VV
 XX  XX  MMM  MMM   TT   PP   PP  DD  DD  EE      VV     VV
  XXXX   MM MM MM   TT   PPPPPP   DD   DD EEEEE    VV   VV
 XX  XX  MM    MM   TT   PP       DD   DD EE        VV VV
XX    XX MM    MM   TT   PP       DDDDDD  EEEEEEE    VVV

Connected to the XMTP 'dev' network. Use 'production' for production messages.
https://github.com/xmtp/xmtp-js#xmtp-production-and-dev-network-environments

--------------------------------------------------
🚀  Playground server running on http://localhost:42069
🛝  Access MRU Playground using the link ⬇️
	https://playground.stf.xyz (https://playground.stf.xyz?apiUrl=localhost:42069)
--------------------------------------------------
XMTP client initialized
listening on port 3000
```

and then start the frontend application using the command in the `/frontend` directory

```jsx
npm run dev
```