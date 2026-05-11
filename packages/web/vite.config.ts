import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite"
import path from "path";
import runableAnalyticsPlugin from "./vite/plugins/runable-analytics-plugin";
import honoDevPlugin from "./vite/plugins/hono-dev-plugin";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, root, '');
	Object.assign(process.env, env);

	return {
		plugins: [honoDevPlugin(), react(), runableAnalyticsPlugin(), tailwind()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src/web"),
			},
			dedupe: ["react", "react-dom", "react-router-dom"],
		},
		optimizeDeps: {
			include: ["react", "react-dom", "react-router-dom", "better-auth/react", "autumn-js/react"],
		},
		build: {
			rollupOptions: {
				external: [
					// Server-only — must never be in client bundle
					"@aws-sdk/client-s3",
					"@aws-sdk/s3-request-presigner",
					"@libsql/client",
					"drizzle-orm",
					"hono",
					"better-auth",
				],
				output: {
					manualChunks(id) {
						if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router-dom")) {
							return "vendor-react";
						}
						if (id.includes("node_modules/lucide-react")) {
							return "vendor-ui";
						}
						if (id.includes("node_modules/@tanstack")) {
							return "vendor-query";
						}
						if (id.includes("node_modules/better-auth") || id.includes("node_modules/autumn-js")) {
							return "vendor-auth";
						}
						if (id.includes("node_modules/zod") || id.includes("node_modules/react-hook-form")) {
							return "vendor-forms";
						}
					},
				},
			},
		},
		server: {
			allowedHosts: true,
			hmr: { overlay: false, }
		}
	};
});
