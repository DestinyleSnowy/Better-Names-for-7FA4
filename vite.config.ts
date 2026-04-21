import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/app/popup/index.html'),
                'content-app': resolve(__dirname, 'src/app/content/main.ts'),
                worker: resolve(__dirname, 'src/app/worker/main.ts')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: 'assets/[name][extname]'
            }
        }
    },
    resolve: {
        alias: {
            '@app': resolve(__dirname, 'src/app'),
            '@features': resolve(__dirname, 'src/features'),
            '@platform': resolve(__dirname, 'src/platform'),
            '@adapters': resolve(__dirname, 'src/adapters'),
            '@config': resolve(__dirname, 'src/config'),
            '@shared': resolve(__dirname, 'src/shared')
        }
    }
});
