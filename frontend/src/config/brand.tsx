import type { SVGProps } from "react";

function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="9" fill="var(--brand-night)" />
      <path
        d="M8 9l8 15 8-15"
        stroke="var(--brand-teal)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="9.5" r="2.5" fill="var(--brand-blue)" />
    </svg>
  );
}

export const brand = {
  name: "Veyro",
  tagline: "Encuentra tu vehículo. Siempre.",
  description:
    "Guarda dónde estacionaste, encuentra tu vehículo y navega por niveles de estacionamiento. Gestión de vehículos y flotas.",
  supportEmail: "soporte@veyro.app",
  Logo,
  colors: { night: "#101828", blue: "#2563EB", teal: "#14B8A6", background: "#F8FAFC" },
} as const;
