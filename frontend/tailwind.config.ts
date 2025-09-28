import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";
import typographyPlugin from "@tailwindcss/typography";

export default {
    darkMode: ["class"],
    content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                quantum: {
                    deep: "#1f2933",
                    medium: "#4b5563",
                    bright: "#9ca3af",
                    light: "#e5e7eb",
                    cyan: "#d1d5db",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    hover: "hsl(var(--primary-hover))",
                    light: "hsl(var(--primary-light))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                success: {
                    DEFAULT: "hsl(var(--success))",
                    foreground: "hsl(var(--success-foreground))",
                    light: "hsl(var(--success-light))",
                },
                warning: {
                    DEFAULT: "hsl(var(--warning))",
                    foreground: "hsl(var(--warning-foreground))",
                    light: "hsl(var(--warning-light))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    primary: "hsl(var(--sidebar-primary))",
                    "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
                    border: "hsl(var(--sidebar-border))",
                    ring: "hsl(var(--sidebar-ring))",
                },
            },
            backgroundImage: {
                "gradient-primary":
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%)",
                "gradient-hero":
                    "linear-gradient(135deg, rgba(6,55,105,0.95) 0%, rgba(3,94,140,0.90) 55%, rgba(4,37,70,0.95) 100%)",
                "gradient-quantum":
                    "linear-gradient(135deg, rgba(6,55,105,1) 0%, rgba(3,94,140,1) 50%, rgba(4,37,70,1) 100%)",
                "gradient-card":
                    "linear-gradient(135deg, rgba(5,44,84,0.08) 0%, rgba(32,70,96,0.02) 100%)",
            },
            boxShadow: {
                quantum:
                    "0 25px 45px -20px rgba(75, 85, 99, 0.3), 0 12px 30px -12px rgba(31, 41, 55, 0.25)",
                glow: "0 0 25px rgba(156, 163, 175, 0.35)",
                soft: "0 10px 30px -20px rgba(55, 65, 81, 0.35)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                shimmer: {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-6px)" },
                },
                "pulse-smooth": {
                    "0%, 100%": { opacity: "0.6" },
                    "50%": { opacity: "1" },
                },
                "pulse-glow": {
                    "0%, 100%": { boxShadow: "0 0 0 rgba(56, 189, 248, 0)" },
                    "50%": { boxShadow: "0 0 35px rgba(56, 189, 248, 0.35)" },
                },
                "pulse-slow": {
                    "0%, 100%": { transform: "scale(1)", opacity: "0.55" },
                    "50%": { transform: "scale(1.08)", opacity: "0.95" },
                },
                "float-slow": {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-12px)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                shimmer: "shimmer 1.8s ease-in-out infinite",
                float: "float 3s ease-in-out infinite",
                "spin-slow": "spin 2.4s linear infinite",
                "pulse-smooth": "pulse-smooth 6s ease-in-out infinite",
                "pulse-glow": "pulse-glow 4s ease-in-out infinite",
                "pulse-slow": "pulse-slow 10s ease-in-out infinite",
                "float-slow": "float-slow 7s ease-in-out infinite",
            },
        },
    },
    plugins: [animatePlugin, typographyPlugin],
} satisfies Config;
