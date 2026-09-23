import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url.startsWith('/api/')) {
          try {
            const endpoint = url.replace('/api/', '');
            let handler;
            if (endpoint === 'create-razorpay-order') {
              handler = (await import('./api/create-razorpay-order.js')).default;
            } else if (endpoint === 'verify-razorpay-payment') {
              handler = (await import('./api/verify-razorpay-payment.js')).default;
            } else if (endpoint === 'razorpay-webhook') {
              handler = (await import('./api/razorpay-webhook.js')).default;
            }
            if (handler) {
              if (endpoint !== 'razorpay-webhook' && !req.body) {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const raw = Buffer.concat(chunks).toString();
                req.body = raw ? JSON.parse(raw) : {};
              }
              if (!res.status) {
                res.status = (code) => {
                  res.statusCode = code;
                  return res;
                };
              }
              if (!res.json) {
                res.json = (data) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return res;
                };
              }
              return await handler(req, res);
            }
          } catch (e) {
            console.error('[API Dev Middleware Error]:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: e.message }));
          }
        }
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), apiDevPlugin()],
    server: {
      port: 3000,
      open: false,
      hmr: {
        overlay: false
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
          '.jsx': 'jsx'
        },
      },
    },
  }
})
