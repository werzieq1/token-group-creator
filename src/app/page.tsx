"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const { connected, publicKey } = useWallet();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [ca, setCa] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const createGroup = async () => {
    if (!connected || !publicKey) return setResult("Connect wallet first");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('ticker', ticker);
      formData.append('ca', ca);
      formData.append('userWallet', publicKey.toBase58());
      if (image) formData.append('image', image);

      const res = await fetch("/api/create-group", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data.groupLink || data.error);
    } catch (e) {
      setResult("Error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-2">Token Group Creator</h1>
        <p className="text-center text-gray-400 mb-6">Hold $10+ of $TGC to use</p>
        <div className="flex justify-center mb-6">
          <WalletMultiButton className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full" />
        </div>
        {connected && (
          <div className="space-y-4">
            <input
              placeholder="Token Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <input
              placeholder="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <input
              placeholder="CA"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <div className="relative">
              <input
                type="file"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 opacity-0 absolute z-10 cursor-pointer"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="w-full bg-gray-700 text-gray-400 border border-gray-600 rounded-md p-3 cursor-pointer block">
                {image ? image.name : "Upload group image"}
              </label>
            </div>
            <button
              onClick={createGroup}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        )}
        {result && (
          <p className="mt-6 text-center text-green-400 break-all">{result}</p>
        )}
      </div>
      <p className="text-center text-gray-400 mt-6">Token CA: 6PDR3o1KGccEt3m8XfkoRvkBfjkkkwuQz5gtLxGApump</p>
    </div>
  );
}