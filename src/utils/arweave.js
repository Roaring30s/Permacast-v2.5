import ArweaveMultihost from "arweave-multihost";
import Arweave from "arweave";
import ArDB from 'ardb';
import { SmartWeaveWebFactory } from "redstone-smartweave";
import { generateFactoryState } from "./initStateGen";

export const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
  timeout: 60000,
});

const ardb = new ArDB(arweave);

export const smartweave = SmartWeaveWebFactory.memCached(arweave);

// TEST CONTRACT:
//export const CONTRACT_SRC = "4uc2tYgjq75xb3Bc5vMZej-7INXxhaTA70NPL23Om4A"
//export const CONTRACT_SRC = "agSUFSa_1xvUuQ8ay9sLKNOI9BzEtJyPJL4CsyW250E"
//export const CONTRACT_SRC = "j1d4jwWRso3lH04--3rZ1Top_DaoGZWwwPKA8rT180M";
//export const CONTRACT_SRC = "IyjpXrCrL8CVEwRJuRsVSPMUNn3fUvIsqMUcp3_kmPs";
//export const CONTRACT_SRC = "FqUfSxgoic43S0wiO4_SCjzLgr0Vm2frcGU-PHhAjIU";
//export const CONTRACT_SRC = 'NavYxQSs268ije1-srcbPxYzEQLHPPE9ERkTGH3PB60';
//export const CONTRACT_SRC = "6wHEQehU7FtAax4bbVtx5uYVkGHX-Qnstd7dw-UKjEM";
//export const CONTRACT_SRC = 'NavYxQSs268ije1-srcbPxYzEQLHPPE9ERkTGH3PB60';
//export const CONTRACT_SRC = "6wHEQehU7FtAax4bbVtx5uYVkGHX-Qnstd7dw-UKjEM";
//export const CONTRACT_SRC = "KrMNSCljeT0sox8bengHf0Z8dxyE0vCTLEAOtkdrfjM";
//export const CONTRACT_SRC = "aDDvmtV6Rg15LZ5Hp1yjL6strnyCsVbmhpfPe0gT21Y"

// CONTRACT ADDRESSES:

export const CONTRACT_SRC = "-SoIrUzyGEBklizLQo1w5AnS7uuOB87zUrg-kN1QWw4"
export const NFT_SRC = "-xoIBH2TxLkVWo6XWAjdwXZmTbUH09_hPYD6itHFeZY";
export const VERTO_CONTRACT = 't9T7DIOGxx4VWXoCEeYYarFYeERTpWIC1V3y-BPZgKE';
export const TREASURY_ADDRESS = 'eBYuvy8mlxUsm8JZNTpV6fisNaJt0cEbg-znvPeQ4A0';
export const NEWS_CONTRACT = "HJFEnaWHLMp2ryrR0nzDKb0DSW7aBplDjcs3vQoVbhw"; // PROD CONTRACT



export const MESON_ENDPOINT = "https://pz-prepnb.meson.network";
export const WEBSITE_URL = "https://whispering-retreat-94540.herokuapp.com";
export const API_MAP = {
  "podcasts": `${WEBSITE_URL}/feeds/podcasts`,
  "episodes": WEBSITE_URL + "/feeds/episodes/", // podcast id comes to the end
  "rss": WEBSITE_URL + "/feeds/rss/", // podcast id comes to the end
  "mapping": WEBSITE_URL + "/feeds/content/mapping",
}

export const ANS_TESTNET = "https://ans-testnet.herokuapp.com/";

export const ANS_TESTNET_MAP = {
  "profile" : ANS_TESTNET + "profile/", // arweave address comes to the end
}

export const SHOW_UPLOAD_FEE = 0.25;
export const EPISODE_UPLOAD_FEE_PERCENTAGE = 10;
export const FEE_MULTIPLIER = 3; // for uploading content to arweave


export const queryObject = {
  query: `query {
      transactions(
        tags: [
          { name: "Contract-Src", values: "${CONTRACT_SRC}"},
        ]
      first: 1000000
      ) {
      edges {
        node {
          id
        }
      }
    }
  }`,
};


export async function compoundTreasury(amount, callback, debug=false) {
  arweave.createTransaction({target: TREASURY_ADDRESS, quantity: arweave.ar.arToWinston('' + amount)}).then((tx) => {
    arweave.transactions.sign(tx).then(() => {
      if (debug) console.log(tx)
      arweave.transactions.post(tx).then((response) => {
        if (debug) console.log(response)
        callback()
      })
    })
  })
}

// + tag { name: "Protocol", values: "permacast-testnet-v3"}
export async function queryTXsByAddress(address) {
  return await ardb.search('transactions')
    .from(address)
    .tag('App-Name', 'SmartWeaveContract')
    .tag('Permacast-Version', 'amber')
    .tag('Contract-Src', CONTRACT_SRC)
    .find();
}

export async function deployContract(address, debug=false) {

  const initialState = await generateFactoryState(address);
  if (debug) console.log(initialState);
  const tx = await arweave.createTransaction({ data: initialState });

  tx.addTag("App-Name", "SmartWeaveContract");
  tx.addTag("App-Version", "0.3.0");
  tx.addTag("Contract-Src", CONTRACT_SRC);
  tx.addTag("Permacast-Version", "amber");
  tx.addTag("Content-Type", "application/json");
  tx.addTag("Timestamp", Date.now());

  tx.reward = (+tx.reward * FEE_MULTIPLIER).toString();
  
  await arweave.transactions.sign(tx)
  await arweave.transactions.post(tx)
  if (debug) console.log(tx)
  return tx.id
}
