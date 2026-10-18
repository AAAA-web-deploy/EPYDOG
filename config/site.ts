/**
 * Edit this file to change the Ethereum contract, logo, and community links.
 * Leave contractAddress empty until a real 0x address exists. Do not paste a Solana address here.
 */
export const site = {
  projectName: "eepy dog",
  ticker: "EEPY",
  network: "Ethereum Mainnet",
  chainId: 1,
  contractAddress: "",
  logo: "/brand/replace-with-your-logo.svg",
  xUrl: "",
  communityUrl: "",
  uniswapBaseUrl: "https://app.uniswap.org/swap?chain=ethereum&outputCurrency=",
  etherscanBaseUrl: "https://etherscan.io/token/",
  title: "eepy — just a little dog",
  description: "just a little dog living his best life.",
  hero: {
    subheading: "just a little dog living his best life.",
  },
  story: {
    title: "who is eepy?",
    paragraphs: [
      "eepy is just a little dog.",
      "he likes sleeping, listening to music, and doing absolutely nothing.",
      "he's just living his best life.",
    ],
    facts: [
      ["hobbies", "naps"],
      ["other hobbies", "also naps"],
      ["favorite spot", "this bench"],
    ],
  },
  quietLine: "you can sit here as long as you're quiet.",
  memeNote: "$eepy is a meme coin with no intrinsic value or expectation of financial return.",
  footerNote:
    "Independent Ethereum project. Not affiliated with or endorsed by the Solana Eepy Dog team.",
} as const;

export const hasValidContract = /^0x[a-fA-F0-9]{40}$/.test(site.contractAddress);
export const contractDisplay = hasValidContract ? site.contractAddress : "CA coming soon";
export const tokenLink = hasValidContract ? site.etherscanBaseUrl + site.contractAddress : null;
export const swapLink = hasValidContract ? site.uniswapBaseUrl + site.contractAddress : null;
