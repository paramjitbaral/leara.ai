const { execSync } = require('child_process');
const stdout = execSync('powershell -NoProfile -Command "Get-ChildItem Env: | ForEach-Object { $_.Key + \'=\' + $_.Value }"');
console.log(stdout.toString().split('\n').filter(l => l.toLowerCase().startsWith('path=')));
