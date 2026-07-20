/* CHUWU (初·五) — thin client for Shopify's public Storefront API.
   Uses the "Headless" channel's Public access token (safe for client-side use — read-only
   product data + cart creation/updates only, no admin/write access to the store). */
(function (root) {
  const SHOP_DOMAIN = 'chuwu-2.myshopify.com';
  const STOREFRONT_TOKEN = '93e0956e9416af8b2002f0c31d9c82ec';
  const API_VERSION = '2026-01';
  const ENDPOINT = `https://${SHOP_DOMAIN}/api/${API_VERSION}/graphql.json`;
  const CART_ID_KEY = 'chuwu_cart_id';

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

  const CART_FIELDS = `
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 50) {
      nodes {
        id
        quantity
        attributes { key value }
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            product { title featuredImage { url altText } }
          }
        }
      }
    }
  `;

  function getStoredCartId() {
    try { return localStorage.getItem(CART_ID_KEY); } catch (e) { return null; }
  }
  function storeCartId(id) {
    try { localStorage.setItem(CART_ID_KEY, id); } catch (e) { /* ignore */ }
  }
  function clearStoredCartId() {
    try { localStorage.removeItem(CART_ID_KEY); } catch (e) { /* ignore */ }
  }

  const CART_CREATE_MUTATION = `
    mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;

  const CART_LINES_ADD_MUTATION = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;

  const CART_LINES_REMOVE_MUTATION = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;

  const CART_LINES_UPDATE_MUTATION = `
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }
  `;

  const CART_QUERY = `query GetCart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`;

  function throwOnUserErrors(result) {
    if (result.userErrors && result.userErrors.length) {
      throw new Error(result.userErrors.map(e => e.message).join('; '));
    }
  }

  async function createNewCart(merchandiseId, quantity, attributes) {
    const data = await shopifyFetch(CART_CREATE_MUTATION, { lines: [{ merchandiseId, quantity, attributes }] });
    throwOnUserErrors(data.cartCreate);
    storeCartId(data.cartCreate.cart.id);
    return data.cartCreate.cart;
  }

  // Adds an item to the persistent cart (creating one if none exists yet, or if the
  // stored cart has expired/is invalid). Returns the full updated cart.
  async function addToCart(merchandiseId, quantity, attributes) {
    const existingId = getStoredCartId();
    if (!existingId) return createNewCart(merchandiseId, quantity, attributes);

    try {
      const data = await shopifyFetch(CART_LINES_ADD_MUTATION, {
        cartId: existingId,
        lines: [{ merchandiseId, quantity, attributes }]
      });
      throwOnUserErrors(data.cartLinesAdd);
      return data.cartLinesAdd.cart;
    } catch (err) {
      // Stored cart may be stale/expired — fall back to a fresh one.
      clearStoredCartId();
      return createNewCart(merchandiseId, quantity, attributes);
    }
  }

  // Returns the current persistent cart, or null if none exists yet.
  async function getCurrentCart() {
    const cartId = getStoredCartId();
    if (!cartId) return null;
    try {
      const data = await shopifyFetch(CART_QUERY, { id: cartId });
      if (!data.cart) { clearStoredCartId(); return null; }
      return data.cart;
    } catch (err) {
      clearStoredCartId();
      return null;
    }
  }

  async function removeCartLine(lineId) {
    const cartId = getStoredCartId();
    if (!cartId) return null;
    const data = await shopifyFetch(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: [lineId] });
    throwOnUserErrors(data.cartLinesRemove);
    return data.cartLinesRemove.cart;
  }

  async function updateCartLineQuantity(lineId, quantity) {
    const cartId = getStoredCartId();
    if (!cartId) return null;
    const data = await shopifyFetch(CART_LINES_UPDATE_MUTATION, { cartId, lines: [{ id: lineId, quantity }] });
    throwOnUserErrors(data.cartLinesUpdate);
    return data.cartLinesUpdate.cart;
  }

  // Legacy one-off helper (creates a standalone cart, ignoring any persistent one) —
  // still used where an instant, isolated checkout is wanted rather than the shared cart.
  async function createCartAndGetCheckoutUrl(lines) {
    const data = await shopifyFetch(CART_CREATE_MUTATION, { lines });
    throwOnUserErrors(data.cartCreate);
    return data.cartCreate.cart.checkoutUrl;
  }

  root.ChuwuShopify = {
    fetchProducts,
    createCartAndGetCheckoutUrl,
    addToCart,
    getCurrentCart,
    removeCartLine,
    updateCartLineQuantity,
    SHOP_DOMAIN
  };
})(typeof window !== 'undefined' ? window : globalThis);
