const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'build', 'appicon.png');
const outputPath = path.join(__dirname, '..', 'build', 'windows', 'icon.ico');

const sizes = [16, 24, 32, 48, 64, 128, 256];

async function convertToIco() {
    try {
        console.log('Reading source image:', inputPath);

        const pngBuffers = await Promise.all(
            sizes.map(size =>
                sharp(inputPath)
                    .resize(size, size, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .png()
                    .toBuffer()
            )
        );

        console.log('Generated PNG buffers for sizes:', sizes);

        const icoBuffer = await toIco(pngBuffers);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, icoBuffer);
        console.log('ICO file created successfully at:', outputPath);
    } catch (error) {
        console.error('Error converting icon:', error);
        process.exit(1);
    }
}

convertToIco();
