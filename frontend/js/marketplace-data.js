/* Shared marketplace identity data for animated homepage components. */
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

export const MARKETPLACES = [
  { name: "Amazon", color: "#ff9900", domain: "amazon.in", url: "https://www.amazon.in/" },
  { name: "Flipkart", color: "#2874f0", domain: "flipkart.com", url: "https://www.flipkart.com/" },
  { name: "Myntra", color: "#ff3f6c", domain: "myntra.com", url: "https://www.myntra.com/" },
  { name: "AJIO", color: "#b89b72", domain: "ajio.com", url: "https://www.ajio.com/" },
  { name: "Nykaa", color: "#fc2779", domain: "nykaa.com", url: "https://www.nykaa.com/" },
  { name: "Tata CLiQ", color: "#e40046", domain: "tatacliq.com", url: "https://www.tatacliq.com/" },
  { name: "Meesho", color: "#9f2089", domain: "meesho.com", url: "https://www.meesho.com/" },
  { name: "Lenskart", color: "#00a79d", domain: "lenskart.com", url: "https://www.lenskart.com/" },
  { name: "Adidas", color: "#000000", domain: "adidas.co.in", url: "https://www.adidas.co.in/" },
  { name: "Nike", color: "#111111", domain: "nike.com", url: "https://www.nike.com/in/" },
  { name: "Apollo Pharmacy", color: "#0072bc", domain: "apollopharmacy.in", url: "https://www.apollopharmacy.in/" },
  { name: "Vijay Sales", color: "#e22b2f", domain: "vijaysales.com", url: "https://www.vijaysales.com/" },
  { name: "Purplle", color: "#6b2d7b", domain: "purplle.com", url: "https://www.purplle.com/" },
].map((marketplace) => ({
  ...marketplace,
  logo: marketplace.logo || favicon(marketplace.domain),
}));

export const SEARCH_MARKETPLACES = MARKETPLACES;

/** Eight core stores — official logos for marquee + hero chips. */
export const TRUSTED_STORES = [
  { name: "Amazon", domain: "amazon.in", url: "https://www.amazon.in/", logo: "https://www.google.com/s2/favicons?domain=amazon.in&sz=128" },
  { name: "Flipkart", domain: "flipkart.com", url: "https://www.flipkart.com/", logo: "https://www.google.com/s2/favicons?domain=flipkart.com&sz=128" },
  { name: "AJIO", domain: "ajio.com", url: "https://www.ajio.com/", logo: "https://www.google.com/s2/favicons?domain=ajio.com&sz=128" },
  { name: "Myntra", domain: "myntra.com", url: "https://www.myntra.com/", logo: "https://www.google.com/s2/favicons?domain=myntra.com&sz=128" },
  { name: "Nykaa", domain: "nykaa.com", url: "https://www.nykaa.com/", logo: "https://www.google.com/s2/favicons?domain=nykaa.com&sz=128" },
  { name: "Purplle", domain: "purplle.com", url: "https://www.purplle.com/", logo: "https://www.google.com/s2/favicons?domain=purplle.com&sz=128" },
  { name: "Lenskart", domain: "lenskart.com", url: "https://www.lenskart.com/", logo: "https://www.google.com/s2/favicons?domain=lenskart.com&sz=128" },
  { name: "Meesho", domain: "meesho.com", url: "https://www.meesho.com/", logo: "https://www.google.com/s2/favicons?domain=meesho.com&sz=128" },
];
