import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomFile } from "telegram/client/uploads";

// Token CA
const REQUIRED_TOKEN_MINT = "7tystWLcVdgF3wL9Z7Rh3L44K5FALvUVwshewMn6pump";
const MIN_USD_VALUE = 10;

// Fallback price if API fails
const FALLBACK_PRICE = 0.0001854;

const TOKEN_DECIMALS = 6; // Changed to 6 for this token

// Telegram credentials
const API_ID = 36919857;
const API_HASH = '55cfa2a93b0b942dad8a2c98d1fada9a';
const STRING_SESSION = '1BAAOMTQ5LjE1NC4xNjcuOTEAUFipUy0lqB2nGUVSTxANFIEovWoJCSVXzj7TXFh1MRoPzb0SNf9ZZ08xKG48lqIy51+FkbuPxLJh2lpCktKjcCX7DLMMLQGzCpI7vir4Qyi7mXLbCFSZB6uJPhmGpBgMu57+le4wwmbIFThafYnavodpDoZsc5xQaWoqd524MVewtbLGB/zIX1LG08CnelGJdHWkBsoLdcvCyMCLE6B90BPYqBjkelAgxF6ZrreLbye3Cwmm4UxBLTq+c70E/QVT4YRBtBDyncAKqgpaHUliffijJBM3APd607dp3HNQDDh+5vSsCImR7AwYztEJyRkhtkH3M8Hnp2Y9tYTyp13CEts=';

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

async function getTokenPrice(): Promise<number> {
  try {
    const res = await fetch(`https://price.jup.ag/v6/price?ids=${REQUIRED_TOKEN_MINT}`);
    const text = await res.text();
    if (!res.ok) {
      console.log('Price fetch failed:', text);
      return FALLBACK_PRICE;
    }
    const data = JSON.parse(text);
    return data.data[REQUIRED_TOKEN_MINT]?.price || FALLBACK_PRICE;
  } catch (err) {
    console.log('Price fetch error:', err.message);
    return FALLBACK_PRICE;
  }
}

async function getHolderBalance(wallet: string): Promise<number> {
  try {
    const owner = new PublicKey(wallet);
    const mint = new PublicKey(REQUIRED_TOKEN_MINT);
    const tokenAccounts = await connection.getTokenAccountsByOwner(owner, { mint });
    let total = 0;
    for (const accountInfo of tokenAccounts.value) {
      const amount = Number(accountInfo.account.data.slice(64, 72).readBigUInt64LE(0));
      total += amount;
    }
    return total / (10 ** TOKEN_DECIMALS); // Updated to use variable decimals
  } catch {
    return 0;
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get('name') as string;
  const ticker = formData.get('ticker') as string;
  const ca = formData.get('ca') as string;
  const userWallet = formData.get('userWallet') as string;
  const image = formData.get('image') as File | null;

  if (!userWallet) {
    return NextResponse.json({ error: "Wallet not connected" }, { status: 400 });
  }

  const balance = await getHolderBalance(userWallet);
  const price = await getTokenPrice();
  const usdValue = balance * price;

  if (usdValue < MIN_USD_VALUE) {
    return NextResponse.json({ error: `Need at least $${MIN_USD_VALUE} of token (you have $${usdValue.toFixed(2)})` }, { status: 402 });
  }

  // Telegram group creation
  const client = new TelegramClient(new StringSession(STRING_SESSION), API_ID, API_HASH, { connectionRetries: 5 });

  try {
    console.log('Connecting to Telegram...');
    await client.connect();

    console.log('Starting bots in private...');
    await client.sendMessage("safeguard", { message: "/start" });
    await client.sendMessage("delugeraidbot", { message: "/start" });

    console.log('Creating group...');
    const group = await client.invoke(
      new Api.channels.CreateChannel({
        title: `${name} | $${ticker}`,
        about: "Official community",
        megagroup: true,
      })
    );
    const groupEntity = (group as Api.Updates).chats[0];

    console.log('Adding bots to group...');
    await client.invoke(
      new Api.channels.InviteToChannel({
        channel: groupEntity,
        users: ["safeguard", "delugeraidbot"],
      })
    );

    console.log('Promoting bots to admin...');
    const adminRights = new Api.ChatAdminRights({
      changeInfo: true,
      postMessages: true,
      editMessages: true,
      deleteMessages: true,
      banUsers: true,
      inviteUsers: true,
      pinMessages: true,
      addAdmins: true,
      anonymous: false,
      manageCall: true,
      other: true,
      manageTopics: true,
    });
    await client.invoke(
      new Api.channels.EditAdmin({
        channel: groupEntity,
        userId: "safeguard",
        adminRights,
        rank: "Buy Bot",
      })
    );
    await client.invoke(
      new Api.channels.EditAdmin({
        channel: groupEntity,
        userId: "delugeraidbot",
        adminRights,
        rank: "Raid Bot",
      })
    );

    console.log('Sending /add@safeguard in group to start configuration...');
    await client.sendMessage(groupEntity, { message: "/add@safeguard" });

    console.log('Setting CA for bots...');
    await client.sendMessage("safeguard", { message: `/settoken ${ca}` }); // For Safeguard
    await client.sendMessage("delugeraidbot", { message: `/settoken ${ca}` }); // For DelugeRaid

    console.log('Uploading and setting group photo...');
    if (image) {
      const buffer = Buffer.from(await image.arrayBuffer());

      const uploaded = await client.uploadFile({
        file: new CustomFile(image.name, image.size, '', buffer),
        workers: 1,
      });

      await client.invoke(
        new Api.channels.EditPhoto({
          channel: groupEntity,
          photo: new Api.InputChatUploadedPhoto({ file: uploaded }),
        })
      );
    }

    console.log('Sending and pinning welcome...');
    const welcome = await client.sendMessage(groupEntity, { message: `Welcome to $${ticker}! Buy: /buy Raid: /raid\nCA: ${ca}` });
    await client.pinMessage(groupEntity, welcome.id);

    console.log('Generating invite link...');
    const link = await client.invoke(
      new Api.messages.ExportChatInvite({
        peer: groupEntity,
        legacyRevokePermanent: true,
      })
    );

    console.log('Disconnecting...');
    await client.disconnect();

    return NextResponse.json({ groupLink: (link as Api.ChatInviteExported).link });
  } catch (err) {
    console.log('Error:', err.message);
    await client.disconnect();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}