const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let res = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) res = res.concat(walk(full));
    else if (/\.tsx?$/.test(name)) res.push(full);
  }
  return res;
}

const files = walk(path.join(__dirname, '..', 'src'));
console.log('Found', files.length, 'TS files. Testing them one by one...');
for (const f of files) {
  try {
    execSync(`npx tsc "${f}" --noEmit`, { stdio: 'ignore' });
  } catch (e) {
    console.error('\nTypeScript failed on file:', f);
    console.error(e.message || e.toString());
    process.exit(1);
  }
}
console.log('All files type-check individually.');
