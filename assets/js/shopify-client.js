/* CHUWU (初·五) — thin client for Shopify's public Storefront API.
   Uses the "Headless" channel's Public access token (safe for client-side use — read-only
   product data + cart creation only, no admin/write access to the store). */
(function (root) {
  const SHOP_DOMAIN = 'chuwu-2.myshopify.com';
  const STOREFRONT_TOKEN = '93e0956e9416af8b2002f0c31d9c82ec';
  const API_VERSION = '2026-01';
  const ENDPOINT = `https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`;

  async function shopifyFetch(query, variables) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '));
    return json.data;
  }

  const PRODUCTS_QUERY = `
    query Products {
      products(first: 50) {
        nodes {
          id
          title
          handle
          description
          tags
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
          variants(first: 5) {
            nodes { id title availableForSale price { amount } }
          }
        }
      }
    }
  `;

  async function fetchProducts() {
    const data = await shopifyFetch(PRODUCTS_QUERY);
    return data.products.nodes;
  }

  const PRODUCT_BY_HANDLE_QUERY = `
    query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        id
        title
        variants(first: 5) {
          nodes { id availableForSale quantityAvailable price { amount } }
        }
      }
    }
  `;

  async function fetchProductByHandle(handle) {
    const data = await shopifyFetch(PRODUCT_BY_HANDLE_QUERY, { handle });
    return data.product;
  }

  const CART_CREATE_MUTATION = `
    mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }
  `;

  // lines: [{ merchandiseId, quantity, attributes: [{key, value}] }]
  async function createCartAndGetCheckoutUrl(lines) {
    const data = await shopifyFetch(CART_CREATE_MUTATION, { lines });
    const result = data.cartCreate;
    if (result.userErrors && result.userErrors.length) {
      throw new Error(result.userErrors.map(e => e.message).join('; '));
    }
    return result.cart.checkoutUrl;
  }

  root.ChuwuShopify = { fetchProducts, fetchProductByHandle, createCartAndGetCheckoutUrl, SHOP_DOMAIN };
})(typeof window !== 'undefined' ? window : globalThis);
