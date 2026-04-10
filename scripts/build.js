const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { scanImages, serializeGroups } = require('../lib/grouping');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST_DIR = path.join(ROOT, 'dist');

function rimraf(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(s, d);
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

async function regenerateImagesJson() {
    const imgDir = path.join(PUBLIC_DIR, 'imgs');
    const outFile = path.join(PUBLIC_DIR, 'data', 'images.json');
    const groups = scanImages(imgDir);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(serializeGroups(groups), null, 2));
    console.log(`[build] regenerated images.json (${groups.length} groups)`);
}

async function bundleJS() {
    await esbuild.build({
        entryPoints: [path.join(PUBLIC_DIR, 'js', 'main.js')],
        bundle: true,
        minify: true,
        sourcemap: true,
        format: 'esm',
        target: ['es2018', 'chrome70', 'safari12', 'firefox68'],
        outfile: path.join(DIST_DIR, 'js', 'main.min.js'),
        external: [
            'three',
            'three/addons/controls/OrbitControls.js',
            'three/addons/loaders/GLTFLoader.js',
            'moment',
        ],
        legalComments: 'none',
        logLevel: 'info',
    });
}

async function bundleCSS() {
    await esbuild.build({
        entryPoints: [path.join(PUBLIC_DIR, 'css', 'style.css')],
        bundle: true,
        minify: true,
        outfile: path.join(DIST_DIR, 'css', 'style.min.css'),
        loader: { '.css': 'css' },
        legalComments: 'none',
        logLevel: 'info',
    });
}

function copyStatic() {
    copyDir(path.join(PUBLIC_DIR, 'imgs'), path.join(DIST_DIR, 'imgs'));
    copyDir(path.join(PUBLIC_DIR, 'data'), path.join(DIST_DIR, 'data'));
}

function writeIndexHtml() {
    const src = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    const rewritten = src
        .replace('/css/style.css', '/css/style.min.css')
        .replace('/js/main.js', '/js/main.min.js');
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), rewritten);
}

(async () => {
    const t0 = Date.now();
    rimraf(DIST_DIR);
    fs.mkdirSync(DIST_DIR, { recursive: true });
    await regenerateImagesJson();
    await Promise.all([bundleJS(), bundleCSS()]);
    copyStatic();
    writeIndexHtml();
    console.log(`[build] done in ${Date.now() - t0}ms -> ${path.relative(ROOT, DIST_DIR)}`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
