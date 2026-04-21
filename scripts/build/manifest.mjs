import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const sourcePath = resolve(root, 'manifests/manifest.base.json');
const outputDir = resolve(root, 'dist');
const outputPath = resolve(outputDir, 'manifest.json');

async function main() {
    const raw = await readFile(sourcePath, 'utf8');
    const manifest = JSON.parse(raw);

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log(`Manifest written to ${outputPath}`);
}

main().catch((error) => {
    console.error('Failed to generate manifest');
    console.error(error);
    process.exitCode = 1;
});
