const DEFAULT_LOGO = "https://customer-assets-gfyr7b9c.emergentagent.net/job_8644c173-92fb-4985-b9f0-9ff438711506/artifacts/73hc9mup_ChatGPT%20Image%20Sep%2028%2C%202026%2C%2010_40_54%20PM.webp";

const brand = { name: 'NAMCOS', logo: DEFAULT_LOGO };

export const appName = () => brand.name;
export const appLogo = () => brand.logo;

export async function loadBrand() {
  try {
    const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/branding`);
    const d = await r.json();
    if (d.app_name) brand.name = d.app_name;
    if (d.logo_url) brand.logo = d.logo_url;
  } catch {}
  document.title = brand.name;
  let link = document.querySelector("link[rel~='icon']");
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.href = brand.logo;
}
