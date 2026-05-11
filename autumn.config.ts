import { defineConfig } from "atmn";

export default defineConfig({
  plans: [
    {
      id: "free",
      name: "Free",
      features: [
        { id: "projects", limit: 1 },
        { id: "photos", limit: 10 },
      ],
    },
    {
      id: "pro",
      name: "Pro",
      prices: [
        {
          amount: 2900, // €29.00
          currency: "eur",
          interval: "month",
        },
      ],
      features: [
        { id: "projects", unlimited: true },
        { id: "photos", limit: 500 },
        { id: "white_label", included: false },
      ],
    },
    {
      id: "agency",
      name: "Agency",
      prices: [
        {
          amount: 7900, // €79.00
          currency: "eur",
          interval: "month",
        },
      ],
      features: [
        { id: "projects", unlimited: true },
        { id: "photos", unlimited: true },
        { id: "white_label", included: true },
      ],
    },
  ],
});
