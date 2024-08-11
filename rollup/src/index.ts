import express, { Request, Response } from "express";
import { Wallet } from "ethers";
import { ActionEvents } from "@stackr/sdk";
import { Playground } from "@stackr/sdk/plugins";
import dotenv from "dotenv";
import { schemas } from "./stackr/actions.ts";
import { ERC20Machine, mru } from "./stackr/erc20.ts";
import { transitions } from "./stackr/transitions.ts";
import { Client, Conversation } from "@xmtp/xmtp-js";

console.log("Starting server...");
dotenv.config();

const erc20Machine = mru.stateMachines.get<ERC20Machine>("erc-20");

const app = express();
app.use(express.json());

if (process.env.NODE_ENV === "development") {
  const playground = Playground.init(mru);

  playground.addGetMethod(
    "/custom/hello",
    async (_req: Request, res: Response) => {
      res.json({
        message: "Hello from the custom route",
      });
    }
  );
}

///////////////// XMTP Integration Functions //////////////////////
/////@note: This is a basic example of integration of XMTP with Stackr micro-rollups,
/////@note: and does not maintain subscriptions across server restarts.

class XMTPNotifier {
  xmtpClient: Client;
  // mapping to store XMTP conversations, keyed by subscriber address.
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

  async notifySubscribers(
    eventType: string,
    message: string,
    subscribers: Map<string, string[]>
  ) {
    const eventSubscribers = subscribers.get(eventType) || [];
    for (const subscriberAddress of eventSubscribers) {
      try {
        const conversation = await this.getOrCreateConversation(
          subscriberAddress
        );
        await conversation.send(message);
      } catch (error) {
        console.error(`Failed to send message to ${subscriberAddress}:`, error);
      }
    }
  }
}

let xmtpNotifier: XMTPNotifier;
let subscribers: Map<string, string[]> = new Map();

async function initializeXMTP() {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const xmtpClient = await Client.create(wallet);
  xmtpNotifier = new XMTPNotifier(xmtpClient);
  console.log("XMTP client initialized");
}

///////////////// XMTP Integration Functions //////////////////////

const { actions, chain, events } = mru;

app.get("/actions/:hash", async (req: Request, res: Response) => {
  const { hash } = req.params;
  const action = await actions.getByHash(hash);
  if (!action) {
    return res.status(404).send({ message: "Action not found" });
  }
  return res.send(action);
});

app.get("/blocks/:hash", async (req: Request, res: Response) => {
  const { hash } = req.params;
  const block = await chain.getBlockByHash(hash);
  if (!block) {
    return res.status(404).send({ message: "Block not found" });
  }
  return res.send(block);
});

app.post("/:reducerName", async (req: Request, res: Response) => {
  const { reducerName } = req.params;
  const actionReducer = transitions[reducerName];

  if (!actionReducer) {
    res.status(400).send({ message: "̦̦no reducer for action" });
    return;
  }
  const action = reducerName as keyof typeof schemas;

  const { msgSender, signature, inputs } = req.body;

  const schema = schemas[action];

  try {
    const newAction = schema.actionFrom({ msgSender, signature, inputs });
    const ack = await mru.submitAction(reducerName, newAction);
    res.status(201).send({ ack });
  } catch (e: any) {
    res.status(400).send({ error: e.message });
  }
  return;
});

app.get("/", (_req: Request, res: Response) => {
  return res.send({ state: erc20Machine?.state });
});


// updated event listeners to notify XMTP subscribers
events.subscribe(ActionEvents.SUBMIT, async (args) => {
  console.log("Submitted an action", args);
  await xmtpNotifier.notifySubscribers(
    "actionSubmit",
    `Action submitted: ${JSON.stringify(args)}`,
    subscribers
  );
});

events.subscribe(ActionEvents.EXECUTION_STATUS, async (action) => {
  console.log("Action execution status updated", action);
  await xmtpNotifier.notifySubscribers(
    "executionStatus",
    `Execution status updated: ${JSON.stringify(action)}`,
    subscribers
  );
});

// routes for XMTP subscription management
app.post("/subscribe", async (req: Request, res: Response) => {
  const { eventType, address } = req.body;
  if (!subscribers.has(eventType)) {
    subscribers.set(eventType, []);
  }
  subscribers.get(eventType)!.push(address);
  res.status(200).send({ message: "Subscribed successfully" });
});

app.post("/unsubscribe", async (req: Request, res: Response) => {
  const { eventType, address } = req.body;
  const eventSubscribers = subscribers.get(eventType);
  if (eventSubscribers) {
    const index = eventSubscribers.indexOf(address);
    if (index > -1) {
      eventSubscribers.splice(index, 1);
    }
  }
  res.status(200).send({ message: "Unsubscribed successfully" });
});

async function initializeServer() {
  await initializeXMTP();

  app.listen(3000, () => {
    console.log("listening on port 3000");
  });
}

initializeServer().catch(console.error);