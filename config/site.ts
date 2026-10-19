/**
 * Edit this file to change the Ethereum contract, logo, and community links.
 * Leave contractAddress empty until a real 0x address exists. Do not paste a Solana address here.
 */
export const site = {
  projectName: "Sleepy Dogs Club",
  ticker: "ZZZPUPS",
  network: "Ethereum Mainnet",
  chainId: 1,
  contractAddress: "",
  logo: "/sdc/brand/logo.png",
  xUrl: "",
  communityUrl: "",
  uniswapBaseUrl: "https://app.uniswap.org/swap?chain=ethereum&outputCurrency=",
  etherscanBaseUrl: "https://etherscan.io/token/",
  title: "Sleepy Dogs Club | Every Nap Deserves a Post",
  description: "A cozy community for sharing real photos of sleeping dogs. Meet the nap pack, discover hilarious sleepy pups, and join for free.",
  hero: {
    subheading: "Real dogs. Legendary naps. Every nap deserves a post.",
  },
  story: {
    title: "what is sleepy dogs club?",
    paragraphs: [
      "We collect one very important thing: photos of dogs asleep.",
      "Post your sleepy pup, discover the nap pack, and enjoy the funniest nap faces on the internet.",
      "This is a free dog-lover community. You don't need crypto to join.",
    ],
    facts: [
      ["membership", "free"],
      ["official activity", "napping"],
      ["club rule", "let sleeping dogs lie"],
    ],
  },
  quietLine: "quiet please. the club is napping.",
  memeNote: "ZZZPUPS is an independent, high-risk meme token; joining and sharing dog photos is free and never requires holding tokens.",
  footerNote:
    "The photo-sharing community is free to join. $ZZZPUPS is a separate, high-risk Ethereum meme token and is not affiliated with the Solana Eepy Dog team.",
} as const;

export const hasValidContract = /^0x[a-fA-F0-9]{40}$/.test(site.contractAddress);
export const contractDisplay = hasValidContract ? site.contractAddress : "CA coming soon";
export const tokenLink = hasValidContract ? site.etherscanBaseUrl + site.contractAddress : null;
export const swapLink = hasValidContract ? site.uniswapBaseUrl + site.contractAddress : null;
