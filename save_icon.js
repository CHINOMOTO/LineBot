const fs = require('fs');
const path = require('path');

const source = 'C:\\Users\\chino\\.gemini\\antigravity\\brain\\83f0a9a1-d079-482f-862b-c99ddee295a3\\line_attendance_icon_1769870268078.png';
const destDir = path.join(__dirname, 'assets');
const dest = path.join(destDir, 'app_icon.png');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
}

try {
    fs.copyFileSync(source, dest);
    console.log('Icon saved to:', dest);
} catch (err) {
    console.error('Error copying file:', err);
}
