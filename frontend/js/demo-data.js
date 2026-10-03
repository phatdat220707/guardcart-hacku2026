/* ============================================================
   GuardCart — Demo data (JS mirror of shared/demo-data.json)
   Kept as a JS file so the frontend also works over file://
   where fetch() of JSON is blocked by CORS.
   Source of truth for the whole team: shared/demo-data.json
   ============================================================ */

window.GUARDCART_DEMO_DATA = {
  meta: {
    label: "Demo payment data — simulated merchants, products and payment options",
    currency: "HKD"
  },
  mandate_template: {
    category: "running_shoes",
    max_spend: 800,
    approval_threshold: 750,
    max_points: 2000,
    trusted_merchants_only: true,
    expiry: "2026-10-05T23:59:59+08:00"
  },
  products: [
    { id: "P01", name: "Velocity Runner Pro", merchant: "RunnerHub",      trusted: true,  category: "running_shoes", price: 699, shipping: 30, description: "Lightweight daily trainer, breathable mesh, HK student favourite." },
    { id: "P02", name: "StreetGlide X",       merchant: "UrbanSport",     trusted: true,  category: "running_shoes", price: 749, shipping: 21, description: "Street-to-track hybrid with responsive foam midsole." },
    { id: "P03", name: "TrailMaster GTX",     merchant: "PeakOutfitters", trusted: true,  category: "running_shoes", price: 730, shipping: 90, description: "Waterproof trail shoe, ships from overseas warehouse." },
    { id: "P04", name: "AirFlex Lite",        merchant: "KickzDeal",      trusted: false, category: "running_shoes", price: 649, shipping: 25, description: "Budget trainer from an unrated marketplace seller." },
    { id: "P05", name: "Urban Pulse 2",       merchant: "RunnerHub",      trusted: true,  category: "running_shoes", price: 799, shipping: 0,  description: "Premium city runner, free local delivery." },
    { id: "P06", name: "CloudStep Max",       merchant: "UrbanSport",     trusted: true,  category: "running_shoes", price: 720, shipping: 40, description: "Max-cushion long-distance trainer." },
    { id: "P07", name: "RapidFoam Elite",     merchant: "SpeedShop",      trusted: false, category: "running_shoes", price: 599, shipping: 60, description: "Racing flat from an unverified overseas store." },
    { id: "P08", name: "MetroSprint",         merchant: "PeakOutfitters", trusted: true,  category: "running_shoes", price: 760, shipping: 15, description: "Snappy tempo shoe for interval days." },
    { id: "P09", name: "NovaRun Knit",        merchant: "RunnerHub",      trusted: true,  category: "running_shoes", price: 680, shipping: 45, description: "Knit-upper everyday runner, wide fit available." },
    { id: "P10", name: "FlexTrail Aero",      merchant: "UrbanSport",     trusted: true,  category: "running_shoes", price: 810, shipping: 0,  description: "Flagship carbon-plate trail racer." }
  ],
  payment_options: [
    { name: "Card A", reward_value: 20, fee: 0,  points_used: 0, note: "Demo payment data" },
    { name: "Card B", reward_value: 35, fee: 10, points_used: 0, note: "Demo payment data" },
    { name: "FPS",    reward_value: 0,  fee: 0,  points_used: 0, note: "Demo payment data" }
  ],
  scenarios: {
    success:  { product_id: "P01", payment: "Card A", headline_total: 729 },
    approval: { product_id: "P02", payment: "Card A", headline_total: 770 },
    blocked:  { product_id: "P03", payment: "Card A", headline_total: 820 }
  }
};
