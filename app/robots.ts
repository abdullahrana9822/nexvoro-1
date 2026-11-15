import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/account",
        "/login",
        "/register",
        "/orders",
        "/my-account",
        "/my-orders",
        "/cart",
        "/checkout",
        "/wishlist",
        "/compare",
        "/order-confirmation/",
        "/order-tracking",
        "/track-order",
      ],
    },
  };
}
